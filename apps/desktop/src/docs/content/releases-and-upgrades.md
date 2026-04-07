# Releases and upgrades

## Versioning

Desktop releases follow **semantic versioning** tags (`v*.*.*`) and ship through **GitHub Releases** (draft first, then publish after smoke and maintainer QA — see repository `docs/releases.md` for the full workflow).

## What to expect

- **Draft releases** bundle desktop artifacts for validation before they are broadly announced.
- **Changelog** entries for user-visible changes live in the root `CHANGELOG.md`, mirrored in-app under [Changelog](/docs/changelog).

## Upgrades

When auto-update is productized, this page will document channels and safeguards. Until then, follow release notes attached to each GitHub Release.

**Maintainers:** full process in `docs/releases.md` and `docs/github-release-desktop-template.md`. Before tagging, keep `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml` versions identical and run `python3 scripts/release/verify_desktop_versions.py` from the repo root (CI enforces the same).
