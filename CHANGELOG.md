# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-04-07

First public release of Pharos — AI agent observability for your terminal.

**Landing page:** <https://pharos-olive.vercel.app/>

### Added

#### Daemon (`apps/daemon-rs`)
- Rust daemon that scans `~/.claude/sessions/` (and Cursor, Codex, Gemini transcripts) for active AI agent sessions and tails their JSONL transcripts in real time.
- WebSocket event streaming on port 4000 — pushes `EventEnvelope` updates to connected dashboards.
- Agent registry with lifecycle tracking: discovers agents, resolves parent-child hierarchies, and maintains per-agent metadata.
- Tool-usage-based role inference for subagents — classifies agents as developer, explorer, runner, browser, orchestrator, planner, reviewer, designer, deployer, integrator, or analyst based on their tool call patterns.
- Granular lifecycle statuses derived from event types: `active`, `idle`, `error`, `stopped`.
- `subagent_type` extraction from Cursor agent profiles for precise role labeling.

#### Dashboard (`apps/client-solid`)
- SolidJS real-time dashboard connecting to the daemon via WebSocket.
- Design system with Tailwind CSS v4: CSS variable tokens, dark theme, accessible contrast.
- Agent naming with "Runtime (Role)" format — e.g. "Cursor (Explorer)", "Cursor (Developer)".
- Agent graph: hierarchical SVG visualization with org-chart style edges, zoom/pan, hover highlights, status dots with pulse animation for active agents, and event counts.
- Sidebar: project tree with collapsible sessions, single-line density rows, status badges, "Show N more" toggle for inactive sessions.
- In-app documentation portal with markdown rendering, sidebar navigation, and Mermaid diagram support.
- Agent attention hints and activity state resolution from event history.

#### Desktop (`apps/desktop`)
- Tauri 2 desktop shell wrapping the SolidJS dashboard — ships as `Pharos.app` (macOS), with Linux and Windows targets in CI.
- Green-on-dark Pharos mark app icons generated for all platforms (macOS `.icns`, Windows `.ico`, iOS, Android, Windows Store).
- `PHAROS.DESKTOP` branding in the header when running inside the Tauri shell.
- In-app documentation viewer at `/docs` with sidebar, search, and bundled content.

#### Landing Page (`apps/landing-svelte`)
- Svelte + Vite marketing site with terminal-aesthetic design.
- Light/dark theme toggle with design tokens.
- Responsive layout: hero section, feature highlights, "How it works" walkthrough, and quickstart commands.
- GitHub Actions CI for automated deployment.

#### Infrastructure
- MIT license and `CONTRIBUTING.md` contributor guide.
- `Makefile` with `make daemon`, `make client`, `make test` quickstart targets.
- GitHub Actions: `release-desktop.yml` matrix-builds macOS (aarch64 + x86_64), Linux, Windows on `v*.*.*` tags and attaches bundles to draft GitHub Releases.
- Version alignment CI guards (`scripts/release/verify_desktop_versions.py`) ensuring `package.json`, `tauri.conf.json`, and `Cargo.toml` stay in sync with tags.
- `CLAUDE.md` and `AGENTS.md` for AI-assisted development context.

[0.1.0]: https://github.com/akushniruk/pharos/releases/tag/v0.1.0
