# Contributing to Pharos

Thanks for helping improve Pharos. This document is the short path to a good PR; deeper architecture notes live in [`CLAUDE.md`](CLAUDE.md) and [`AGENTS.md`](AGENTS.md).

## Prerequisites

- **Rust** — toolchain pinned in [`rust-toolchain.toml`](rust-toolchain.toml); daemon crate under `apps/daemon-rs`.
- **Node.js 22+** and **pnpm** — Solid dashboard under `apps/client-solid`; desktop shell under `apps/desktop`.
- **Make** — primary developer entrypoints (`make help`).

## Local development

```bash
make up      # daemon + dashboard (background)
make test    # Rust tests (workspace)
make down    # stop background services
```

- **Dashboard only:** `cd apps/client-solid && pnpm install && pnpm run dev`
- **Desktop (Tauri):** see [README.md](README.md) and [docs/macos-desktop-release.md](docs/macos-desktop-release.md).

## Before you open a PR

1. **Tests** — `make test` green; for client changes also `cd apps/client-solid && pnpm run test` (and `pnpm run build` if you touch UI).
2. **Changelog** — user-visible fixes/features: add a line under `[Unreleased]` in [CHANGELOG.md](CHANGELOG.md) ([Keep a Changelog](https://keepachangelog.com/) style).
3. **Desktop releases** — if you change shipped versions, follow [docs/releases.md](docs/releases.md) and run `python3 scripts/release/verify_desktop_versions.py` before tagging.

## Pull requests

- Prefer **focused** commits and a clear title; describe *what* and *why*.
- Link issue trackers only when your team uses them for traceability.
- Match style and patterns in surrounding code; avoid drive-by refactors.

## Frontend / backend contract

Graph and event UI depend on normalized daemon events. When changing payloads:

- **Daemon:** prefer **additive** changes for keys the dashboard reads (for example `parent_agent_id`, `agent_id`, `hook_event_type`, and fields under `payload` the client uses).
- **Dashboard:** tolerate missing optional fields and degrade gracefully.

Canonical terms and envelope shape: [`CLAUDE.md`](CLAUDE.md) and `apps/daemon-rs/src/model.rs`.

## License

By contributing, you agree your contributions are licensed under the same terms as this repository ([LICENSE](LICENSE)).

## Private / local-only material

Marketing context, audience briefs, and similar notes are **not** committed to this public repository. Keep them in private notes or gitignored paths (for example under `.agents/`, which is listed in `.gitignore`).
