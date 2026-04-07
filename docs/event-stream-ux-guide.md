# Reading the event stream

Back to [documentation home](README.md).

The **event stream** is the live timeline for the **project** (and optional **session** or **agent**) you have selected. Each row is one normalized **event** from an agent transcript: prompts, assistant output, tool calls, subagent boundaries, and session lifecycle markers. New activity appears at the **top** of the list.

---

## What you should use it for

| Goal | How the stream helps |
|------|----------------------|
| See what the agent did, in order | Chronological rows with human-readable summaries |
| Spot tool use and failures | Tool event types and attention hints when something looks stuck |
| Search or filter noise | Search box, **Simple** vs **Detailed**, and type/runtime filters |
| Prove what ran (review, audit) | Expand a row for **Parsed** fields or **Raw JSON**, then **copy** |

The stream is a **view** on data the **daemon** already ingested. If a session never produced transcript files the daemon can read, nothing will appear here.

---

## Simple vs Detailed

Two modes apply to **every row**. Your choice is stored in the browser as `pharos.event-stream.detail-mode` (per device).

### Simple

- Focused on **operator-readable** summaries: one line that tells you what happened, without clutter.
- A few **lifecycle** event types are **hidden by default**: session start/end and title-only churn, so the list stays readable during long runs.
- Good default for **day-to-day monitoring**.

### Detailed

- Surfaces **every event type** you have not explicitly filtered out.
- Each row can show richer **kind labels** (for example distinguishing “requested work” from “update”) and more metadata on the card before you expand.

Switch with the **Simple** / **Detailed** controls next to the search bar.

---

## Search

- The search field filters the visible stream.
- With a non-empty query, Pharos asks the daemon for **`/api/events/search`** (debounced ~180ms), scoped to the **current project** and, when relevant, the **focused session**. Results replace the live slice while the query is active.
- If the server search is unavailable, the client falls back to a **case-insensitive regular expression** over a assembled display line (event type, summaries, tool names, timestamps, and common payload text fields).
- **Tip:** Clear the search to return to the live tail for the current scope.

---

## Filters (**Filter** button)

When **Filter** is on, you get chip rows:

**Types** — Toggle event families such as tool use, user prompt, assistant response, subagent start/stop, and session lifecycle. Hidden types drop out of the list immediately. In **Simple** mode, lifecycle types start hidden; switching to **Detailed** shows all types until you hide them again.

**Runtimes** — When events carry a runtime label (Claude, Codex, Cursor, etc.), you can hide whole runtimes to focus on one stack.

If everything disappears, check filters and search—the empty state will mention **filters** when that is the cause.

---

## Stream trimming and ordering

- Rows are shown from **newest to oldest** (latest at the top).
- The UI keeps at most **500** rows in this view after filtering and compaction.
- **Compaction** merges consecutive duplicates when they are the same session, agent, event type, and tool (where applicable), with close timestamps and matching text signatures—so rapid repeated signals do not spam the list. Special cases (for example orchestration tool rows) are never collapsed together.

---

## Expanding a row

Click a row (or use keyboard activation) to expand it.

**Collapsed** — Timestamp, summary, optional second line, and event-type styling.

**Expanded** — Extra payload detail. For structured payloads you get:

- **Parsed** — Nested key/value view (default).
- **Raw JSON** — Exact JSON for the payload.
- **Copy JSON** — Copies that JSON for pasting into a ticket or log.

---

## Attention banners (when something needs a human)

When the daemon flags sessions that deserve follow-up, a banner can appear **above** the stream with:

- A **headline** and explanation
- Suggested next steps
- **Show log** — selects that session in the sidebar so the stream matches
- **Copy summary** — clipboard-friendly text for sharing
- **Solved** — dismisses the banner and row highlights until new activity changes status

Related rows may be **highlighted** so you can match the banner to a specific tool or event.

---

## Empty and connection states

You might see:

- **Loading live events** — WebSocket has not delivered the first batch yet.
- **Disconnected** — No live data; check that the daemon is running and reachable ([getting started](getting-started-daemon-web.md)).
- **No events for this project** — No captured history for the selection, or your **focus** is too narrow (clear session/agent focus to widen).
- **No events match your search** — Adjust or clear the query.
- **No events match the active filters** — Re-enable types or runtimes.

---

## Scope: project, session, and agent

The stream respects what you select in the **sidebar**:

- **Project only** — Events across sessions in that project (subject to daemon rules and limits).
- **Session** — Narrows to one conversation.
- **Agent** — Further narrows when you focus a specific agent within that context.

If the list feels empty, widen scope before assuming the daemon has no data.

---

## For contributors

Implementation lives in `EventStream.tsx`, `EventRow.tsx`, and `widgets/event-stream/streamHelpers.ts`. Prefer **semantic classes** (for example `event-stream-*`) and theme tokens in `styles.css` instead of pasting long inline styles. Row expansion and payload actions should stay keyboard-operable and labeled for assistive tech.

---

## Related

- [Sessions, events, and the graph](understanding-sessions-and-events.md)
- [HTTP and WebSocket API](frontend-api-reference.md) — includes event search and stream behavior
