use pharos_domain::DomainError;
use thiserror::Error;

/// Errors at the persistence boundary (I/O, SQL, mapping). Domain validation stays in `pharos-domain`.
#[derive(Debug, Error)]
pub enum PersistenceError {
    #[error("sqlite: {0}")]
    Sqlite(#[from] rusqlite::Error),

    #[error("json: {0}")]
    Json(#[from] serde_json::Error),

    #[error("domain: {0}")]
    Domain(#[from] DomainError),

    #[error("migration {version}: {message}")]
    Migration { version: i32, message: String },

    #[error("row decode: {0}")]
    Decode(String),
}
