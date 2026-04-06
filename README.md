# Pharos

**Pronunciation:** *FAIR-oss* (like “pharaoh,” lighthouse — a signal you can trust.)

> Observable, governable AI coding agents — see what runs on your machine, control it, and ship with proof.

**Canonical external promise (GitHub / releases / threads):** *See what your coding agent does, govern it, and prove it — then ship faster because the system is inspectable.* Strategic hierarchy (security-led, velocity secondary): [docs/gtm/launch-narrative-v1.md](docs/gtm/launch-narrative-v1.md).

Pharos makes **AI coding agents observable and governable** on your machine: see what ran, under what rules, and prove it — so security and platform teams can say **yes** to agents without trading away clarity. Speed follows once the lights are on.

## Who it’s for

- **Security and platform teams** who need audit-friendly visibility into agent execution in real repos.
- **Engineering leads** adopting coding agents without losing reviews, handoffs, and accountability.
- **Developers** who want to understand what an agent did on **their** machine — not just read a chat transcript.

## Why observable agents

Most agent tools optimize for **output**. Pharos focuses on **observability** and **understandability**: durable signals about what ran, with permissions and context you can reason about. That is how you ship with confidence as agents become everyday participants in your workflow — so you always know what is running on your machine and can steer agent use with clarity.

## What you get

- **Observable by default** — surface runs, steps, and outcomes so nothing “mysteriously” edits your project.
- **Built for real workflows** — reviews, handoffs, and accountability — not one-off chats.
- **Confidence at scale** — govern agent use as adoption grows. We lead with **trust, control, and auditability** before “raw speed.” README and GitHub copy variants (including board A/B/C framing) live in [docs/gtm/readme-hero-variants-pha36.md](docs/gtm/readme-hero-variants-pha36.md) and [docs/gtm/board-vote-cheat-sheet-pha36.md](docs/gtm/board-vote-cheat-sheet-pha36.md).

**Canonical surfaces:** this repo (README, `docs/`) and **GitHub Releases** — not a standalone marketing site.

## Get started

- **Star / watch** this repo for releases and default-branch doc updates.
- **Releases & changelog** — [docs/releases.md](docs/releases.md), [CHANGELOG.md](CHANGELOG.md); paste-ready Release body: [docs/gtm/github-release-desktop-template.md](docs/gtm/github-release-desktop-template.md).
- **Desktop app (Tauri)** — `apps/desktop`; `npm ci && npm run tauri build` (Rust **1.88+** via `apps/desktop/src-tauri/rust-toolchain.toml`); icons from `assets/brand/pharos-mark-square.svg` via `npx tauri icon`.
- **MVP observability slice** — [docs/mvp-observability-slice.md](docs/mvp-observability-slice.md).
- **Engineering runbook** — [docs/cto-runbook.md](docs/cto-runbook.md).

## Development

This repo ships **two runnable surfaces**: the **daemon + Solid dashboard** (MVP web stack) and the **Tauri desktop** app. They use different ports and package managers; pick the path you are working on.

### Daemon + web dashboard (`apps/daemon-rs`, `apps/client-solid`)

**What it is:** Rust daemon tails local agent session transcripts and streams events over WebSocket; SolidJS UI is the dashboard. See [CLAUDE.md](CLAUDE.md) for model and session concepts.

**Prerequisites:** **Rust 1.88.0** (repo root [`rust-toolchain.toml`](rust-toolchain.toml); `rustup` picks it up from the repo) and **pnpm** for the client.

**Ports (defaults):** daemon HTTP/WebSocket **`4000`**; Vite dev server **`5173`**. Override with `SERVER_PORT` / `CLIENT_PORT` when invoking `make`.

**Repo-root Makefile** — `make help` lists targets. Common ones:

