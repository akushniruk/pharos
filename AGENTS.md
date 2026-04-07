# Agent / contributor notes

- **Rust daemon:** `apps/daemon-rs` — run `cargo test` and `cargo clippy` from that crate (or `make test` at repo root).
- **Solid dashboard:** `apps/client-solid` — `pnpm install`, `pnpm run build`, `pnpm run test`.
- **Landing page:** `apps/landing-svelte` — Svelte + Vite.
- **Commits:** Keep changes scoped; follow existing style in touched files. **No `Co-authored-by` trailers.**

For architecture terms and data flow, see **`CLAUDE.md`**.

## Learned User Preferences

- Branding: product name is **Pharos** (not "Pharos.io").
- UI: no outline/border decorations on interactive elements.
- UI: dark-mode text contrast must pass accessibility — flag low-contrast text proactively.
- UI: content, demos, and examples must look realistic, not fake/placeholder.
- UI: reuse the same component for identical patterns across views — don't create duplicates.
- Project avatars use 2-letter initials (e.g. "PH"), no images or white backgrounds.
- Graph visualizations should use metro/subway-line style.
- Keep the existing logo — do not redesign unless explicitly asked.

## Learned Workspace Facts

- GitHub repo: `https://github.com/akushniruk/pharos`
- Current version: 0.1.0 (pre-1.0 release, open-source MIT).
- Distribution: desktop app (Tauri wrapping SolidJS dashboard) is primary; daemon + web UI also for VPS.
- Product-marketing context (positioning, ICP, voice) is **not** tracked in this public repository; keep it in a private notes vault or local-only files if you use marketing skills outside the repo.
