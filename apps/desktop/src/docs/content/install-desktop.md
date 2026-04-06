# Install Pharos Desktop

The Pharos desktop shell is a **Tauri 2** app under `apps/desktop` in this repository.

## Run locally (development)

From the repository root:

```bash
cd apps/desktop
npm ci
npm run tauri dev
```

Vite serves the UI at `http://localhost:1420` in dev; Tauri loads that URL while developing.

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
npx tauri icon ../../assets/brand/pharos-mark-square.svg
```

(Tauri’s SVG parser rejects XML comments in the source file.)

## Where data lives

High-level: workspace-local artifacts (for example Paperclip run logging used in the MVP slice) stay on disk under your project; see [The observability slice](/docs/concepts/observability-slice) for the current vertical slice.

**More:** [Releases and upgrades](/docs/guides/releases-and-upgrades)
