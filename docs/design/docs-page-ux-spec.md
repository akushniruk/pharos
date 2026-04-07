# In-app `/docs` — UX spec

**Audience:** Engineering implementation of a first-class documentation surface inside Pharos (route `/docs`), consuming markdown or equivalent content.  
**Intent:** Clarity and **trust** for long-form reading: predictable hierarchy, comfortable measure, obvious navigation, and accessibility on par with the rest of the shell.  
**Content sources:** Visitor-facing copy for the docs hub ships in [`apps/desktop/src/docs/content/home.md`](../../apps/desktop/src/docs/content/home.md). Narrative hierarchy for positioning lives in [docs/positioning.md](../positioning.md). Coordinate copy changes with maintainers before diverging from those sources. Align rhythm with [docs/design/graph-view-pro-ui-spec.md](graph-view-pro-ui-spec.md) where both exist in the app.

---

## 1. Information architecture & layout shell

| Breakpoint | Structure |
|------------|-----------|
| **Desktop (≥1024px)** | **Two columns:** fixed **sidebar** (TOC + section nav) **256–288px** wide; **main** fluid column with max readable width (see §2). **12–16px** gutter between columns; **24px** page inset from app chrome (match `space.page-inline` / graph spec). |
| **Tablet (768–1023px)** | Same two columns if space allows; otherwise collapse sidebar into **overlay drawer** (see §5). |
| **Mobile (<768px)** | **Single column** article; TOC in **drawer** opened via **“On this page”** control in a **sticky subheader** below the main app header. |

**Landmarks (required):**

- `nav` with `aria-label="Documentation"` for the sidebar TOC region.
- `main` wrapping article body with **one** `h1` per page (title).
- Optional `aside` for supplementary callouts; do not nest primary TOC inside `aside` if it competes with `nav` — prefer `nav` for TOC.

**Skip link:** First focusable element on `/docs` routes: **“Skip to content”** targets the `main` landmark (`href` + `id` on `main`).

---

## 2. Typography & measure (readability)

Long-form docs are not dashboard density — bias toward **comfort**, not maximum information per pixel.

| Element | Spec |
|---------|------|
| **Article title (`h1`)** | `text-heading` or **20–24px**, **font-weight 600–700**, `text-primary`, **margin-bottom 12–16px** |
| **Section headings (`h2`)** | **16–18px**, **semibold**, `text-primary`; **margin-top 32–40px**, **margin-bottom 12px** (first `h2` after title: **margin-top 24px**) |
| **Subsections (`h3`)** | **14–15px**, **semibold**; **margin-top 24px**, **margin-bottom 8px** |
| **Body** | **15–16px**, **line-height 1.6–1.7**, `text-primary`; **max-width 65–72ch** on the article column (not full viewport width on ultrawide) |
| **Lead / deck** | Optional first paragraph after title: **body** at `text-secondary` or one step larger body for **1–2 sentences** only |
| **Lists** | **8px** between items; nested lists **indent 24px**; markers aligned with body grid |
| **Inline code** | **Caption-scale** or **body-sm** mono, **subtle background**, **4px** horizontal padding, **2px** radius — must meet contrast vs surrounding text |
| **Code blocks** | **14px** mono, **12–16px** padding, **radius 6–8px**; horizontal scroll with visible overflow affordance; **copy** control top-right when feasible |
| **Blockquotes** | **Left border 3–4px** `border-subtle` or `primary` muted; **padding-left 16px**; body secondary color |

**Vertical rhythm:** Snap section blocks to **8px** base grid (same principle as graph spec).

---

## 3. Sidebar & table of contents

| Behavior | Spec |
|----------|------|
| **Generation** | TOC derived from **document headings** (`h2`–`h3` minimum); `h4+` optional collapse or omit for clarity |
| **Active section** | Highlight TOC item whose section is **in view** (IntersectionObserver or equivalent); **keyboard-focusable** TOC links |
| **Hierarchy** | **Indent 12px** per level; **caption** size for nested items |
| **Current page** | If multi-page docs tree exists, show **current doc** in tree with **primary** or **subtle filled** background |
| **Width** | Sidebar **does not** grow with long TOC labels — **truncate with ellipsis**, **full title in `title` attribute** and **tooltip** on hover |

**Scroll sync:** When user scrolls the article, TOC active state updates; when user clicks TOC link, scroll **smooth** optional but **respect `prefers-reduced-motion`**.

---

## 4. Trust & orientation (chrome around content)

| Element | Spec |
|---------|------|
| **Breadcrumb or context** | If `/docs` sits under a product area, show **one line** “Docs” or `Product › Docs` using **secondary** text — avoid deep trails in v1 |
| **Last updated** | Optional **caption** under title: “Updated …” when metadata exists; omit if unknown (no fake dates) |
| **Page feedback** | Defer “Was this helpful?” to a later iteration unless already standardized elsewhere |

Tone: **neutral, precise** — docs chrome should feel calmer than marketing surfaces.

---

## 4b. `/docs` home — landing layout (hero + entry points)

The route `/docs` when used as a **hub** (not a single long article) stacks **orientation → action → discovery**. Copy slots and labels follow [`apps/desktop/src/docs/content/home.md`](../../apps/desktop/src/docs/content/home.md); this section is **layout, hierarchy, and accessibility** only.

