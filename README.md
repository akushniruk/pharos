# Pharos

[Quickstart](#quickstart) · [Architecture](#architecture) · [Documentation](#documentation) · [Contributing](#contributing)

[![Release desktop (draft)](https://github.com/akushniruk/pharos/actions/workflows/release-desktop.yml/badge.svg)](https://github.com/akushniruk/pharos/actions/workflows/release-desktop.yml)

## What is Pharos?

Pharos is a **local observability layer** for AI coding agents: a Rust daemon tails agent session transcripts on your machine, normalizes them into a stream of events, and a Solid dashboard (or desktop shell) shows what ran — with enough structure to review, hand off, and prove what happened.

**In one line:** your agent’s chat is the *conversation*; Pharos is the **flight recorder** for what it actually did in your repos and environments.

Strategic hierarchy and external-facing promise (security-led, velocity secondary): [docs/gtm/launch-narrative-v1.md](docs/gtm/launch-narrative-v1.md).

## Who it’s for

- **Security and platform teams** who need inspectable evidence of agent activity on real developer machines — not screenshots of a thread.
- **Engineering leads** rolling out coding agents without losing accountability, review habits, or change control.
- **Builders** who run agents daily and want a **durable signal** of sessions, steps, and outcomes across restarts.

## What you get

- **A live view of agent sessions** wired to local transcript sources — see activity as structured events, not lost buffer history.
- **A path to governance-friendly workflows** — pair visibility with how your org already reviews and ships (handoffs, checklists, release discipline).
- **Two ways to run it** — lightweight **daemon + web UI** for iteration; **Tauri desktop** when you want a packaged app and in-app docs.
- **Docs and releases as the canonical story** — README + `docs/` + GitHub Releases stay the source of truth for the product. An optional **static marketing** shell lives under [`apps/landing-svelte/`](apps/landing-svelte/) for deploy experiments; it does not replace those surfaces.

**Brand and naming (internal decision support):** compare options and paste-ready README heroes in [docs/gtm/brand-naming-candidates-v1.md](docs/gtm/brand-naming-candidates-v1.md), [docs/gtm/readme-hero-variants-pha36.md](docs/gtm/readme-hero-variants-pha36.md), and [docs/gtm/board-vote-cheat-sheet-pha36.md](docs/gtm/board-vote-cheat-sheet-pha36.md). **Canonical public surfaces:** this repository and **GitHub Releases** — positioning narrative in [docs/gtm/launch-narrative-v1.md](docs/gtm/launch-narrative-v1.md).

## The problem

| Without a local observability layer | With Pharos |
| --- | --- |
| Agent work disappears into chat scrollback and scattered logs | Sessions and events stay **addressable** — skim, search, and trace what happened |
| Hard to answer “what ran, where, and under what assumptions?” | **Structured events** from transcripts make behavior legible |
| Tooling optimizes for *output*; risk and compliance need *evidence* | **Observable by default** so teams can say yes without flying blind |
| Every developer reinvents “tail this folder, grep JSONL…” | One daemon + dashboard **convention** for the workspace |

## Why observability first

| Principle | What it means in Pharos |
| --- | --- |
| **Local truth** | Reads from **your** session files; you control retention and scope |
| **Event-shaped** | Canonical envelope in `apps/daemon-rs/src/model.rs` — stable enough to build on |
| **Inspectable surface** | WebSocket stream + UI — humans can **see** activity, not only automate against it |
| **Ship-ready discipline** | Fits release checklists and engineering runbooks already in `docs/` |

## What Pharos is not

| It is not… | Because… |
| --- | --- |
| A replacement for your agent product | It **observes** sessions; it doesn’t compete with Claude, Codex, Cursor, etc. |
| A hosted SaaS control plane | Core flow is **local**: daemon + your filesystem context |
| A full policy engine (yet) | It helps you **see** behavior; orgs layer policy where they already enforce it |
| A single chat window | It’s a **dashboard + stream** for runs across sessions |
| Magic compliance in a box | It’s the **evidence layer** — you still define what “good” means |

## Quickstart

**Prerequisites:** Rust **1.88.0** (repo [`rust-toolchain.toml`](rust-toolchain.toml)) and **pnpm** for the client.

```bash
git clone https://github.com/akushniruk/pharos.git
cd pharos
make daemon   # terminal 1 — daemon on :4000
make client   # terminal 2 — dashboard on :5173
```

Open `http://127.0.0.1:5173` and watch sessions as the daemon tails local agent transcripts.

**Desktop app:** see [Development → Desktop app](#desktop-development) (Tauri wraps the Solid client; dev server on `:5173`).

**Next:** [Architecture](#architecture) · [MVP observability slice](docs/mvp-observability-slice.md) · [Releases](docs/releases.md)

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

<a id="desktop-development"></a>

### Desktop app (Tauri 2 + Vite, `apps/desktop`)

**Prerequisites:** Node.js **20.x** (matches [`.github/workflows/release-desktop.yml`](.github/workflows/release-desktop.yml); npm comes with Node), **pnpm 9+** (for [`apps/client-solid`](apps/client-solid); enable with `corepack enable`), and **Rust 1.88+**, pinned in [`apps/desktop/src-tauri/rust-toolchain.toml`](apps/desktop/src-tauri/rust-toolchain.toml) (`rustup` uses it automatically when you build from that tree).

**Dev ports:** Tauri loads the Solid dev server at [`http://localhost:5173`](http://localhost:5173) (`build.devUrl` in [`tauri.conf.json`](apps/desktop/src-tauri/tauri.conf.json), same port as `pnpm run dev` in `apps/client-solid`). Optional: set `TAURI_DEV_HOST` for LAN debugging (HMR follows that host).

**Build entrypoint:** [`apps/desktop/package.json`](apps/desktop/package.json) via `npm run …` (see **npm scripts** below).

**npm scripts** (`apps/desktop`): `dev` (Vite only), `build` (production assets), `preview` (serve built assets), `tauri` (CLI passthrough — e.g. `npm run tauri dev`).

**Run locally**

```bash
cd apps/desktop
npm ci
npm run tauri dev
```

In dev, open `http://localhost:5173/docs/…` for the in-app docs portal (same Solid app as the web dashboard).

**Production-style build**

```bash
cd apps/desktop
npm ci
npm run tauri build
```

**Icons** — Regenerate from the canonical square master [`assets/brand/pharos-mark-square.svg`](assets/brand/pharos-mark-square.svg):

```bash
cd apps/desktop
npm run icons
```

(Release CI runs the same step before packaging. If the CLI rejects an SVG, try stripping comments or simplifying the file.)

**Releases:** Ship **semantic version tags** `v*.*.*` per [docs/releases.md](docs/releases.md); [`.github/workflows/release-desktop.yml`](.github/workflows/release-desktop.yml) builds installers and opens a **draft** GitHub Release on those tags.

## Architecture

- **`apps/daemon-rs`** — Rust service: session scan, JSONL tail, WebSocket fan-out; SQLite state (`PHAROS_DAEMON_DB_PATH`). Canonical event shape in [`apps/daemon-rs/src/model.rs`](apps/daemon-rs/src/model.rs).
- **`apps/client-solid`** — SolidJS dashboard (Vite); talks to the daemon on the configured API/WebSocket port.
- **`apps/desktop`** — Tauri 2 shell; bundles the Solid UI from `apps/client-solid`. Bundle identifier `ing.pharos.desktop` ([`tauri.conf.json`](apps/desktop/src-tauri/tauri.conf.json)). Use `npm run tauri dev` for the full desktop app (starts Solid on **5173**). Use `pnpm run dev` in `apps/client-solid` if you only want the browser UI.
- **`.github/workflows/release-desktop.yml`** — On tags `v*.*.*`, matrix-builds macOS (aarch64 + x86_64), Linux, and Windows and attaches bundles to a **draft** GitHub Release.
- **`scripts/paperclip-run-summary.sh`** — Append-only NDJSON run log helper for local agent and CI workflows; behavior and checks in [docs/mvp-observability-slice.md](docs/mvp-observability-slice.md).

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
| Contributing (expectations, dev, PRs) | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Releases: tags, drafts, smoke, QA checklist | [docs/releases.md](docs/releases.md) |
| GitHub Release body template (desktop) | [docs/gtm/github-release-desktop-template.md](docs/gtm/github-release-desktop-template.md) |
| MVP observability slice + API verification | [docs/mvp-observability-slice.md](docs/mvp-observability-slice.md) |
| CTO / engineering runbook | [docs/cto-runbook.md](docs/cto-runbook.md) |
| Changelog | [CHANGELOG.md](CHANGELOG.md) |
| Brand / naming (candidates + vote materials) | [docs/gtm/brand-naming-candidates-v1.md](docs/gtm/brand-naming-candidates-v1.md) · [docs/gtm/board-vote-cheat-sheet-pha36.md](docs/gtm/board-vote-cheat-sheet-pha36.md) |
| Graph UI spec | [docs/design/graph-view-pro-ui-spec.md](docs/design/graph-view-pro-ui-spec.md) |
| In-app `/docs` UX spec (shell / desktop) | [docs/design/docs-page-ux-spec.md](docs/design/docs-page-ux-spec.md) |
| Public `/docs` IA & page outlines (handoff for site build) | [docs/site/docs-ia-content-outline-v1.md](docs/site/docs-ia-content-outline-v1.md) |

## FAQ

- **What runs where?** The **daemon + Solid dashboard** use **4000** (HTTP/WebSocket) and **5173** (Vite) by default (`make daemon` / `make client`). **Tauri desktop** dev uses the **same Solid dev server on 5173** (`npm run tauri dev` under `apps/desktop`). You still need the **daemon on 4000** for live sessions in any shell.
- **Where is “truth” for events and sessions?** Session scan, JSONL tail, WebSocket fan-out, and the canonical event shape live in [`apps/daemon-rs`](apps/daemon-rs) — see [`apps/daemon-rs/src/model.rs`](apps/daemon-rs/src/model.rs) and [docs/mvp-observability-slice.md](docs/mvp-observability-slice.md).
- **How do releases work?** Desktop ships on **semantic version tags** `v*.*.*` with a **draft** GitHub Release and attached bundles — see [docs/releases.md](docs/releases.md) and [CHANGELOG.md](CHANGELOG.md).

## Contributing

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for local setup, tests, pull requests, and release notes expectations.

## License

This project is licensed under the **MIT License** — see [LICENSE](LICENSE).

## In this repository

- **Hero copy reference (paste deck):** [site/onboarding-homepage.html](site/onboarding-homepage.html) — aligned with onboarding strings in `docs/gtm/`.
- **Brand naming (Pharos vs alternatives):** [docs/gtm/brand-naming-candidates-v1.md](docs/gtm/brand-naming-candidates-v1.md), [docs/gtm/readme-hero-variants-pha36.md](docs/gtm/readme-hero-variants-pha36.md), [docs/gtm/board-vote-cheat-sheet-pha36.md](docs/gtm/board-vote-cheat-sheet-pha36.md).
- **Maintenance** — This README is curated alongside engineering and GTM docs under `docs/`; default-branch changes land via normal review and release flow in [docs/releases.md](docs/releases.md).
