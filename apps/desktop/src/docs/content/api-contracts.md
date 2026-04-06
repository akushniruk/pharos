# API reference

Pharos list and graph read models are defined in Rust (`crates/pharos-contracts`) and exported as OpenAPI 3.x. **Wire JSON uses `snake_case`** — use the same names in fixtures, generated TypeScript, and any UI that consumes these payloads.

## `AgentListItem` (roster row)

| Field | Meaning |
| ----- | ------- |
| `agent_id` | Stable agent UUID |
| `org_id` | Organization / tenant UUID |
| `canonical_key` | Stable slug for URLs and APIs (maps from domain `url_key`) |
| `display_name` | Human-facing label |
| `adapter_type` | Optional adapter label or `null` |
| `sort_key` | Deterministic list ordering; for valid agents equals `canonical_key` |

## `AgentListPage`

| Field | Meaning |
| ----- | ------- |
| `items` | `AgentListItem[]` |
| `next_cursor` | Cursor for the next page, or `null` |

## `AgentGraphNode`

Same as `AgentListItem`, plus `parent_agent_id` (`null` or UUID).

## `AgentGraphEdge`

| Field | Meaning |
| ----- | ------- |
| `from_agent_id` | Source UUID |
| `to_agent_id` | Target UUID |
| `kind` | `delegates_to` or `spawned_sub_agent` |
| `sort_key` | Opaque edge ordering key |

## `RelationshipGraphPayload`

- `nodes`: `AgentGraphNode[]`
- `edges`: `AgentGraphEdge[]`

## Note on other APIs

**Paperclip** control-plane responses (for example `/api/agents/me` in local tooling) use **different** shapes and often **camelCase**. Do not assume they match Pharos contract field names — see [The observability slice](/docs/concepts/observability-slice).
