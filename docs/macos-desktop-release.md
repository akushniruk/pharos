# macOS Desktop Release

This guide covers the first installable Pharos desktop release:

- platform: macOS only
- architecture: Apple Silicon (`aarch64-apple-darwin`)
- artifact: unsigned internal `.dmg`
- product: `Pharos Agent Monitor.app`

This is an internal tester build. It is installable, but macOS will warn on first launch because the app is not signed or notarized yet.

## Build Release

Use the Tauri desktop app in `apps/desktop/src-tauri` as the release entrypoint.

### Requirements

- macOS on Apple Silicon
- Rust 1.85+
- Node.js 22+
- `pnpm`
- `cargo-tauri` v2

Install the Tauri CLI if needed:

```bash
cargo install tauri-cli --version "^2"
```

Install the client dependencies once per clone:

```bash
cd apps/client-solid
pnpm install
```

### Build Command

Run the release build on macOS from the Tauri app directory:

```bash
cd apps/desktop/src-tauri
cargo tauri build --bundles dmg --target aarch64-apple-darwin
```

Tauri already builds the Solid frontend through `beforeBuildCommand`, so there is no separate release step for the client bundle.

### Output Paths

After a successful build, collect artifacts from:

```text
apps/desktop/src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/
apps/desktop/src-tauri/target/aarch64-apple-darwin/release/bundle/macos/
```

Use the `.dmg` from the `bundle/dmg/` directory as the installable release artifact.

The raw `.app` bundle lives under `bundle/macos/` and is useful for local smoke testing before sharing the DMG.

### Maintainer Smoke Test

Before sharing the DMG:

1. Open the built `.app` from `bundle/macos/`.
2. Confirm the desktop window launches outside `cargo tauri dev`.
3. Confirm the embedded daemon starts and the UI connects.
4. Start a supported agent CLI and verify Pharos shows live session activity.

## Install Unsigned DMG

Share the generated `.dmg` with internal testers only.

### Tester Install Steps

1. Open the DMG.
2. Drag `Pharos Agent Monitor.app` into `Applications` if the installer window shows the shortcut.
3. Eject the DMG.
4. In `Applications`, right-click the app and choose `Open`.
5. If macOS blocks the app, open `System Settings` -> `Privacy & Security` and use `Open Anyway`, then retry.

After the first approved launch, macOS should allow future launches for that copy of the app.

## Notes

- This flow does not use the Linux Dockerfile or server-only packaging.
- This flow does not add CI, auto-update, signing, or notarization.
- A later public release can keep the same desktop product and upgrade only the trust/distribution layer.
