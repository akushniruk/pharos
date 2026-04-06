use thiserror::Error;

/// Validation failures and broken domain invariants (no I/O or transport errors).
#[derive(Debug, Error, PartialEq, Eq)]
pub enum DomainError {
    #[error("validation failed on {field}: {message}")]
    Validation {
        field: &'static str,
        message: String,
    },

    #[error("invariant violated: {0}")]
    InvariantViolation(String),
}

impl DomainError {
    pub fn validation(field: &'static str, message: impl Into<String>) -> Self {
        Self::Validation {
            field,
            message: message.into(),
        }
    }

    pub fn invariant(msg: impl Into<String>) -> Self {
        Self::InvariantViolation(msg.into())
    }
}
