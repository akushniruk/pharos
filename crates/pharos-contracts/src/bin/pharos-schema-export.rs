//! Writes `schemas/openapi.json` and per-type JSON Schemas next to the workspace root.
//!
//! Run from repo root: `cargo run -p pharos-contracts --bin pharos-schema-export`

use std::fs;
use std::path::PathBuf;

use pharos_contracts::{
    openapi_json, AgentGraphEdge, AgentGraphNode, AgentListItem, GraphEdgeKind,
    RelationshipGraphPayload,
};
use schemars::schema_for;

fn workspace_root() -> PathBuf {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir
        .parent()
        .and_then(|p| p.parent())
        .expect("crates/pharos-contracts -> workspace root")
        .to_path_buf()
}

fn write_json(path: &PathBuf, value: &serde_json::Value) {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).unwrap_or_else(|e| panic!("create {}: {e}", parent.display()));
    }
    fs::write(
        path,
        serde_json::to_string_pretty(value).expect("serialize json"),
    )
    .unwrap_or_else(|e| panic!("write {}: {e}", path.display()));
}

fn main() {
    let root = workspace_root();
    let schemas_dir = root.join("schemas");

    let openapi: serde_json::Value =
        serde_json::from_str(&openapi_json()).expect("openapi parses as JSON");
    write_json(&schemas_dir.join("openapi.json"), &openapi);

    let defs = [
        ("agent-list-item.json", schema_for!(AgentListItem)),
        ("agent-graph-node.json", schema_for!(AgentGraphNode)),
        ("agent-graph-edge.json", schema_for!(AgentGraphEdge)),
        ("graph-edge-kind.json", schema_for!(GraphEdgeKind)),
        (
            "relationship-graph-payload.json",
            schema_for!(RelationshipGraphPayload),
        ),
    ];
    for (name, schema) in defs {
        write_json(
            &schemas_dir.join(name),
            &serde_json::to_value(&schema).expect("schema to json"),
        );
    }

    eprintln!(
        "Wrote OpenAPI + JSON Schemas under {}",
        schemas_dir.display()
    );
}
