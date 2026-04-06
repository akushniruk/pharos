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

- **Eyebrow:** `Local observability · Open source`  
  - *UX:* ~32 chars; keep single line on mobile if possible (trim to `Local-first · Open source` only if it wraps).
- **Title (H1):** `Pharos`  
  - *UX:* Short wordmark-style H1; pair with lede for SEO/title tag separately in head if needed.
- **Lede:**  
  `A **local observability layer** for coding agents: the daemon tails session transcripts on your machine, normalizes them into events, and the dashboard shows what ran—so security and platform teams get **evidence**, not screenshots of a chat thread.`
- **Promise band:**  
  `**See what your agent did, govern it, and prove it.** Velocity comes after the lights are on.`
- **Primary CTA:** `View on GitHub` → repo root.
- **Secondary CTA:** `Read the README` → repo `#readme`.

---

## Problem strip

- **Section label (H2):** `The problem`
- **Column A label:** `Without a local observability layer`  
  **Body:** Work disappears into chat scrollback and one-off logs. When nobody can answer “what ran, where, and under what assumptions?”, **trust breaks first**—and agent rollouts stall before they scale.
- **Column B label:** `With Pharos`  
  **Body:** Sessions stay **addressable**: skim, search, and trace runs from structured events—not from memory. That legibility is what lets security reviewers, engineering leads, and daily practitioners stay aligned.

---

## Proof points

- **Section title:** `Why observability comes first`
- **Subhead:**  
  `Lead with **trust and evidence**; treat speed as the outcome once behavior is legible—not something you buy by hiding the trail.`

**Cards (title + body):**

1. **Auditability first** — Actions show up where reviewers already work—scan, share, and reproduce runs instead of reverse-engineering chat.
2. **Observable by default** — “What ran, in what order, under what rules” is modeled as events—not an afterthought once something breaks.
3. **Local-first clarity** — Truth starts on the machine where the agent ran: your files, your retention, your scope—before any cloud story.
4. **Control as scale** — Guardrails are how more people get to use agents safely; they are not busywork bolted on at the end.
5. **Clarity, then velocity** — Understand what is running, govern with confidence, ship faster with proof—same order every time.

---

## Footer

- **Paragraph 1:**  
  Pharos pairs a `Rust daemon` with a dashboard so coding-agent sessions are readable where they actually run. Positioning and proof points track [launch narrative v1](https://github.com/akushniruk/pharos/blob/main/docs/gtm/launch-narrative-v1.md); deeper detail lives in the [README](https://github.com/akushniruk/pharos#readme) and [Releases](https://github.com/akushniruk/pharos/releases).
- **Fine print:**  
  Static landing only—the README and repo docs stay the source of truth.

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

*Deck version: 2026-04-06 (PHA-135 polish) — synced to strings in `apps/landing-svelte` and `index.html` meta/title.*
