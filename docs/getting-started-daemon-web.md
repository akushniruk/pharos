# Getting started: Web dashboard on your machine

**Goal:** Run the **Rust daemon** and **Solid dashboard** from the repository on your **own computer**—the usual open-source developer path.

**You are:** A builder who is fine with two terminals and wants the fastest iteration loop.

---

## Prerequisites

- **Rust** — Pin is in [`rust-toolchain.toml`](https://github.com/akushniruk/pharos/blob/main/rust-toolchain.toml) at the repo root (currently **1.88.x**).
- **pnpm** — For `apps/client-solid`.
- **Claude / Cursor / Codex / … session files** on disk where the daemon expects them (defaults follow your OS home layout—see the [architecture cheat sheet](../CLAUDE.md) if you customize paths).

---

## Steps

1. **Clone** the repository and open a terminal at the root.

2. **Start the daemon** (port **4000** by default):

   ```bash
   make daemon
   ```

3. **Start the dashboard** (port **5173** by default):

   ```bash
   make client
   ```

4. Open **`http://127.0.0.1:5173`** in a browser. Open **Docs** in the sidebar to read this portal while you explore the UI.

Optional: `make up` starts both in the background (see root [README](../README.md)).

---

## Defaults and overrides

| Piece | Default | Override |
|-------|---------|----------|
| Daemon HTTP + WS | `4000` | `SERVER_PORT` in `make`, or `PHAROS_DAEMON_PORT` when running the binary |
| Vite dev server | `5173` | `CLIENT_PORT` / `VITE_PORT` |

The browser client resolves the API host from `window.location` and talks to **`${host}:4000`** unless you set **`VITE_API_URL`** / **`VITE_WS_URL`** (see [remote daemon](getting-started-remote-daemon.md)).

---

## First success criteria

- `curl -sS http://127.0.0.1:4000/health` succeeds.
- Dashboard status shows a working connection to the stream (not permanently disconnected).
- With sessions discoverable by the daemon, you see **projects or events**.

---

## Next steps

- [Desktop vs web dashboard](desktop-vs-daemon-web.md)
- [Reading the event stream](event-stream-ux-guide.md)
- [HTTP and WebSocket API](frontend-api-reference.md)
