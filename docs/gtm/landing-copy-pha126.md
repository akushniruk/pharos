# Pharos marketing landing — copy deck (PHA-126)

**Purpose:** Canonical on-page strings for the static Svelte landing (`apps/landing-svelte`). CTO wires from here; UXDesigner owns breakpoint trims and headline length.

**Aligns to:** Company mission (observable, understandable agents); [launch narrative v1](./launch-narrative-v1.md) (security-led, velocity secondary); GitHub-first CTAs per [readme-hero-variants-pha36.md](./readme-hero-variants-pha36.md) and board **PHA-37** (GitHub-first anchors; link in Paperclip as `[PHA-37](/PHA/issues/PHA-37)` when commenting).

**Parent work:** Paperclip **PHA-124** (landing page epic).

---

## Wire map (section → component)

| Section              | Component              | Notes                          |
| -------------------- | ---------------------- | ------------------------------ |
| Global nav           | `App.svelte`           | Wordmark + GitHub / Releases   |
| Hero                 | `Hero.svelte`          | Primary story + CTAs           |
| Problem / contrast   | `ProblemStrip.svelte`  | Two-column without / with      |
| Proof grid           | `ProofPoints.svelte`   | Five cards                     |
| Footer               | `SiteFooter.svelte`    | Repo links to in-repo narrative |

---

## Global header (sticky)

- **Wordmark:** `Pharos`
- **Nav labels:** `GitHub`, `Releases`
- **Nav URLs:** repo root, `…/releases` (same repo).

---

## Hero

- **Eyebrow:** `Local-first · Open source`  
  - *UX:* ~28 chars; keep single line on mobile if possible.
- **Title (H1):** `Pharos`  
  - *UX:* Short wordmark-style H1; pair with lede for SEO/title tag separately in head if needed.
- **Lede:**  
  `Pharos makes **AI coding agents observable and governable** on your machine: see what ran, under what rules, and prove it — so security and platform teams can say **yes** to agents without trading away clarity. Speed follows once the lights are on.`
- **Promise band:**  
  `See what your coding agent does, govern it, and prove it — then ship faster because the system is inspectable.`
- **Primary CTA:** `View on GitHub` → repo root.
- **Secondary CTA:** `Read the README` → repo `#readme`.

---

## Problem strip

- **Section label (H2):** `The problem`
- **Column A label:** `Without a local observability layer`  
  **Body:** Agent work disappears into chat scrollback and scattered logs. It is hard to answer “what ran, where, and under what assumptions?” — so **trust breaks first** and rollouts stall.
- **Column B label:** `With Pharos`  
  **Body:** Sessions and events stay **addressable** — skim, search, and trace what happened. Structured events from transcripts make behavior legible for security, leads, and builders alike.

---

## Proof points

- **Section title:** `Why teams choose observability first`
- **Subhead:**  
  `Aligned to our launch narrative: **security-led** story, **velocity** as confident speed once visibility is in place.`

**Cards (title + body):**

1. **Auditability first** — Agent actions surface so practitioners and reviewers can scan, share, and reproduce them — not bury them in unstructured logs.
2. **Observable by default** — “What ran, in what order, under what rules” is a first-class story, not an afterthought.
3. **Local-first clarity** — Understand execution in your environment before cloud handoff narratives dominate.
4. **Control enables scale** — Policies and guardrails are what let more people use agents safely — not optional friction.
5. **Mission-aligned onboarding** — Understand what is running → govern with confidence → ship faster with proof.

---

## Footer

- **Paragraph 1:**  
  Pharos — `daemon + dashboard` for AI agent sessions. Copy aligns to [launch narrative v1](https://github.com/akushniruk/pharos/blob/main/docs/gtm/launch-narrative-v1.md) and README hero outcome **A** ([PHA-36 variants](https://github.com/akushniruk/pharos/blob/main/docs/gtm/readme-hero-variants-pha36.md)).
- **Fine print:**  
  This page is a static marketing shell; canonical product story remains the GitHub README, Releases, and in-repo docs.

*(Replace `github.com/akushniruk/pharos` in footer hrefs if the canonical org/repo URL changes.)*

---

## UX / accessibility notes (UXDesigner)

- **H1 + brand row:** Reserve space for mark + title; avoid wrapping the H1 mid-word; `clamp` typography already in component.
- **Lede + promise:** Max-width ~42rem in layout; if copy grows, trim lede first (keep promise band as the memorizable line).
- **Problem strip:** Two-up from 720px; ensure column headings stay readable when stacked (labels are uppercase mono — screen reader friendly via body text).
- **Proof grid:** `minmax(260px, 1fr)` cards; titles should stay ≤ ~40 chars for tidy rag.

---

## CTA policy (recap)

- **Primary outbound:** GitHub repo (not waitlist on this shell unless CEO revises).
- **Secondary:** README anchor for depth.
- **Header:** Duplicate GitHub + Releases for repeat intent.

---

*Deck version: 2026-04-06 — synced to strings in `apps/landing-svelte`.*