| Band | Spec |
|------|------|
| **Eyebrow** | One line **above** the H1; **caption** or **body-sm**, `text-secondary`; **4–8px** margin below before the H1. |
| **H1** | Same scale as §2 article title (or **+2px** if this page has no competing chrome); **one** H1 for the view. |
| **Lead** | **Two sentences max** after the H1; treat as **deck**: body size with `text-secondary` (or one step larger than body if the system uses a dedicated “lead” style). **Max-width 65–72ch**; **12–16px** below H1. |
| **Supporting line** | Optional single line; **body-sm** / secondary; **8–12px** below lead. Omit the whole band if copy is not provided. |
| **“What you’ll learn”** | **Section heading** for the three bullets: use **`h2`** (“What you’ll learn” or equivalent) so structure stays **h1 → h2 → content**. Bullets: **8px** between items; optional **16–20px** icon column aligned to first line of text. |
| **Primary CTAs** | **Primary** button = “Start with Pharos”; **secondary** button = “Security & trust”; **16–24px** horizontal gap on desktop. **Tertiary** “Install Desktop” as **text link** — same row only if it does not crowd the two buttons; otherwise **below** the button row with **8–12px** spacing. Visual weight order must match narrative priority (primary > secondary > tertiary). |
| **Card pair (alternative)** | If using **two cards** instead of a long button row: **`h2`** section title (e.g. “Choose a path”), then a **two-column grid** (min **~280px** per column on desktop, **12–16px** gap). Each card is one **interactive surface** (whole card or explicit button) linking to the same destinations as the CTA table. **Single column** stack on narrow viewports. Card titles are **`h3`** under that **`h2`**. |
| **Utility links** | “View on GitHub” / “Edit this page”: **caption**-scale, secondary; **24–32px** **above** search or **below** CTA band — separated from primary actions so they read as **meta**, not part of the hero choice. |
| **Search** | Full-width field within the main column (max width follows §2 measure); **min height 40–44px** touch/click target. Place **after** the hero/CTA band for first-time scannability. Placeholder string per narrative doc. |
| **Popular chips** | Row below search (or directly under search label): **horizontal wrap**, **8px** gap; **pill** chips (caption/body-sm); **keyboard-focusable**; labels **Install · Observability · Changelog** per narrative doc. |

**Landmarks:** Wrap the hero (eyebrow through supporting line) and the bullet section in **`main`**; keep **sidebar** nav for the docs tree per §§1 and 3 if the shell shows it on the home route — do not duplicate the H1 inside the sidebar.

**Accessibility:** No skipped heading levels (`h1` → `h2` for “What you’ll learn” and for any card-grid section title). Primary and secondary actions both need **accessible names** matching the CMO strings. Chips are **`button`** or **`a`** with clear destinations.

---

## 5. Mobile & responsive behavior

| Pattern | Spec |
|---------|------|
| **Drawer** | TOC drawer **slides from start (LTR)**; **16px** padding; **full height** below app header; **backdrop** with dismiss on tap; **focus trap** while open; **Esc** closes |
| **Trigger** | Button **“On this page”** or icon+label in sticky bar — **min touch target 44×44px** |
| **Sticky subheader** | Contains trigger + optional **doc title truncate**; **1px** `border-bottom` matching other toolbars |

---

## 6. Accessibility (non-negotiable)

- **Heading order:** Strictly nested `h1` → `h2` → `h3` for each page; no skipped levels.
- **Focus:** Visible focus ring on TOC links and drawer trigger; drawer returns focus to trigger on close.
- **Motion:** Honor `prefers-reduced-motion` for scroll and drawer transitions.
- **Contrast:** Body text and links meet **WCAG AA** against doc background; code blocks and inline code included.
- **Links:** Distinct from body (underline on hover **or** color + underline for default — pick one system-wide).

---

## 7. Empty & loading states

| State | Spec |
|-------|------|
| **Loading** | Skeleton for **title bar + 3–4 text lines** in article; sidebar shows **muted placeholder rows** — avoid blank flash |
| **Missing doc / 404** | Centered block: **semibold** title “Page not found”, **secondary** body one sentence, **primary** link “Back to docs home” |
| **No headings** | TOC region shows **caption**: “No sections on this page” or hide TOC with layout collapsing gracefully |

---

## 8. Engineering follow-up

- Map tokens to the **closest existing** design-system names; alias in code comments where new tokens are needed (same as graph spec §6).
- If routing or content source (bundled markdown vs remote) affects layout, document the constraint in the implementation PR and coordinate with maintainers if information architecture changes break scanning.

---

## 9. QA acceptance (post-implementation)

- Desktop: article **max-width** enforced; sidebar TOC **active section** matches scroll position.
- Mobile: drawer **keyboard** and **screen reader** usable; **skip link** reaches main content.
- **`/docs` home:** Copy matches [`apps/desktop/src/docs/content/home.md`](../../apps/desktop/src/docs/content/home.md); **heading order** follows §4b; primary/secondary CTA prominence matches priority table; chips and search field are keyboard-usable.
- Zoom 200%: no horizontal clipping of body text (code blocks may scroll).
- Reduced motion: no jarring animations.
