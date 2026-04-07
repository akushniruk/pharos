# Install Pharos Desktop

The Pharos desktop shell is a **Tauri 2** app under `apps/desktop` in this repository.

## Run locally (development)

From the repository root:

```bash
cd apps/desktop
npm ci
npm run tauri dev
```

The Solid dev server runs at `http://localhost:5173` by default; Tauri’s `devUrl` points there while developing (same port as `make client` in the repo root).

## Production-style build

```bash
cd apps/desktop
npm ci
npm run tauri build
```

## Icons

Regenerate platform icons from the canonical square mark:

```bash
cd apps/desktop
npm run icons
```

(`npm run icons` runs `tauri icon` on `assets/brand/pharos-mark-square.svg` relative to the repository root. If the CLI rejects an SVG, try stripping comments or simplifying the file.)

## Where data lives

High-level: workspace-local artifacts (for example Paperclip run logging used in the MVP slice) stay on disk under your project; see [The observability slice](/docs/concepts/observability-slice) for the current vertical slice.

**More:** [Releases and upgrades](/docs/guides/releases-and-upgrades)
