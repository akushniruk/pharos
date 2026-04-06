# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Release notes for **public** desktop builds should summarize from here into the GitHub Release body using [docs/gtm/github-release-desktop-template.md](docs/gtm/github-release-desktop-template.md). See [docs/releases.md](docs/releases.md) for the draft → smoke → board QA → publish workflow ([PHA-44](/PHA/issues/PHA-44)).

## [Unreleased]

### Added

- `scripts/release/verify_desktop_versions.py` plus CI / release-workflow guards so `package.json`, `tauri.conf.json`, and `Cargo.toml` stay aligned and match `v*.*.*` tags before draft GitHub Releases build ([PHA-72](/PHA/issues/PHA-72)).
- In-app documentation at `/docs` in the desktop Vite shell: SPA routing, sidebar + primary nav aligned with [PHA-55](/PHA/issues/PHA-55) IA, markdown rendering (`marked`), filterable page list, and bundled imports for `docs/mvp-observability-slice.md` and root `CHANGELOG.md` ([PHA-56](/PHA/issues/PHA-56)).
- Tauri 2 desktop shell at `apps/desktop` (Vite + `ing.pharos.desktop` bundle id) with Pharos icons generated from `assets/brand/pharos-mark-square.svg` (canonical square master also at `icons/source/app-icon.svg`).
- GitHub Actions workflow `release-desktop.yml`: on `v*.*.*` tags, matrix-build macOS (aarch64 + x86_64), Linux, Windows and attach bundles to a **draft** Release; release body from matching `CHANGELOG` section plus policy footer.
- Changelog skeleton and release workflow docs for GitHub-first shipping.

### Changed

- Desktop `/docs` UX: denser sidebar nav, readable article measure (~72ch) and heading scale, skip link, in-page TOC with scroll-aware highlight, mobile slide-in drawer + backdrop (Docs menu), loading skeletons for article and TOC, and clearer missing-page copy — aligned with [docs/design/docs-page-ux-spec.md](docs/design/docs-page-ux-spec.md) ([PHA-58](/PHA/issues/PHA-58)).
- README: clearer engineering setup — Node 20 (CI-aligned), dev URLs/ports for Vite + Tauri, npm scripts, no root Makefile, and a top-level repository layout table.

### Deprecated

### Removed

### Fixed

### Security

---

<!-- When cutting vX.Y.Z: rename [Unreleased] above, add date, start a fresh [Unreleased]. Example:

## [0.1.0] - 2026-04-06

### Added
- Initial public description of changes.

[Unreleased]: https://github.com/akushniruk/pharos/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/akushniruk/pharos/releases/tag/v0.1.0
-->
