-- Domain model alignment (PHA-31): org scope, agent lifecycle, run fingerprint, audit seq.

ALTER TABLE agents ADD COLUMN org_id BLOB NOT NULL DEFAULT (x'00000000000000000000000000000000') CHECK (length(org_id) = 16);
ALTER TABLE agents ADD COLUMN retired_at TEXT;
ALTER TABLE agents ADD COLUMN lifecycle TEXT NOT NULL DEFAULT '"active"';

ALTER TABLE runs ADD COLUMN workspace_fingerprint TEXT;

ALTER TABLE audit_events ADD COLUMN seq INTEGER NOT NULL DEFAULT 0;

UPDATE audit_events
SET seq = (
    SELECT COUNT(*)
    FROM audit_events older
    WHERE older.run_id = audit_events.run_id
      AND (
        older.recorded_at < audit_events.recorded_at
        OR (older.recorded_at = audit_events.recorded_at AND older.id < audit_events.id)
      )
) + 1;

CREATE INDEX IF NOT EXISTS idx_audit_events_run_seq ON audit_events(run_id, seq);
