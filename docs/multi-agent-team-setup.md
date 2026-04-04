# Multi-Agent Team Setup

This document is the operating contract for cross-functional agent work in Pharos.

Back to [Docs Portal](README.md).

## Team Composition

- PM Orchestrator (`team-lead`)
  - Owns planning, sequencing, risk control, and final go/no-go decisions.
- Frontend Engineer (`typescript-pro`)
  - Owns SolidJS + TypeScript implementation in `apps/client-solid`.
- Backend Engineer (`generalPurpose`)
  - Owns Rust daemon behavior in `apps/daemon-rs`.
- Docs Agent (`generalPurpose`)
  - Owns docs portal and implementation docs in `docs/`.
- Reviewer (`code-reviewer`)
  - Owns merge gate review and release-readiness checks.

## Ownership Boundaries (Locked)

- Frontend-owned scope
  - `apps/client-solid/**`
- Backend-owned scope
  - `apps/daemon-rs/**`
- Docs-owned scope
  - `docs/**`

Boundary rule:

- Agents do not edit outside their owned scope unless PM explicitly assigns a coordinated cross-cutting task.

## FE-BE Interface Contract

Frontend and backend integrate through these canonical payload fields for graph and event rendering:

- Agent parent linkage:
  - `payload.parent_agent_id`
  - fallback keys: `payload.parent_id`, `payload.parentId`
- Agent identity and labels:
  - `agent_id`, `display_name`, `agent_name`, `agent_type`
- Event identity:
  - `hook_event_type`
- Event payload:
  - `payload` (must remain JSON-serializable)

Compatibility rule:

- Backend maintains additive compatibility for payload keys.
- Frontend must tolerate missing optional fields and fall back safely.

Current implementation anchors:

- Backend parser and envelope mapping:
  - `apps/daemon-rs/src/profiles/cursor.rs`
  - `apps/daemon-rs/src/envelope.rs`
- Frontend parent resolution and graph rendering:
  - `apps/client-solid/src/lib/store.ts`
  - `apps/client-solid/src/components/AgentGraph.tsx`

## Parallel Execution Workflow

1. PM opens the cycle with scope + acceptance gates.
2. Frontend, backend, and docs execute in parallel.
3. PM runs integration checkpoint after each stream lands.
4. Reviewer performs blocking quality pass.
5. PM closes the cycle only after reviewer sign-off.

## Delivery Gates

- Gate 1 (Backend): parser/envelope/store tests pass.
- Gate 2 (Frontend): test + build pass; graph/event views validated.
- Gate 3 (Docs): docs portal links and runbook content are current.
- Gate 4 (Reviewer): no high-severity findings and no docs drift.

## PM Integration Checkpoint (Current Cycle)

- Frontend stream normalization hardened to accept `parent_agent_id` in addition to legacy parent keys.
- Docs portal alignment updated with repo-relative links and portal breadcrumbs.
- Backend follow-up risk logged: Codex and filesystem-derived subagent scans may still default parent linkage to `main` in some paths and should be scheduled as a dedicated backend hardening task.
