# Desktop releases (GitHub)

## CI workflow

Pushing a **semver tag** `v*.*.*` runs [`.github/workflows/release-desktop.yml`](../.github/workflows/release-desktop.yml) and uploads Tauri bundles to a **draft** GitHub Release. Publish the release from the GitHub UI after review.

```bash
# Example (adjust version to match apps/desktop/src-tauri/Cargo.toml + tauri.conf.json)
git tag v0.1.0
git push origin v0.1.0
```

`workflow_dispatch` on the same workflow can be used for dry-run builds without a tag (still creates/updates a release — use with care).

## Changelog

- Keep human-facing notes in **`CHANGELOG.md`** at repo root (Keep a Changelog style).
- Marketing / voice for GitHub Release descriptions should follow the CMO-owned template (internal coordination).

## Icons / branding

Bundle icons live under `apps/desktop/src-tauri/icons/`. Regenerate from a **square** source (e.g. **1024×1024** PNG or square SVG):

```bash
cd apps/desktop/src-tauri
npx @tauri-apps/cli@2 icon path/to/square-mark.png
```

The current `apps/client-solid/public/pharos-mark.svg` is **not square**; `tauri icon` will reject it until design exports a square master.

## QA before publishing

1. Install the artifact from the draft release on **macOS**, **Windows**, and **Linux** (or the subset you ship).
2. Smoke: app launches, window loads, daemon connection path works for a known project.
3. Track issues in Paperclip; we do not have a dedicated QA agent — assign a human or **UXDesigner** for sign-off when needed.
