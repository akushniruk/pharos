//! Read-side projections for list/graph APIs (architecture plan §8.5): stable ordering and keyset pagination.

use crate::contracts_bridge::graph_edge_from_relationship;
use crate::error::PersistenceError;
use crate::sqlite_store::{read_agent_row, read_rel_row, SqliteStore};
use pharos_contracts::{
    sort_graph_edges, sort_graph_nodes, AgentGraphNode, AgentListItem, AgentListPage,
    RelationshipGraphPayload,
};
use pharos_domain::OrgId;
use rusqlite::params;

/// Upper bound for a single list page (defensive default for API handlers).
pub const MAX_AGENT_LIST_PAGE: usize = 500;

impl SqliteStore {
    /// Agents in `org_id` as roster rows, ordered by `url_key` (`sort_key`). Pass `after_sort_key`
    /// from a previous page's `next_cursor` for keyset pagination.
    pub fn project_agent_list_page(
        &mut self,
        org_id: OrgId,
        after_sort_key: Option<&str>,
        limit: usize,
    ) -> Result<AgentListPage, PersistenceError> {
        let limit = limit.clamp(1, MAX_AGENT_LIST_PAGE);
        let fetch = limit.saturating_add(1);

        let org_blob = org_id.as_uuid().as_bytes().to_vec();
        let mut agents = match after_sort_key {
            None => {
                let mut stmt = self.connection().prepare(
                    r#"
                    SELECT id, url_key, display_name, adapter_type, parent_agent_id, created_at, org_id, retired_at, lifecycle
                    FROM agents
                    WHERE org_id = ?1
                    ORDER BY url_key ASC
                    LIMIT ?2
                    "#,
                )?;
                let mut rows = stmt.query(params![org_blob.as_slice(), fetch as i64])?;
                let mut out = Vec::new();
                while let Some(row) = rows.next()? {
                    out.push(read_agent_row(&row)?);
                }
                out
            }
            Some(cursor) => {
                let mut stmt = self.connection().prepare(
                    r#"
                    SELECT id, url_key, display_name, adapter_type, parent_agent_id, created_at, org_id, retired_at, lifecycle
                    FROM agents
                    WHERE org_id = ?1 AND url_key > ?2
                    ORDER BY url_key ASC
                    LIMIT ?3
                    "#,
                )?;
                let mut rows = stmt.query(params![org_blob.as_slice(), cursor, fetch as i64])?;
                let mut out = Vec::new();
                while let Some(row) = rows.next()? {
                    out.push(read_agent_row(&row)?);
                }
                out
            }
        };

        let has_more = agents.len() > limit;
        if has_more {
            agents.truncate(limit);
        }

        let next_cursor = if has_more {
            agents.last().map(|a| a.url_key.clone())
        } else {
            None
        };

        let items: Vec<AgentListItem> = agents.iter().map(AgentListItem::from).collect();

        Ok(AgentListPage { items, next_cursor })
    }

