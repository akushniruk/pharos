# Getting started: Daemon on a server (VPS)

**Goal:** Run **pharos-daemon** on a machine that stays online (for example a small VPS) and use the **dashboard** from your laptop browser—or build a static dashboard with API URLs pointed at that host.

**You are:** Someone who wants a **shared** observation point or who keeps agents on a remote dev box.

---

## Mental model

1. **Daemon** — Processes local paths *on the server* (transcripts, agent metadata). It does not magically see your laptop’s files unless they exist on that server.
2. **Dashboard** — A static SPA after `vite build`. At runtime it reads **`VITE_API_URL`** and **`VITE_WS_URL`** (or defaults to the same hostname as the page on port **4000**).

The daemon enables **permissive CORS** today so a dashboard served from another origin (for example Vite on `5173`) can call the API in development. For production you should still put **TLS** and **auth** in front of anything exposed past your tailnet.

---

## 1. Run the daemon on the server

From the built binary or `cargo run -- serve`, ensure:

- It listens on an address reachable by your browser (**`0.0.0.0:4000`** behind a firewall rule, not only loopback, if you connect remotely).
- Session roots on the **server** point at real agent data for that machine.

Example environment variables (names may vary slightly by build—see daemon help):

- `PHAROS_DAEMON_PORT` — TCP port (default **4000**).
- `PHAROS_DAEMON_DB_PATH` — SQLite path for daemon state.

Smoke-test from your laptop:

```bash
curl -sS http://YOUR_HOST:4000/health
```

---

## 2. Point the dashboard at the remote daemon

### Development (Vite)

When running `pnpm dev` in `apps/client-solid`, set:

```bash
export VITE_API_URL=http://YOUR_HOST:4000
export VITE_WS_URL=ws://YOUR_HOST:4000/stream
pnpm dev
```

Use **`wss://`** when TLS terminates in front of the WebSocket.

### Production build

Set the same variables **at build time** (Vite inlines them), then deploy the `dist/` assets:

```bash
VITE_API_URL=https://daemon.example.com VITE_WS_URL=wss://daemon.example.com/stream pnpm run build
```

Open the served `index.html` over **HTTPS** if you use **`wss://`**.

---

## 3. Security checklist (minimum)

- **Do not** expose plain `ws://` + `http://` across the public internet without transport protection.
- Treat the daemon as **sensitive**: it reads agent transcripts. Restrict network access (SSH tunnel, VPN, allow-listed IPs).
- Pharos is **not** a multi-tenant SaaS—plan capacity and disk retention on the server yourself.

---

## Next steps

- [Desktop vs web dashboard](desktop-vs-daemon-web.md) — *why your laptop might still run its own daemon*
- [Security and data boundaries](security-for-reviewers.md)
- [HTTP and WebSocket API](frontend-api-reference.md)
