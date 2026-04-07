# Getting started: Desktop app

**Goal:** Use the **Tauri desktop** shell to browse agent activity with a **local Pharos daemon** feeding the UI.

**You are:** Someone who wants a packaged app (or who builds `apps/desktop` from source).

---

## What you need

- **Desktop build** — Prebuilt installers from [GitHub Releases](https://github.com/akushniruk/pharos/releases), *or* run from source (below).
- **Daemon on the same machine** — Pharos reads agent transcripts locally. The dashboard must be able to reach the daemon (default **HTTP/WebSocket port 4000** in development layouts).

The desktop window is still the **Solid dashboard**; only the **window chrome** changes. You still need the **observability daemon** running where your agent sessions are.

---

## From source (development)

Prerequisites: **Node.js 20**, **Rust 1.88+** (see repo [`rust-toolchain.toml`](https://github.com/akushniruk/pharos/blob/main/rust-toolchain.toml)), **npm** in `apps/desktop`.

1. **Terminal A — daemon** (from repo root):

   ```bash
   make daemon
   ```

   Leave this running. By default it listens on `http://127.0.0.1:4000`.

2. **Terminal B — Solid dev server** (dashboard assets):

   ```bash
   make client
   ```

   By default Vite listens on `http://127.0.0.1:5173`. Tauri dev loads this URL.

3. **Terminal C — desktop shell:**

   ```bash
   cd apps/desktop
   npm ci
   npm run tauri dev
   ```

4. Confirm the UI shows **Connected** once the WebSocket to the daemon is up. Use **Documentation** in the app for product-oriented pages.

Production-style builds use `npm run tauri build` in `apps/desktop`; see [macOS desktop release](macos-desktop-release.md) for release engineering notes.

---

## First success criteria

- Daemon healthy: `curl -sS http://127.0.0.1:4000/health` returns OK.
- Desktop or browser UI: overview loads and the status surface is not stuck in a permanent error state.
- With agent sessions present on disk in the paths the daemon scans, **projects or events** appear (exact behavior depends on your agent runtime).

---

## Next steps

- [Desktop vs web dashboard](desktop-vs-daemon-web.md) — *when not to use the desktop shell*
- [Security and data boundaries](security-for-reviewers.md) — *what stays local*
- [Sessions, events, and the graph](understanding-sessions-and-events.md)
