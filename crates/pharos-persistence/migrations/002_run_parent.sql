-- Link child runs to the parent run that spawned them (PHA-27 hierarchy).

ALTER TABLE runs ADD COLUMN parent_run_id BLOB REFERENCES runs(id);

CREATE INDEX idx_runs_parent ON runs(parent_run_id);
