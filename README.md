# Pharos

**Pronunciation:** *FAIR-oss* (like “pharaoh,” lighthouse — a signal you can trust.)

> Observable, governable AI coding agents — see what runs on your machine, control it, and ship with proof.

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
- **Confidence at scale** — govern agent use as adoption grows. We lead with **trust, control, and auditability** before “raw speed” ([PHA-36](/PHA/issues/PHA-36) narrative frame; paste-ready copy blocks in [docs/gtm/readme-hero-variants-pha36.md](docs/gtm/readme-hero-variants-pha36.md); **board A/B/C cheat sheet** in [docs/gtm/board-vote-cheat-sheet-pha36.md](docs/gtm/board-vote-cheat-sheet-pha36.md)).

**Canonical surfaces:** this repo (README, `docs/`) and **GitHub Releases** — not a standalone marketing site ([PHA-35](/PHA/issues/PHA-35), [PHA-37](/PHA/issues/PHA-37)).

## Get started

- **Star / watch** this repo for releases and default-branch doc updates.
- **Releases & changelog** — [docs/releases.md](docs/releases.md), [CHANGELOG.md](CHANGELOG.md); paste-ready Release body: [docs/gtm/github-release-desktop-template.md](docs/gtm/github-release-desktop-template.md) ([PHA-44](/PHA/issues/PHA-44), [PHA-45](/PHA/issues/PHA-45)).
- **Desktop app (Tauri)** — `apps/desktop`; `npm ci && npm run tauri build` (Rust **1.88+** via `apps/desktop/src-tauri/rust-toolchain.toml`); icons from `assets/brand/pharos-mark-square.svg` via `npx tauri icon` ([PHA-46](/PHA/issues/PHA-46)).
- **MVP observability slice** — [docs/mvp-observability-slice.md](docs/mvp-observability-slice.md).
- **Engineering runbook** — [docs/cto-runbook.md](docs/cto-runbook.md) (Paperclip document: [PHA-4](/PHA/issues/PHA-4#document-engineering-runbook)).

## Development

**Desktop app (Tauri 2 + Vite)** lives in `apps/desktop`.

**Prerequisites:** Node.js **20.x** (matches [`.github/workflows/release-desktop.yml`](.github/workflows/release-desktop.yml); npm comes with Node) and **Rust 1.88+**, pinned in [`apps/desktop/src-tauri/rust-toolchain.toml`](apps/desktop/src-tauri/rust-toolchain.toml) (`rustup` uses it automatically when you build from that tree).

**Build entrypoint:** There is no repo-root `Makefile`; desktop work is driven from [`apps/desktop/package.json`](apps/desktop/package.json) via `npm run …` (see **npm scripts** below).

**Dev ports:** In dev, Tauri loads the Vite app at [`http://localhost:1420`](http://localhost:1420) (`build.devUrl` in [`tauri.conf.json`](apps/desktop/src-tauri/tauri.conf.json), port fixed in [`vite.config.js`](apps/desktop/vite.config.js)). If you set `TAURI_DEV_HOST` for remote dev, Vite uses WebSocket HMR on **1421** for that host.

**npm scripts** (`apps/desktop`): `dev` (Vite only), `build` (production assets), `preview` (serve built assets), `tauri` (CLI passthrough — e.g. `npm run tauri dev`).

**Run locally**

```bash
cd apps/desktop
npm ci
npm run tauri dev
```

In dev, open `http://localhost:1420/docs` for the in-app docs shell ([PHA-56](/PHA/issues/PHA-56)).

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

[![Release desktop (draft)](https://github.com/akushniruk/pharos/actions/workflows/release-desktop.yml/badge.svg)](https://github.com/akushniruk/pharos/actions/workflows/release-desktop.yml)

## Architecture

- **`apps/desktop`** — Tauri 2 shell and Vite UI; bundle identifier `ing.pharos.desktop` ([`tauri.conf.json`](apps/desktop/src-tauri/tauri.conf.json)). Use `npm run dev` for the web asset server only; use `npm run tauri dev` for the full desktop app.
- **`.github/workflows/release-desktop.yml`** — On tags `v*.*.*`, matrix-builds macOS (aarch64 + x86_64), Linux, and Windows and attaches bundles to a **draft** GitHub Release ([PHA-46](/PHA/issues/PHA-46)).
- **`scripts/paperclip-run-summary.sh`** — Append-only NDJSON run log for Paperclip-connected agents; behavior and API checks in [docs/mvp-observability-slice.md](docs/mvp-observability-slice.md) (including **M1** run ↔ issue correlation via the control plane).

### Repository layout (top level)

| Path | Role |
| --- | --- |
| `apps/desktop/` | Tauri 2 + Vite desktop app (`package.json`, `src/`, `src-tauri/`) |
| `docs/` | Product and engineering docs (releases, runbook pointer, MVP slice, design) |
| `scripts/` | Workspace utilities (e.g. Paperclip run summary NDJSON) |
| `.github/workflows/` | CI/CD (`release-desktop.yml`, etc.) |
| `assets/brand/` | Canonical brand assets (e.g. square mark for `tauri icon`) |
| `site/` | Static reference pages (e.g. onboarding copy), not the shipped desktop bundle |

## Documentation

| Topic | Doc |
| --- | --- |
| Releases: tags, drafts, smoke, board QA | [docs/releases.md](docs/releases.md) ([PHA-44](/PHA/issues/PHA-44)) |
| GitHub Release body template (desktop) | [docs/gtm/github-release-desktop-template.md](docs/gtm/github-release-desktop-template.md) ([PHA-45](/PHA/issues/PHA-45)) |
| MVP observability slice + API verification | [docs/mvp-observability-slice.md](docs/mvp-observability-slice.md) |
| CTO / engineering runbook | [docs/cto-runbook.md](docs/cto-runbook.md) ([PHA-4](/PHA/issues/PHA-4#document-engineering-runbook)) |
| Changelog | [CHANGELOG.md](CHANGELOG.md) |
| Brand / naming exploration | [docs/gtm/brand-naming-candidates-v1.md](docs/gtm/brand-naming-candidates-v1.md) ([PHA-38](/PHA/issues/PHA-38)) |
| Graph UI spec | [docs/design/graph-view-pro-ui-spec.md](docs/design/graph-view-pro-ui-spec.md) |
| In-app `/docs` UX spec (shell / desktop) | [docs/design/docs-page-ux-spec.md](docs/design/docs-page-ux-spec.md) ([PHA-57](/PHA/issues/PHA-57)) |
| Public `/docs` IA & page outlines (handoff for site build) | [docs/site/docs-ia-content-outline-v1.md](docs/site/docs-ia-content-outline-v1.md) ([PHA-55](/PHA/issues/PHA-55)) |

## Contributing

1. **User-visible changes** — Add an entry under `[Unreleased]` in [CHANGELOG.md](CHANGELOG.md) when the change belongs in release notes.
2. **Releases** — Follow [docs/releases.md](docs/releases.md): bump the three desktop version fields together (see runbook), run `python3 scripts/release/verify_desktop_versions.py`, then tag, draft Release, engineering smoke, board QA on [PHA-44](/PHA/issues/PHA-44), then publish.
3. **Pull requests** — Use clear titles; link issues with `[PHA-NN](/PHA/issues/PHA-NN)` when helpful; keep desktop builds working with the pinned Rust toolchain.

## License

Add a `LICENSE` file at the repository root before broad public distribution. Until then, third-party licenses for development dependencies live under `apps/desktop/node_modules`.

## In this repository

- **Hero copy reference (paste deck):** [site/onboarding-homepage.html](site/onboarding-homepage.html) — approved strings aligned with [PHA-15](/PHA/issues/PHA-15#comment-90c579de-c094-43e1-bad5-15c64bae0de2).
- **Brand naming (Pharos vs alternatives):** [docs/gtm/brand-naming-candidates-v1.md](docs/gtm/brand-naming-candidates-v1.md) ([PHA-38](/PHA/issues/PHA-38)).
- **README refresh traceability** — Epic [PHA-50](/PHA/issues/PHA-50): technical + layout [PHA-51](/PHA/issues/PHA-51), product narrative [PHA-52](/PHA/issues/PHA-52), engineering fact pass [PHA-53](/PHA/issues/PHA-53). This file is the **Paperclip Pharos project primary workspace** root; GitHub or other clones may lag until those changes are merged and pushed from the authoritative git remote.