| Target | Purpose |
| --- | --- |
| `make daemon` | Run `cargo run -- serve` in `apps/daemon-rs` on `SERVER_PORT` |
| `make client` | Run `pnpm dev` in `apps/client-solid` on `CLIENT_PORT` |
| `make dev` / `make up` | Start daemon + client in the background (pid files under `.run/`) |
| `make down` | Stop background daemon + client started by `up`/`dev` |
| `make test` | `cargo test` in `apps/daemon-rs` |
| `make build` | Production build of the Solid client |
| `make health` | `curl` checks against daemon and client ports |
| `make open` | Open `http://localhost:$(CLIENT_PORT)` in the default browser |

**Run locally (foreground)**

```bash
make daemon   # terminal 1 — http://127.0.0.1:4000
make client   # terminal 2 — http://127.0.0.1:5173
```

**CI:** [`.github/workflows/ci-e2e.yml`](.github/workflows/ci-e2e.yml) runs Playwright against `apps/client-solid` when that tree changes. [`.github/workflows/ci-desktop.yml`](.github/workflows/ci-desktop.yml) verifies desktop manifests and runs desktop Playwright tests when `apps/desktop` (or related release scripts) change. Rust daemon coverage is **`make test` locally** for now — there is no dedicated `apps/daemon-rs` workflow in `.github/workflows/` yet.

### Desktop app (Tauri 2 + Vite, `apps/desktop`)

**Prerequisites:** Node.js **20.x** (matches [`.github/workflows/release-desktop.yml`](.github/workflows/release-desktop.yml); npm comes with Node) and **Rust 1.88+**, pinned in [`apps/desktop/src-tauri/rust-toolchain.toml`](apps/desktop/src-tauri/rust-toolchain.toml) (`rustup` uses it automatically when you build from that tree).

