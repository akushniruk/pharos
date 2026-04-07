# How Pharos fits together

**Audience:** Anyone who wants a **picture of the moving parts** before diving into prose or code — developers, reviewers, and contributors.

The in-app docs portal renders the figures below from **Mermaid** diagrams. If you read this file on GitHub, you may see only the diagram source in code fences; open the same page in the dashboard under **How it works** for the rendered SVG.

---

## Local daemon and web dashboard

Typical open-source setup: the daemon reads session transcripts on the same machine, exposes a WebSocket, and the Solid dashboard connects as a client.

```mermaid
flowchart LR
  subgraph disk["Transcripts on disk"]
    T["Session JSONL files"]
  end
  D["Rust daemon (apps/daemon-rs)"]
  W["WebSocket :4000 (default)"]
  U["Solid dashboard (apps/client-solid)"]

  T -->|tail, parse, normalize| D
  D -->|EventEnvelope stream| W
  W --> U
```

---

## Desktop app

The packaged **Tauri** shell embeds the same dashboard experience. A **local daemon** still provides the event stream; the UI talks to it over the same style of WebSocket contract (typically on localhost).

```mermaid
flowchart TB
  subgraph machine["Your machine"]
    F["Agent session files"]
    DM["Rust daemon"]
    TD["Tauri desktop (apps/desktop)"]
  end

  F --> DM
  DM <-->|WebSocket| TD
```

---

## Remote daemon (VPS)

You can run the daemon where transcripts are produced (or reachable) and open the dashboard elsewhere, as long as **network routing and trust boundaries** match how you deploy. See [Daemon on a server](getting-started-remote-daemon.md).

```mermaid
flowchart LR
  S["Host running the daemon"]
  P["Dashboard on laptop or CI"]

  S <-->|HTTP / WebSocket| P
```

---

## From transcript line to event

The daemon is responsible for **discovery**, **tailing**, and **normalization**. The stable contract for what the UI consumes is the **event envelope** in Rust (`apps/daemon-rs/src/model.rs`).

```mermaid
flowchart LR
  L["One transcript line"] --> P["Parse"]
  P --> N["Normalize"]
  N --> E["EventEnvelope"]
  E --> R["Live stream and replay"]
```

---

## Related reading

- [Sessions, events, and the graph](understanding-sessions-and-events.md) — vocabulary for what you see in the UI.
- [Desktop vs web dashboard](desktop-vs-daemon-web.md) — when to choose each shape.
- [Architecture cheat sheet](../CLAUDE.md) — short definitions and dev commands for contributors.
- [HTTP and WebSocket API](frontend-api-reference.md) — integrator-facing contract.
