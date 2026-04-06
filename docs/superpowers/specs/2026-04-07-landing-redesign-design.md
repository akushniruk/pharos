# Landing Page Redesign — Design Spec

**Visual thesis:** Dark-mode observatory aesthetic — deep navy-black canvas, teal accent glow, monospace event streams that feel alive, professional restraint with moments of atmospheric motion. The page feels like peering into a flight recorder: structured, trustworthy, quietly powerful.

**Content plan:** Hero, Problem, How It Works, Features, Product Viz, Not This, Final CTA, Footer.

**Motion:** Terminal typing animation in hero, scroll-triggered section reveals, card hover lifts.

## Tech Stack

- Svelte 5 + Vite (existing)
- Tailwind CSS v4 via `@tailwindcss/vite`
- CSS custom properties for design tokens (existing, extended)
- No SvelteKit, no client-side router

## Sections

### 1. Hero (full viewport)

Eyebrow in mono: `LOCAL OBSERVABILITY · OPEN SOURCE`. Large "Pharos" wordmark + logo mark. Lede: "A local observability layer for coding agents..." Promise callout in bordered card. Two CTAs: "View on GitHub" (primary teal), "Read the README" (ghost). Right/below: animated terminal block showing JSONL event lines appearing one by one (CSS keyframes). Radial teal glow behind.

### 2. Problem Strip

Two-column without/with comparison. Left card: opacity/muted treatment, pain points. Right card: teal border glow, structured solution points. Copy tightened from current version.

### 3. How It Works

Three numbered steps in a horizontal flow (vertical on mobile) connected by a line/arrow. Each step: number badge, icon, title, one-sentence description, small code/terminal snippet. Steps: Daemon tails sessions → Events normalize → Dashboard shows what ran.

### 4. Features Grid

Six cards in 3x2 grid (responsive). Each: inline SVG icon, title, one-sentence body. Features: Auditability first, Observable by default, Local-first clarity, Structured events, WebSocket streaming, Light/dark dashboard. Hover: lift + shadow + border glow.

### 5. Product Visualization

Split layout: left side has a CSS-only mockup of the Pharos dashboard (session sidebar, event timeline, agent ID labels). Right side has a `TerminalBlock` showing a sample EventEnvelope JSON. Dark atmospheric styling.

### 6. What Pharos Is Not

Four items in a 2x2 grid. Each: "Not a..." title with one-sentence explanation. Items from README: not a replacement for your agent, not a hosted SaaS, not a full policy engine (yet), not a single chat window. Clean, direct.

### 7. Final CTA

Terminal-style block with install command: `git clone ... && make daemon && make client`. Tagline: "Open source. Local-first. Run it in 60 seconds." Primary CTA: "Star on GitHub". Ghost CTA: "Read the docs".

### 8. Footer

Compact. Links: GitHub, Releases, README, launch narrative. Fine print: "README and repo docs stay the source of truth."

## Shared Components

- `TerminalBlock.svelte` — Styled terminal/code display with optional typing animation, window chrome (dots), mono font.
- `ScrollReveal.svelte` — IntersectionObserver wrapper that applies fade-in + translate-up transition when element enters viewport. Respects `prefers-reduced-motion`.
- `Header.svelte` — Extracted from App.svelte. Sticky, backdrop-blur, wordmark + nav.

## File Structure

```
src/
  App.svelte
  app.css
  main.ts
  lib/
    Header.svelte
    Hero.svelte
    ProblemStrip.svelte
    HowItWorks.svelte
    Features.svelte
    ProductViz.svelte
    NotThis.svelte
    FinalCta.svelte
    SiteFooter.svelte
    TerminalBlock.svelte
    ScrollReveal.svelte
```

## Design Tokens

Preserve existing CSS custom properties. Extend Tailwind theme via `@theme` to reference them. Key tokens:

- Backgrounds: `--bg0` (#080c10), `--bg1`, `--bg2`
- Accent: `--accent` (#4fd1c5 dark / #0d9488 light)
- Text: `--text`, `--text-secondary`, `--muted`
- Fonts: `--font-sans` (DM Sans), `--font-mono` (JetBrains Mono)
- Spacing: `--space-xs` through `--space-3xl`
- Radii: `--radius-sm`, `--radius`, `--radius-lg`

## Typography

- H1: DM Sans 800, clamp(2.75rem, 6.5vw, 4rem), -0.035em tracking
- H2: DM Sans 700, clamp(1.375rem, 2.8vw, 1.875rem), -0.025em tracking
- Body: DM Sans 400, 1.0625rem, 1.65 line-height
- Mono: JetBrains Mono 400/500, 0.875rem
- Eyebrow: JetBrains Mono 600, 0.75rem, uppercase, 0.14em tracking

## Color System

Dark mode (default): navy-black backgrounds, teal accent, light text.
Light mode: slate-white backgrounds, darker teal accent, dark text.
Both modes already defined in current `app.css` — preserve and extend.

## Responsive Breakpoints

- Mobile: < 640px (single column, stacked)
- Tablet: 640px–1024px (2-column where applicable)
- Desktop: > 1024px (full layouts, max-width 1080px)

## Accessibility

- Skip link to main content
- Semantic heading hierarchy (h1 → h2 → h3)
- `aria-labelledby` on all sections
- Focus-visible outlines (existing)
- `prefers-reduced-motion` disables animations
- Color contrast 4.5:1+ for all text
- All interactive elements 44px+ touch target
