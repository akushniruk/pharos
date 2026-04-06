# Pharos — static marketing (Svelte + Vite)

Optional **visitor-facing** landing built with Svelte 5 and Vite. Product contract and deep docs remain the **root README**, **`docs/`**, and **GitHub Releases** — this app is for deployable marketing HTML only.

## Commands

```bash
cd apps/landing-svelte
pnpm install
pnpm run check    # svelte-check
pnpm run build    # production bundle → dist/
pnpm run dev      # local preview
```

## CI

GitHub Actions: [`.github/workflows/ci-landing-svelte.yml`](../../.github/workflows/ci-landing-svelte.yml) (path-filtered on `apps/landing-svelte/**`).
