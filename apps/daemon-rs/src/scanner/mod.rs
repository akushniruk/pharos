//! Discovers agent sessions from configured runtime homes and tails transcripts / logs into the store.

mod helpers;
mod ollama;
mod run;
mod session;
mod signatures;
mod tailing;

pub use run::run_scanner;

#[cfg(test)]
mod tests;
