-- Pharos durable core: agents, runs, audit events, explicit relationships.
-- Event payloads use JSON (`kind_json`) so envelope versioning can evolve per PHA-22 §5.

CREATE TABLE agents (
    id BLOB PRIMARY KEY CHECK (length(id) = 16) NOT NULL,
    url_key TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    adapter_type TEXT,
    parent_agent_id BLOB REFERENCES agents(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE runs (
    id BLOB PRIMARY KEY CHECK (length(id) = 16) NOT NULL,
    agent_id BLOB NOT NULL REFERENCES agents(id),
    workspace_id BLOB CHECK (workspace_id IS NULL OR length(workspace_id) = 16),
    session_id BLOB CHECK (session_id IS NULL OR length(session_id) = 16),
    correlation_id BLOB CHECK (correlation_id IS NULL OR length(correlation_id) = 16),
    lifecycle TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT
);

CREATE TABLE audit_events (
    id BLOB PRIMARY KEY CHECK (length(id) = 16) NOT NULL,
    run_id BLOB NOT NULL REFERENCES runs(id),
    agent_id BLOB NOT NULL REFERENCES agents(id),
    recorded_at TEXT NOT NULL,
    kind_json TEXT NOT NULL,
    payload_ref TEXT,
    CHECK (payload_ref IS NULL OR length(payload_ref) <= 2048)
);

CREATE TABLE agent_relationships (
    id BLOB PRIMARY KEY CHECK (length(id) = 16) NOT NULL,
    from_agent_id BLOB NOT NULL REFERENCES agents(id),
    to_agent_id BLOB NOT NULL REFERENCES agents(id),
    relationship_kind TEXT NOT NULL,
    created_in_run_id BLOB REFERENCES runs(id),
    created_at TEXT NOT NULL,
    ended_at TEXT
);

CREATE INDEX idx_runs_agent_started ON runs(agent_id, started_at);
CREATE INDEX idx_audit_events_run_recorded ON audit_events(run_id, recorded_at);
CREATE INDEX idx_agent_rel_from ON agent_relationships(from_agent_id, created_at);
CREATE INDEX idx_agent_rel_to ON agent_relationships(to_agent_id, created_at);
