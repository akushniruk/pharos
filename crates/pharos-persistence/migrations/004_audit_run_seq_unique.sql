-- Enforce one row per (run_id, seq) at the database layer (plan §4 append-only stream).

DROP INDEX IF EXISTS idx_audit_events_run_seq;
CREATE UNIQUE INDEX idx_audit_events_run_seq ON audit_events(run_id, seq);