    /// Org-scoped graph snapshot: nodes are all agents in the org; edges are relationships whose
    /// endpoints both belong to that org. Both slices are sorted for stable JSON and etags.
    pub fn project_relationship_graph(
        &mut self,
        org_id: OrgId,
    ) -> Result<RelationshipGraphPayload, PersistenceError> {
        let org_blob = org_id.as_uuid().as_bytes().to_vec();

        let mut stmt = self.connection().prepare(
            r#"
            SELECT id, url_key, display_name, adapter_type, parent_agent_id, created_at, org_id, retired_at, lifecycle
            FROM agents
            WHERE org_id = ?1
            ORDER BY url_key ASC
            "#,
        )?;
        let mut rows = stmt.query([org_blob.as_slice()])?;
        let mut nodes = Vec::new();
        while let Some(row) = rows.next()? {
            let agent = read_agent_row(&row)?;
            nodes.push(AgentGraphNode::from(&agent));
        }

        let mut estmt = self.connection().prepare(
            r#"
            SELECT r.id, r.from_agent_id, r.to_agent_id, r.relationship_kind, r.created_in_run_id, r.created_at, r.ended_at
            FROM agent_relationships r
            INNER JOIN agents af ON af.id = r.from_agent_id AND af.org_id = ?1
            INNER JOIN agents at ON at.id = r.to_agent_id AND at.org_id = ?1
            ORDER BY r.created_at ASC, r.id ASC
            "#,
        )?;
        let mut erows = estmt.query([org_blob.as_slice()])?;
        let mut edges = Vec::new();
        while let Some(row) = erows.next()? {
            let rec = read_rel_row(&row)?;
            edges.push(graph_edge_from_relationship(&rec));
        }

        sort_graph_nodes(&mut nodes);
        sort_graph_edges(&mut edges);

        Ok(RelationshipGraphPayload { nodes, edges })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::repos::{AgentRepository, RelationshipRepository, RunRepository};
    use chrono::Utc;
    use pharos_domain::{
        Agent, AgentId, AgentLifecycle, OrgId, RelationshipId, Run, RunId, RunLifecycle,
    };
    use uuid::Uuid;

    fn agent(org: OrgId, key: &str, parent: Option<AgentId>) -> Agent {
        let now = Utc::now();
        Agent {
            id: AgentId::from_uuid(Uuid::new_v4()),
            org_id: org,
            url_key: key.into(),
            display_name: key.into(),
            adapter_type: None,
            parent_agent_id: parent,
            lifecycle: AgentLifecycle::Active,
            created_at: now,
            retired_at: None,
        }
    }

    #[test]
    fn agent_list_page_orders_and_cursors() {
        let mut store = SqliteStore::open_in_memory().unwrap();
        let org = OrgId::from_uuid(Uuid::nil());
        let a = agent(org, "alpha", None);
        let b = agent(org, "beta", None);
        let c = agent(org, "gamma", None);
        AgentRepository::upsert_agent(&mut store, &c).unwrap();
        AgentRepository::upsert_agent(&mut store, &a).unwrap();
        AgentRepository::upsert_agent(&mut store, &b).unwrap();

        let p1 = store.project_agent_list_page(org, None, 2).expect("page1");
        assert_eq!(p1.items.len(), 2);
        assert_eq!(p1.items[0].canonical_key, "alpha");
        assert_eq!(p1.items[1].canonical_key, "beta");
        assert_eq!(p1.next_cursor.as_deref(), Some("beta"));

        let p2 = store
            .project_agent_list_page(org, p1.next_cursor.as_deref(), 2)
            .expect("page2");
        assert_eq!(p2.items.len(), 1);
        assert_eq!(p2.items[0].canonical_key, "gamma");
        assert!(p2.next_cursor.is_none());
    }

    #[test]
    fn relationship_graph_scoped_to_org() {
        let mut store = SqliteStore::open_in_memory().unwrap();
        let org_a = OrgId::from_uuid(Uuid::from_u128(1));
        let org_b = OrgId::from_uuid(Uuid::from_u128(2));

        let a1 = agent(org_a, "a1", None);
        let a2 = agent(org_a, "a2", None);
        let b1 = agent(org_b, "b1", None);
        let b2 = agent(org_b, "b2", None);
        for ag in [&a1, &a2, &b1, &b2] {
            AgentRepository::upsert_agent(&mut store, ag).unwrap();
        }

        let run = Run {
            id: RunId::new_v4(),
            agent_id: a1.id,
            parent_run_id: None,
            workspace_id: None,
            workspace_fingerprint: None,
            session_id: None,
            correlation_id: None,
            lifecycle: RunLifecycle::Active,
            started_at: Utc::now(),
            ended_at: None,
        };
        RunRepository::upsert_run(&mut store, &run).unwrap();

        use pharos_domain::RelationshipKind;
        RelationshipRepository::insert_relationship(
            &mut store,
            &pharos_domain::Relationship {
                id: RelationshipId::new_v4(),
                from_agent_id: a1.id,
                to_agent_id: a2.id,
                kind: RelationshipKind::DelegatesTo,
                created_in_run_id: Some(run.id),
                created_at: Utc::now(),
                ended_at: None,
            },
        )
        .unwrap();

        RelationshipRepository::insert_relationship(
            &mut store,
            &pharos_domain::Relationship {
                id: RelationshipId::new_v4(),
                from_agent_id: b1.id,
                to_agent_id: b2.id,
                kind: RelationshipKind::DelegatesTo,
                created_in_run_id: None,
                created_at: Utc::now(),
                ended_at: None,
            },
        )
        .unwrap();

        let g = store.project_relationship_graph(org_a).unwrap();
        assert_eq!(g.nodes.len(), 2);
        assert_eq!(g.edges.len(), 1);
        assert_eq!(g.edges[0].from_agent_id, a1.id.as_uuid());
        assert_eq!(g.edges[0].to_agent_id, a2.id.as_uuid());
    }
}