**Dev ports:** Tauri loads the Vite app at [`http://localhost:1420`](http://localhost:1420) (`build.devUrl` in [`tauri.conf.json`](apps/desktop/src-tauri/tauri.conf.json), port fixed in [`vite.config.js`](apps/desktop/vite.config.js)). If you set `TAURI_DEV_HOST` for remote dev, Vite uses WebSocket HMR on **1421** for that host.

**Build entrypoint:** [`apps/desktop/package.json`](apps/desktop/package.json) via `npm run …` (see **npm scripts** below).

**npm scripts** (`apps/desktop`): `dev` (Vite only), `build` (production assets), `preview` (serve built assets), `tauri` (CLI passthrough — e.g. `npm run tauri dev`).

**Run locally**

```bash
cd apps/desktop
npm ci
npm run tauri dev
```

In dev, open `http://localhost:1420/docs` for the in-app docs shell.

**Production-style build**

```bash
cd apps/desktop
npm ci
npm run tauri build
```

**Icons** — Regenerate from the canonical square master [`assets/brand/pharos-mark-square.svg`](assets/brand/pharos-mark-square.svg):

```bash
cd apps/desktop
npx tauri icon ../../assets/brand/pharos-mark-square.svg
```

(Tauri’s SVG parser rejects XML `<!-- comments -->` in the source file.)

**Releases:** Ship **semantic version tags** `v*.*.*` per [docs/releases.md](docs/releases.md); [`.github/workflows/release-desktop.yml`](.github/workflows/release-desktop.yml) builds installers and opens a **draft** GitHub Release on those tags.

[![Release desktop (draft)](https://github.com/akushniruk/pharos/actions/workflows/release-desktop.yml/badge.svg)](https://github.com/akushniruk/pharos/actions/workflows/release-desktop.yml)

## Architecture

- **`apps/daemon-rs`** — Rust service: session scan, JSONL tail, WebSocket fan-out; SQLite state (`PHAROS_DAEMON_DB_PATH`). Canonical event shape in [`apps/daemon-rs/src/model.rs`](apps/daemon-rs/src/model.rs).
- **`apps/client-solid`** — SolidJS dashboard (Vite); talks to the daemon on the configured API/WebSocket port.
- **`apps/desktop`** — Tauri 2 shell and Vite UI; bundle identifier `ing.pharos.desktop` ([`tauri.conf.json`](apps/desktop/src-tauri/tauri.conf.json)). Use `npm run dev` for the web asset server only; use `npm run tauri dev` for the full desktop app.
- **`.github/workflows/release-desktop.yml`** — On tags `v*.*.*`, matrix-builds macOS (aarch64 + x86_64), Linux, and Windows and attaches bundles to a **draft** GitHub Release.
- **`scripts/paperclip-run-summary.sh`** — Append-only NDJSON run log helper for local agent/CI workflows; behavior and API checks in [docs/mvp-observability-slice.md](docs/mvp-observability-slice.md) (including run ↔ issue correlation when using a compatible control plane).

### Repository layout (top level)

| Path | Role |
| --- | --- |
| `apps/daemon-rs/` | Rust daemon (WebSocket API, session tailing, SQLite) |
| `apps/client-solid/` | SolidJS + Vite dashboard |
| `apps/desktop/` | Tauri 2 + Vite desktop app (`package.json`, `src/`, `src-tauri/`) |
| `Makefile` | Local dev orchestration for daemon + Solid client (ports 4000 / 5173) |
| `docs/` | Product and engineering docs (releases, runbook pointer, MVP slice, design) |
| `scripts/` | Workspace utilities (e.g. run summary NDJSON helper) |
| `.github/workflows/` | CI/CD (`release-desktop.yml`, etc.) |
| `assets/brand/` | Canonical brand assets (e.g. square mark for `tauri icon`) |
| `site/` | Static reference pages (e.g. onboarding copy), not the shipped desktop bundle |

## Documentation

| Topic | Doc |
| --- | --- |
| Releases: tags, drafts, smoke, QA checklist | [docs/releases.md](docs/releases.md) |
| GitHub Release body template (desktop) | [docs/gtm/github-release-desktop-template.md](docs/gtm/github-release-desktop-template.md) |
| MVP observability slice + API verification | [docs/mvp-observability-slice.md](docs/mvp-observability-slice.md) |
| CTO / engineering runbook | [docs/cto-runbook.md](docs/cto-runbook.md) |
| Changelog | [CHANGELOG.md](CHANGELOG.md) |
| Brand / naming exploration | [docs/gtm/brand-naming-candidates-v1.md](docs/gtm/brand-naming-candidates-v1.md) |
| Graph UI spec | [docs/design/graph-view-pro-ui-spec.md](docs/design/graph-view-pro-ui-spec.md) |
| In-app `/docs` UX spec (shell / desktop) | [docs/design/docs-page-ux-spec.md](docs/design/docs-page-ux-spec.md) |
| Public `/docs` IA & page outlines (handoff for site build) | [docs/site/docs-ia-content-outline-v1.md](docs/site/docs-ia-content-outline-v1.md) |

## Contributing

1. **User-visible changes** — Add an entry under `[Unreleased]` in [CHANGELOG.md](CHANGELOG.md) when the change belongs in release notes.
2. **Releases** — Follow [docs/releases.md](docs/releases.md): bump the three desktop version fields together (see runbook), run `python3 scripts/release/verify_desktop_versions.py`, then tag, draft Release, run engineering smoke and release QA from the checklist, then publish.
3. **Pull requests** — Use clear titles; link tracking issues in descriptions when your workflow uses them; keep `make test` and desktop builds green with the pinned Rust toolchain(s).

## License

Add a `LICENSE` file at the repository root before broad public distribution. Until then, third-party licenses for development dependencies live under `apps/desktop/node_modules`.

## In this repository

- **Hero copy reference (paste deck):** [site/onboarding-homepage.html](site/onboarding-homepage.html) — aligned with onboarding strings in `docs/gtm/`.
- **Brand naming (Pharos vs alternatives):** [docs/gtm/brand-naming-candidates-v1.md](docs/gtm/brand-naming-candidates-v1.md).
- **Maintenance** — This README is curated alongside engineering and GTM docs under `docs/`; default-branch changes land via normal review and release flow in [docs/releases.md](docs/releases.md).
