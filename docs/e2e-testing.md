# End-to-end testing (Playwright)

## Strategy

| Layer | Tool | Scope today |
|-------|------|-------------|
| **Web dashboard** | Playwright | Built Solid app via `vite preview` — routing, docs shell, static chrome |
| **Tauri desktop** | Not automated here | Packaged app / native shell — follow-up with `tauri driver`, tagged smoke, or QA manual matrix |
| **Daemon + live data** | Not in CI | Requires long-running `pharos-daemon` and fixtures; optional integration job later |

**Why Playwright (not Cypress only):** multi-browser matrix, solid `webServer` hook for Vite preview, and a path to Tauri WebDriver later.

## Running locally

```bash
cd apps/client-solid
pnpm install
pnpm exec playwright install chromium
pnpm run build
pnpm run test:e2e
```

## CI

Workflow: [`.github/workflows/ci-e2e.yml`](../.github/workflows/ci-e2e.yml) (path-filtered to `apps/client-solid/**`). Installs Chromium deps on Ubuntu, builds, runs Playwright.

## Handoff (QA / PHA-64)

1. Expand `e2e/` with **priority flows** once product stabilizes (project drill-down, graph tab, connection states — may need **mock WebSocket** or test-only daemon).
2. Keep default suite **fast and hermetic**; mark network-dependent tests with `test.slow()` or a separate project.
3. Coordinate **release gating**: optional required check on `main` after the team agrees.
