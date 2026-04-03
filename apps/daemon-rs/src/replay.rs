use std::{fs, path::PathBuf};

use clap::{Parser, Subcommand};

use crate::connector::{resolve_connector, ConnectorError};

#[derive(Debug, Parser)]
#[command(name = "pharos-daemon")]
pub struct Cli {
    #[command(subcommand)]
    pub command: Command,
}

#[derive(Debug, Subcommand)]
pub enum Command {
    Serve,
    Replay {
        #[arg(long, default_value = "claude")]
        connector: String,
        #[arg(long)]
        input: PathBuf,
    },
}

#[derive(Debug, thiserror::Error)]
pub enum ReplayError {
    #[error("failed to read replay input {path}: {source}")]
    Read {
        path: String,
        #[source]
        source: std::io::Error,
    },
    #[error(transparent)]
    Normalize(#[from] ConnectorError),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
}

pub fn replay_file(path: PathBuf, connector_name: &str) -> Result<(), ReplayError> {
    let display_path = path.display().to_string();
    let raw = fs::read_to_string(&path).map_err(|source| ReplayError::Read {
        path: display_path,
        source,
    })?;
    let connector = resolve_connector(connector_name)?;
    let event = connector.normalize_raw_event(&raw)?;

    println!("{}", serde_json::to_string_pretty(&event)?);
    Ok(())
}
