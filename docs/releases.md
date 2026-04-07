# Releases — GitHub (desktop + repo)

**Policy:** Ship **semantic version tags** (`vMAJOR.MINOR.PATCH`). Open GitHub Releases as **drafts** first, **smoke-test draft artifacts** (install, boot, critical paths), run **maintainer QA**, then publish. Distribution and narrative stay **GitHub-first** (README, `docs/`, Releases).

**Release copy:** Paste-ready body and voice live in [docs/github-release-desktop-template.md](github-release-desktop-template.md).

---

## Release owner workflow

1. **Changelog** — Before tagging, ensure [CHANGELOG.md](../CHANGELOG.md) has an `[Unreleased]` section updated for anything user-visible in this ship (move into a dated `## [vX.Y.Z]` section when you cut the tag).
2. **Desktop version** — Bump **all three** to `X.Y.Z` together: [`apps/desktop/package.json`](../apps/desktop/package.json), [`apps/desktop/src-tauri/tauri.conf.json`](../apps/desktop/src-tauri/tauri.conf.json), and [`apps/desktop/src-tauri/Cargo.toml`](../apps/desktop/src-tauri/Cargo.toml) (`[package].version`). From the repo root, `python3 scripts/release/verify_desktop_versions.py` must pass; with `GITHUB_REF=refs/tags/vX.Y.Z` in the environment it also confirms the tag matches the manifests (same check runs in CI and at the start of [`.github/workflows/release-desktop.yml`](../.github/workflows/release-desktop.yml)).
3. **Tag** — Create an annotated tag `vX.Y.Z` on the commit you intend to ship.
4. **Draft release** — GitHub Release: target the tag, **save as draft**, attach CI-built artifacts, paste body from the template (or summarize from CHANGELOG).
5. **Smoke** — Install from **draft** assets on a clean machine or VM; verify version string, startup, and your team’s desktop smoke checklist.
6. **Maintainer QA** — Complete any required sign-off your team uses (security, product, or release owner). Do **not** flip draft → public until that is done.
7. **Publish** — Mark the Release public; optional social posts should still deep-link to GitHub (see template).

---

## Dependencies (open tracks)

- **Icons:** Square master: [`assets/brand/pharos-mark-square.svg`](../assets/brand/pharos-mark-square.svg). Regenerate platform sets from `apps/desktop`: `npx tauri icon ../../assets/brand/pharos-mark-square.svg` (Tauri’s SVG parser rejects XML `<!-- comments -->` in the source file).
- **Automation:** On `v*.*.*` tags, [`.github/workflows/release-desktop.yml`](../.github/workflows/release-desktop.yml) verifies manifest versions against the tag, then builds `apps/desktop` and opens a **draft** GitHub Release with a body derived from [CHANGELOG.md](../CHANGELOG.md). [Desktop CI](../.github/workflows/ci-desktop.yml) runs the same manifest check on PRs.

---

## Links

- Desktop release template: [github-release-desktop-template.md](github-release-desktop-template.md)
