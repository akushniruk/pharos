# End-to-end testing (Playwright)

## Strategy

| Layer | Tool | Scope today |
|-------|------|-------------|
| **Web dashboard** | Playwright | Built Solid app via `vite preview` — routing, docs shell, overview empty-state + status bar (`e2e/observability-shell.spec.ts`), static smoke (`e2e/smoke.spec.ts`) |
| **Desktop (Vite docs shell)** | Playwright | Same `vite preview` pattern in `apps/desktop` — smoke + deep-linked reference doc (`e2e/smoke.spec.js`); packaged Tauri still manual / `tauri driver` later |
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

**Hash-router docs only (matches the `#/docs/*` CI gate file):** `pnpm run build && pnpm exec playwright test e2e/docs-hash-router.spec.ts`

## CI

Workflow: [`.github/workflows/ci-e2e.yml`](../.github/workflows/ci-e2e.yml) — job **`playwright`** under **E2E (client-solid)** runs `pnpm exec playwright test` after `vite build` (includes `e2e/docs-hash-router.spec.ts`); on failure, artifacts **`playwright-report`** (HTML) and **`playwright-test-results`** (traces/screenshots/video) are uploaded. Path-filtered to `apps/client-solid/**` and related docs parity scripts.

## Handoff (QA)

1. Expand `e2e/` with **priority flows** once product stabilizes (project drill-down, graph tab, connection states — may need **mock WebSocket** or test-only daemon).
2. Keep default suite **fast and hermetic**; mark network-dependent tests with `test.slow()` or a separate project.
3. Coordinate **release gating**: optional required check on `main` after the team agrees.
