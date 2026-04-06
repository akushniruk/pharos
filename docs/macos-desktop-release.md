# macOS Desktop Release

This guide covers installable Pharos desktop builds for macOS testers and maintainers.

Back to [Docs Portal](README.md).

- **Platform:** macOS (Apple Silicon and Intel builds ship from CI; local example below is Apple Silicon).
- **Artifact:** Unsigned `.dmg` from draft GitHub Releases (unless signing is configured).
- **Bundle name:** `pharos-desktop.app` — from [`productName`](https://v2.tauri.app/reference/config/) in [`apps/desktop/src-tauri/tauri.conf.json`](../apps/desktop/src-tauri/tauri.conf.json). (The in-window product title may still say “Pharos Agent Monitor”; that is separate from the `.app` filename.)

Unsigned builds are normal for internal testing. **macOS Gatekeeper** may block first launch or show messages such as the app being **“damaged”** and suggesting you **move it to the Trash**. That wording usually means **code signature / quarantine validation failed**, not a corrupt download or a wrong icon. Icons affect appearance and packaging; they do not fix Gatekeeper.

## Build release (local)

Entry point: Tauri app under [`apps/desktop`](../apps/desktop) (Vite shell + Rust backend).

### Requirements

- macOS (for local `.dmg` with Apple’s toolchain)
- **Rust 1.88+** (see repo [`rust-toolchain.toml`](../rust-toolchain.toml) and [`apps/desktop/src-tauri/rust-toolchain.toml`](../apps/desktop/src-tauri/rust-toolchain.toml))
- **Node.js 20+** (matches [`.github/workflows/release-desktop.yml`](../.github/workflows/release-desktop.yml))
- **npm** (lockfile is `apps/desktop/package-lock.json`)

Install dependencies and icons once per clone (icons are generated from [`assets/brand/pharos-mark-square.svg`](../assets/brand/pharos-mark-square.svg)):

```bash
cd apps/desktop
npm ci
npm run icons
```

### Build command

`beforeBuildCommand` in `tauri.conf.json` runs **`npm run build`**, which produces the **desktop Vite app** in `apps/desktop` (not `apps/client-solid`).

Either use the npm wrapper (recommended):

```bash
cd apps/desktop
npm run tauri build -- --bundles dmg --target aarch64-apple-darwin
```

Or invoke Cargo from the Tauri crate:

```bash
cd apps/desktop/src-tauri
cargo tauri build --bundles dmg --target aarch64-apple-darwin
```

### Output paths

After a successful build:

```text
apps/desktop/src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/
apps/desktop/src-tauri/target/aarch64-apple-darwin/release/bundle/macos/
```

Use the `.dmg` under `bundle/dmg/` for distribution. The raw `.app` under `bundle/macos/` is useful for local smoke tests.

### Maintainer smoke test

1. Open the built `pharos-desktop.app` from `bundle/macos/`.
2. Confirm the window launches outside `npm run tauri dev`.
3. Exercise the flows you care about (daemon, UI, agents) per your release checklist.

## Install unsigned DMG (testers)

Share the `.dmg` only with trusted testers.

### Tester steps

1. Open the DMG.
2. Drag **`pharos-desktop.app`** into **Applications** (if the DMG presents the shortcut).
3. Eject the DMG.
4. In **Applications**, **right-click** the app → **Open** (first launch).
5. If blocked, open **System Settings → Privacy & Security** and use **Open Anyway**, then retry.

### If macOS says the app is “damaged”

Try, on a copy in **Applications** or on the `.app` inside the DMG:

1. **Clear quarantine** (common for files downloaded from the browser or GitHub):

   ```bash
   xattr -cr /path/to/pharos-desktop.app
   ```

2. **Inspect signing** (unsigned/ad-hoc builds will not pass strict assessment—that is expected until you ship a Developer ID build):

   ```bash
   codesign --verify --deep --strict --verbose=2 /path/to/pharos-desktop.app
   spctl --assess --verbose /path/to/pharos-desktop.app
   xattr -l /path/to/pharos-desktop.app
   ```

   Look for `com.apple.quarantine` on the bundle or contained files.

For broad distribution without these steps, you need **Developer ID Application** signing and **notarization** (see below).

## CI and draft releases

- **[`.github/workflows/release-desktop.yml`](../.github/workflows/release-desktop.yml)** — on `v*.*.*` tags, builds macOS (aarch64 + x86_64), Linux, and Windows and uploads artifacts to a **draft** GitHub Release. It runs **`npm run icons`** before the Tauri build so bundle icons are always regenerated on the runner.
- **[`.github/workflows/ci-desktop.yml`](../.github/workflows/ci-desktop.yml)** — runs **`npm run icons`** as a smoke test on pull requests (along with desktop Playwright tests).

## Signing and notarization (maintainers)

To avoid Gatekeeper warnings for users who download the app from the internet, configure **Apple code signing** and **notarization**. Official Tauri documentation:

- [macOS code signing](https://v2.tauri.app/distribute/sign/macos/)

Typical GitHub Actions secrets (names vary slightly by setup; align with the Tauri guide and your keychain import step):

| Secret | Purpose |
|--------|---------|
| `APPLE_CERTIFICATE` | Base64-encoded `.p12` exported from Keychain |
| `APPLE_CERTIFICATE_PASSWORD` | Password for that `.p12` |
| `KEYCHAIN_PASSWORD` | Ephemeral keychain password used on the runner |
| `APPLE_ID` | Apple ID email (notarization via Apple ID path) |
| `APPLE_PASSWORD` | App-specific password (or API key flow per Tauri docs) |

Alternatively use **App Store Connect API** keys (`APPLE_API_ISSUER`, `APPLE_API_KEY`, `APPLE_API_KEY_PATH`) as described in the same page.

After secrets exist, add a macOS job step that **imports the certificate into a temporary keychain** before `tauri-apps/tauri-action`, and set **`APPLE_SIGNING_IDENTITY`** (or `bundle.macos.signingIdentity` in `tauri.conf.json`) to your **Developer ID Application** identity. Notarization flags/environment variables follow the Tauri bundler configuration for v2.

Until that is wired up, treat unsigned draft releases as **internal-only** and use the quarantine / right-click **Open** flow above.

## Notes

- This flow does not describe the daemon + Solid web stack (`make daemon` / `make client`); that is a separate surface from the Tauri desktop shell.
- Auto-update and full notarization are optional follow-ons once signing is in place.
