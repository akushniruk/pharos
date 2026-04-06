use crate::error::PersistenceError;

const MIGRATIONS: &[(i32, &str)] = &[
    (1, include_str!("../migrations/001_initial.sql")),
    (2, include_str!("../migrations/002_run_parent.sql")),
    (3, include_str!("../migrations/003_domain_fields.sql")),
    (
        4,
        include_str!("../migrations/004_audit_run_seq_unique.sql"),
    ),
];

/// Applies pending forward-only migrations in order. Safe to call on every open.
pub fn migrate(conn: &rusqlite::Connection) -> Result<(), PersistenceError> {
    conn.execute_batch(
        r"
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS pharos_migrations (
            version INTEGER PRIMARY KEY NOT NULL,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        ",
    )?;

    let mut current: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM pharos_migrations",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    for &(version, sql) in MIGRATIONS {
        if version <= current {
            continue;
        }
        if version != current + 1 {
            return Err(PersistenceError::Migration {
                version,
                message: format!("expected next version {}, found gap", current + 1),
            });
        }
        conn.execute_batch(sql)
            .map_err(|e| PersistenceError::Migration {
                version,
                message: e.to_string(),
            })?;
        conn.execute(
            "INSERT INTO pharos_migrations (version) VALUES (?1)",
            [version],
        )?;
        current = version;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrate_idempotent() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        migrate(&conn).unwrap();
        migrate(&conn).unwrap();
        let v: i32 = conn
            .query_row("SELECT MAX(version) FROM pharos_migrations", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(v, 4);
    }
}
