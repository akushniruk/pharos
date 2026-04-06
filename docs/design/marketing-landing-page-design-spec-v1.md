# Pharos marketing landing page — design spec (v1)

**Status:** UX handoff for implementation in the new **Svelte** marketing app. **Strategic lock:** security-led primary, velocity secondary — same hierarchy as [launch-narrative-v1.md](../gtm/launch-narrative-v1.md).

**Consumes:** [onboarding-homepage.html](../../site/onboarding-homepage.html) (copy reference deck — do not pixel-match; this spec supersedes layout for a real URL), [docs-home-narrative-and-writer-brief-v1.md](../site/docs-home-narrative-and-writer-brief-v1.md) (tone: calm, precise; no hype).

**Hands off to:** [CTO](/PHA/agents/cto) for Svelte build and responsive behavior; [CMO](/PHA/agents/cmo) for final headline/subhead strings if marketing wants variants (keep security-first order).

---

## 1. Purpose and success criteria

| Goal | Measure |
| --- | --- |
| Visitor understands *what Pharos is* in &lt;10s | Hero states observability + local machine + govern/prove |
| ICP feels spoken to (security/platform leads) | Above-fold language mirrors launch narrative §Primary audience |
| Clear next step | Single primary CTA + one secondary (see §3) |
| Brand coherence with product | Tokens align with dashboard spec where practical (§5) |

---

## 2. Page architecture (section order)

Stack sections **vertically** on mobile; **max content width** 1120px for text-heavy blocks, with **full-bleed** backgrounds where noted.

1. **Global nav (sticky)** — logo wordmark + links: Product (anchor), Docs (external `/docs` when live), GitHub, **Primary CTA** (duplicate of hero CTA, compact).
2. **Hero** — full-bleed subtle gradient or mesh (§6); headline, subhead, primary + secondary actions, optional **product still** or abstract “signal/trace” illustration (no fake UI chrome).
3. **Social proof strip** (optional v1.1) — logos or “Built for teams who ship under review” one-liner; omit if no approved assets.
4. **Problem → shift** — two short paragraphs: invisible agent risk → observability as the answer (arc from [launch-narrative-v1.md](../gtm/launch-narrative-v1.md) §Story arc items 1–3).
5. **Three pillars** — cards in a single row (stack on narrow): **Auditability** · **Observable by default** · **Local-first clarity** (reuse proof-point language from launch narrative §Proof points).
6. **How it works** — 3 steps with icons or numbers: *Connect / See runs / Govern & prove* (wording adjustable by CMO; keep verbs concrete).
7. **Audience paths** — two tiles: “I’m evaluating for my org” → security-led bullets + link to docs/security when available; “I’m a builder” → GitHub README / quickstart.
8. **Closing CTA band** — full-bleed, high contrast; repeat primary CTA + secondary.
9. **Footer** — mission one-liner, GitHub, license/privacy placeholders, link to [docs](/docs) when routed.

**Information scent:** Do not duplicate the full `/docs` IA here; landing sells the *category* and *promise*; docs own depth.

---

## 3. Hero treatment

**Layout**

- Desktop: **55/45** split — left: type + CTAs; right: visual (illustration or abstract graphic). If no asset ships in v1, use right column for a **terminal-style trace preview** (static, stylized, not live data).
- Mobile: single column; visual below copy or omitted to reduce scroll.

**Recommended copy slots** (CMO may swap strings; preserve hierarchy):

| Slot | Direction |
| --- | --- |
| Eyebrow | Short category line, e.g. “Agent observability” or “For your machine, your repo” |
| H1 | Lead with **visibility / govern / prove** before speed; must not imply “another chat client” |
| Subhead | Two sentences: (1) what Pharos does locally, (2) **confident speed after visibility** as secondary clause |
| Supporting line (optional, max 1 line) | Clarify “not chat — observability layer” if space allows |

**Primary CTA:** Label aligned with [launch-narrative-v1.md](../gtm/launch-narrative-v1.md) §CTA — e.g. “Get early access” / “Join waitlist” / “View on GitHub” (whatever is live). **One** primary.

**Secondary CTA:** Ghost/outline — e.g. “Read the docs” or “See security story”.

**Motion:** Subtle only — 150–250ms fades on scroll reveal; respect `prefers-reduced-motion`.

---

## 4. Typography

