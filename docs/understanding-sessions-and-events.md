# Sessions, events, and the graph

**Audience:** Anyone using the dashboard—**developers**, **security reviewers**, or **curious evaluators**—who wants a plain-language map from **on-disk agent activity** to **what appears on screen**.

---

## Core concepts

**Session**  
A single agent conversation or run that produces a **transcript** (often JSONL) on disk. The daemon discovers sessions, tracks activity, and may mark them inactive when files go quiet.

**Event**  
A normalized unit derived from transcript lines (user messages, tool calls, assistant output, subagent boundaries…). Events are what the **event stream** renders and what the API persists or streams over the WebSocket.

**Project**  
Usually derived from the **working directory** or workspace label the runtime reports. Projects group sessions in the sidebar.

**Agent graph**  
A visual map (metro-line style) of **relationships**—for example parent and child agents—when the captured events expose that structure.

---

## What you should expect in the UI

- **Overview** lists **projects** and lets you drill into **sessions**.
- **Event stream** shows a chronological narrative with **simple** (compact) and **detailed** (expandable) presentations—see [Reading the event stream](event-stream-ux-guide.md).
- **Graph** highlights structure when your workloads spawn subagents or parallel runs.

Nothing here replaces your agent’s **native UI**; Pharos is the **flight recorder** view aligned with observability workflows.

---

## Where “truth” lives

The daemon owns **discovery, tailing, and normalization**. The canonical **event shape** is defined in Rust (`apps/daemon-rs`, `model.rs`). The dashboard is a **client** of that contract—if numbers differ, trust the daemon’s stored replay first, then file a bug.

---

## Feature maturity

Pharos is **pre-1.0**. Coverage varies by **agent runtime** (Claude, Codex, Cursor, Gemini profiles, etc.). If a session is missing:

- Confirm the runtime wrote files where this build expects them.
- Confirm the daemon is running on the **same machine** as those files **or** you are using a deliberate **remote** layout.

---

## Related

- [How Pharos fits together (diagrams)](architecture-how-it-works.md)
- [HTTP and WebSocket API](frontend-api-reference.md)
- [Why Pharos exists](positioning.md)
- [Security and data boundaries](security-for-reviewers.md)
