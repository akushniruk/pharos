# Releases — GitHub (desktop + repo)

**Policy (board-approved):** Ship **semantic version tags** (`vMAJOR.MINOR.PATCH`). Open GitHub Releases as **drafts** first, **smoke-test draft artifacts** (install/boot/critical paths), then publish once **board QA** signs off. This matches our **GitHub-first** channel policy ([PHA-35](/PHA/issues/PHA-35), [PHA-37](/PHA/issues/PHA-37)).

**Release copy:** Paste-ready body and voice live in [docs/gtm/github-release-desktop-template.md](gtm/github-release-desktop-template.md) ([PHA-45](/PHA/issues/PHA-45)).

---

## CTO / release owner workflow

1. **Changelog** — Before tagging, ensure [CHANGELOG.md](../CHANGELOG.md) has an `[Unreleased]` section updated for anything user-visible in this ship (move into a dated `## [vX.Y.Z]` section when you cut the tag).
2. **Desktop version** — Bump **all three** to `X.Y.Z` together: [`apps/desktop/package.json`](../apps/desktop/package.json), [`apps/desktop/src-tauri/tauri.conf.json`](../apps/desktop/src-tauri/tauri.conf.json), and [`apps/desktop/src-tauri/Cargo.toml`](../apps/desktop/src-tauri/Cargo.toml) (`[package].version`). From the repo root, `python3 scripts/release/verify_desktop_versions.py` must pass; with `GITHUB_REF=refs/tags/vX.Y.Z` in the environment it also confirms the tag matches the manifests (same check runs in CI and at the start of [`.github/workflows/release-desktop.yml`](../.github/workflows/release-desktop.yml)).
3. **Tag** — Create an annotated tag `vX.Y.Z` on the commit you intend to ship (CI should key off tags per [PHA-46](/PHA/issues/PHA-46) automation).
4. **Draft release** — GitHub Release: target the tag, **save as draft**, attach CI-built artifacts, paste body from the template (or summarize from CHANGELOG).
5. **Smoke (Engineering)** — Install from **draft** assets on a clean machine/VM; verify version string, startup, and the checklist [Engineer](/PHA/agents/engineer) maintains for desktop ([PHA-46](/PHA/issues/PHA-46)).
6. **Notify CEO (opens board window)** — When the **draft** Release and installers are up, **@CEO** on [PHA-44](/PHA/issues/PHA-44) **or** comment there with the **draft Release URL** so the board smoke can start ([CEO ack](/PHA/issues/PHA-44#comment-30eefbf6-b678-47be-9887-93d4389a808a)).
7. **Board QA** — **CEO coordinates the board** to run installer smoke (CEO does not have to run installers personally — delegates execution). CEO replies on [PHA-44](/PHA/issues/PHA-44) with **approved** or **changes needed**. Do **not** flip draft → public until that reply lands.
8. **Publish** — Mark the Release public; optional X thread bullets still deep-link to GitHub only (see template).

---

## Dependencies (open tracks)

- **Icons:** Square master: [`assets/brand/pharos-mark-square.svg`](../assets/brand/pharos-mark-square.svg). Regenerate platform sets from `apps/desktop`: `npx tauri icon ../../assets/brand/pharos-mark-square.svg` (Tauri’s SVG parser rejects XML `<!-- comments -->` in the source file). UX track: [PHA-47](/PHA/issues/PHA-47) / [UXDesigner](/PHA/agents/uxdesigner).
- **Automation:** On `v*.*.*` tags, [`.github/workflows/release-desktop.yml`](../.github/workflows/release-desktop.yml) verifies manifest versions against the tag, then builds `apps/desktop` and opens a **draft** GitHub Release with a body derived from [CHANGELOG.md](../CHANGELOG.md). [Desktop CI](../.github/workflows/ci-desktop.yml) runs the same manifest check on PRs. Engineer: [PHA-46](/PHA/issues/PHA-46); coordination: [CTO](/PHA/agents/cto).

---

## Links

- Parent epic: [PHA-44](/PHA/issues/PHA-44)
- Desktop template: [github-release-desktop-template.md](gtm/github-release-desktop-template.md)
