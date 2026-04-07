# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Release notes for **public** desktop builds should summarize from here into the GitHub Release body using [docs/github-release-desktop-template.md](docs/github-release-desktop-template.md). See [docs/releases.md](docs/releases.md) for the draft, smoke-test, maintainer QA, and publish workflow.

## [Unreleased]

### Added

- `docs/documentation-versioning.md` — how bundled docs map to app semver; sidebar, article banner, and browser tab show **Docs vX.Y.Z** from `apps/client-solid/package.json` via `src/lib/docsVersion.ts`.
- `docs/architecture-how-it-works.md` — docs portal section **How it works** with Mermaid figures (local, desktop, remote, normalization); in-app markdown renders Mermaid fences via the `mermaid` package.
- `docs/positioning.md` — public security-led positioning summary for README and maintainers.
- `apps/landing-svelte/README.md` — Pharos-specific maintainer notes (commands + CI pointer) replacing the Vite template text.
- Audience-first docs: getting started (Desktop, local web, remote daemon), desktop vs web explainer, security reviewer brief, sessions/events overview; contributing material grouped in the in-app portal sidebar.

### Changed

- Docs hub (**Docs overview**): first-class runtime section with **Simple Icons**-derived vendor marks (CC0) in `apps/client-solid/public/docs-supported/`; in-app markdown resolves `![alt](path)` with `import.meta.env.BASE_URL`. **AGENTS.md** current-version line set to **0.1.0**.
- Docs portal **Contributing** sidebar: removed MVP observability slice, macOS/GitHub release runbooks, Playwright guide, and graph UX spec from navigation (files remain; README documentation table still links them). Removed the **Local dev commands** block from the docs sidebar; use `README.md` and `CONTRIBUTING.md` for `make` targets.
- Docs portal: dropped **Docs shell UX spec** from the Contributing sidebar — the spec stays at `docs/design/docs-page-ux-spec.md` for implementers (README + `specs/` still link it).
- Docs portal navigation and `docs/README.md` now list only public engineering docs; internal planning and GTM markdown trees removed from the repository.
- Root README: documentation table points to public paths; release template at `docs/github-release-desktop-template.md`.
- In-app visitor docs under `apps/desktop/src/docs/content/` no longer reference removed internal doc paths.
- Docs sidebar: section subtitles for audiences; optional file paths only on contributor entries.

### Deprecated

### Removed

- `docs/cto-runbook.md` — redundant maintainer pointer; use `CONTRIBUTING.md` and `docs/releases.md` instead.
- `docs/multi-agent-team-setup.md` — internal role-orchestration doc; FE/BE payload guidance lives in `CONTRIBUTING.md` instead.

### Fixed

### Security

## [0.1.0] - 2026-04-06

First tagged desktop release (`v0.1.0`); triggers draft GitHub Release builds per `release-desktop.yml`.

### Added

- Root **`LICENSE`** (MIT) and **`CONTRIBUTING.md`** contributor guide.
- README hero visuals: architecture-flow SVG and optional UI screenshot-frame placeholder under `assets/readme/`.
- `scripts/release/verify_desktop_versions.py` plus CI / release-workflow guards so `package.json`, `tauri.conf.json`, and `Cargo.toml` stay aligned and match `v*.*.*` tags before draft GitHub Releases build.
- In-app documentation at `/docs` in the desktop Vite shell: SPA routing, sidebar + primary nav, markdown rendering (`marked`), filterable page list, and bundled imports for `docs/mvp-observability-slice.md` and root `CHANGELOG.md`.
- Tauri 2 desktop shell at `apps/desktop` (Vite + `ing.pharos.desktop` bundle id) with Pharos icons generated from `assets/brand/pharos-mark-square.svg` (canonical square master also at `icons/source/app-icon.svg`).
- GitHub Actions workflow `release-desktop.yml`: on `v*.*.*` tags, matrix-build macOS (aarch64 + x86_64), Linux, Windows and attach bundles to a **draft** Release; release body from matching `CHANGELOG` section plus policy footer.
- Changelog skeleton and release workflow docs for GitHub-first shipping.

### Changed

- README: drop the **Pronunciation** line from the hero; point **Contributing** and **License** to `CONTRIBUTING.md` and `LICENSE`.
- Docs portal index, root README, in-app `/docs` home and “What is Pharos?”, and `site/onboarding-homepage.html` meta/subhead aligned with security-first positioning.
- Desktop `/docs` UX: denser sidebar nav, readable article measure (~72ch) and heading scale, skip link, in-page TOC with scroll-aware highlight, mobile slide-in drawer + backdrop (Docs menu), loading skeletons for article and TOC, and clearer missing-page copy — aligned with [docs/design/docs-page-ux-spec.md](docs/design/docs-page-ux-spec.md).
- README: engineering-factual dev docs — root `Makefile` targets and ports **4000** / **5173** for daemon + Solid client, split from Tauri desktop (**1420**), accurate CI pointers (`ci-e2e`, `ci-desktop`), `v*.*.*` release policy cross-link, and layout rows for `apps/daemon-rs` + `apps/client-solid`.
- README: narrative fold (What is Pharos, Without/With, “Why observability first”, table-style **What Pharos is not**), top badge row, single **Quickstart** path with explicit `#desktop-development` anchor for the Desktop section cross-link.

### Deprecated

### Removed

### Fixed

### Security

[Unreleased]: https://github.com/akushniruk/pharos/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/akushniruk/pharos/releases/tag/v0.1.0