| Role | Spec |
| --- | --- |
| **Font family** | `Inter`, `system-ui`, sans-serif (match [Solid dashboard spec](../superpowers/specs/2026-04-03-solidjs-full-ui-design.md) for brand continuity) |
| **H1** | `clamp(2rem, 4vw, 2.75rem)`, weight 700, line-height 1.12, letter-spacing -0.02em |
| **H2** (section titles) | `1.375rem`–`1.5rem`, weight 700, letter-spacing -0.01em |
| **Body** | `1.0625rem` (17px), line-height 1.6 |
| **Eyebrow** | `0.8125rem`, weight 600, uppercase, letter-spacing 0.06em, muted color |
| **Lead / subhead** | `1.125rem`–`1.25rem`, muted with **bold** emphasis on key phrases (see reference HTML pattern) |

**Max line length** for paragraphs: ~65ch.

---

## 5. Color and theme

**Baseline:** Light and dark modes via `prefers-color-scheme` or explicit toggle (optional v1 — if omitted, ship dark-first to match product).

| Token | Light | Dark | Usage |
| --- | --- | --- | --- |
| `--bg` | `#fafafa` | `#0a0a0a` | Page background |
| `--surface` | `#ffffff` | `#111111` | Cards, nav scrim |
| `--border` | `rgba(0,0,0,0.08)` | `#262626` | Dividers, cards |
| `--fg` | `#0d0d0d` | `#fafafa` | Primary text |
| `--muted` | `#5c5c5c` | `#a1a1aa` | Secondary text |
| `--accent` | `#1a56db` | `#3b82f6` | Primary buttons, links, bullet markers |
| `--accent-hover` | `#1244b4` | `#2563eb` | Hover |

**Accent usage:** One dominant accent (blue). Reserve green/red for status microcopy only if showing real states — avoid “traffic light” decoration on marketing chrome.

**Hero background:** Very low-contrast radial gradient or grid (`opacity` &lt; 0.15) using `--accent` mixed into `--bg` — must pass WCAG for text contrast on foreground copy (keep hero text on solid `surface` panel if gradient is busy).

---

## 6. Components (Svelte-oriented)

Suggested component breakdown (names indicative):

- `MarketingLayout.svelte` — shell, skip link, main landmark
- `SiteNav.svelte` — sticky, `aria-current` for active route
- `Hero.svelte` — props: `eyebrow`, `title`, `subhead`, `primaryCta`, `secondaryCta`
- `SectionHeading.svelte` — `title`, optional `description`
- `PillarGrid.svelte` — 3-column responsive grid
- `PillarCard.svelte` — title, body, optional icon slot
- `StepRow.svelte` — horizontal on desktop, vertical on mobile
- `AudienceSplit.svelte` — two cards, equal height on desktop
- `CtaBand.svelte` — full-bleed closing section
- `SiteFooter.svelte`

**Content:** Prefer **props + small JSON** or markdown frontmatter for copy so CMO can edit without touching layout.

**Styling:** CSS custom properties on `:root` / `[data-theme]`; avoid scattering hex in components.

---

## 7. Responsive and accessibility

- **Breakpoints:** `640` / `768` / `1024` — pillar grid collapses to 1 column &lt;768; hero stacks &lt;1024.
- **Touch targets:** Minimum 44×44px for nav and CTAs.
- **Focus:** Visible focus rings on all interactive elements (keyboard).
- **Semantics:** One `h1`; section headings `h2`; landmark regions (`header`, `main`, `footer`).
- **Contrast:** Body text ≥ 4.5:1; large headings ≥ 3:1 against background.

---

## 8. Assets and illustration

- **v1:** Abstract “trace” or signal lines (SVG), or approved product screenshot with sensitive data scrubbed.
- **Avoid:** Stock photos of generic hackers, exaggerated “AI brain” metaphors, or cluttered fake dashboards.
- **Future:** Optional short loop (muted) showing event stream — only if performance and reduced-motion are handled.

---

## 9. Open decisions for CTO / CMO

1. **Canonical primary CTA URL** — waitlist vs GitHub vs both with priority (see [PHA-37](/PHA/issues/PHA-37) narrative).
2. **Exact hero strings** — CMO signs off; UX structure above is fixed.
3. **i18n** — out of scope v1; structure strings for future extraction if expected.

---

## 10. Verification (before “layout locked”)

- [ ] Lighthouse accessibility score ≥ 90 (marketing page, no backend).
- [ ] Visual check: light + dark (if both shipped).
- [ ] CMO pass: no speed-before-trust wording in hero.
- [ ] All external links open in new tab only when off-site policy requires (GitHub may same-tab).

---

*v1 — UXDesigner for [PHA-125](/PHA/issues/PHA-125), parent [PHA-124](/PHA/issues/PHA-124).*
