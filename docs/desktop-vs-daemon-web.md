# Desktop app vs web dashboard

Pharos ships **two ways** to open the same **Solid dashboard** experience. Both talk to the same **Rust daemon** API.

---

## At a glance

| | **Desktop (Tauri)** | **Web (`pnpm dev` / static build)** |
|---|---------------------|-------------------------------------|
| **What it is** | Wrapped native app (`apps/desktop`) | Browser UI from `apps/client-solid` |
| **Typical user** | Prefers an app icon / OS integration | Prefers browsers or headless servers with static assets |
| **Dev server URL** | Tauri loads **`http://localhost:5173`** in development (same Vite as the web path) | You browse **`http://127.0.0.1:5173`** directly |
| **Daemon** | **Required** on a host reachable from the UI (usually **localhost:4000** in dev) | **Required** — same rule |
| **Updates** | GitHub Releases / installer flow | Redeploy or refresh static `dist/` |

---

## When to choose which

**Choose the desktop** when you want a single installable artifact and in-app links (for example the packaged `/docs` experience nested with the app).

**Choose the web dashboard** when you iterate on the UI from source, run CI builds, or host the bundle on an internal static file server.

**Choose a remote daemon** when the **agents run on another machine** (VPS, shared dev box). The dashboard is then just a **client**; see [Getting started: remote daemon](getting-started-remote-daemon.md).

---

## Ports you will see most often

| Port | Service |
|------|---------|
| **4000** | Daemon HTTP + WebSocket (`/stream`) |
| **5173** | Vite dev server (Solid UI) |

Desktop dev still assumes the **Solid dev server** is up on **5173** unless you change Tauri’s `devUrl`.

---

## Data locality

The daemon reads **session files on the machine where it executes**. The dashboard never replaces that: it **displays** what the daemon provides. If you need visibility into agents on **your laptop**, you usually run a daemon **on that laptop** (or ship transcripts to a controlled server—out of scope for this short explainer).

---

## Related

- [Getting started: Desktop](getting-started-desktop.md)
- [Getting started: Web on your machine](getting-started-daemon-web.md)
- [Security and data boundaries](security-for-reviewers.md)
