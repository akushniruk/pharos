# Graph view — pro UI polish (UX spec)

**Audience:** Engineering implementation of Pharos agent graph (post [e4fe54a](https://github.com/akushniruk/pharos/commit/e4fe54a)).  
**Intent:** Match Pharos shell chrome; raise perceived quality via rhythm, type hierarchy, empty state, and filter/toolbar alignment.

---

## 1. Layout rhythm & density

| Area | Current risk | Target |
|------|----------------|--------|
| Node grid | Nodes feel either cramped or floaty without a grid | **Snap to an 8px base grid**; node min width **200px**, max **280px**; vertical gap between stacked meta **4px** (half-step), between primary blocks **8px** |
| Canvas padding | Inconsistent breathing room vs list views | **24px** inset from graph chrome to first node column (same as primary content gutters elsewhere in Pharos if token exists — alias `space.page-inline` or equivalent) |
| Edge routing | Visual noise | Keep **stroke 1px** at rest; **1.5px** on hover/focus of edge; corner radius on orthogonal segments **4px** max (or match chart library default if fixed) |
| Zoom / fit | “Lost” feeling at extremes | **Min zoom 0.35**, **max 2.0**; **Fit to screen** control in toolbar; after filter change, optional **soft refit** (debounced 300ms) so graph recenters |

**Density mode (optional v2):** Compact toggles node height −8px and meta to `text-caption` only; default remains “comfortable.”

---

## 2. Typography hierarchy (nodes + meta)

Use **three levels** only on a node card (avoid a fourth unless status is critical).

| Role | Token / spec | Usage |
|------|----------------|--------|
| **Primary label** | `text-body` / **14–15px**, **font-weight 600**, `text-primary` | Agent display name |
| **Secondary line** | `text-body-sm` / **12–13px**, **font-weight 400**, `text-secondary` | Role or adapter short label (single line, truncate tail) |
| **Meta / telemetry** | `text-caption` / **11–12px**, **font-weight 400**, `text-tertiary` | Control-plane labels, parent hint, “last seen”, counts — **one line** where possible; second line only if `line-clamp-2` with fade |

**Parent / hierarchy affordance:** If showing hierarchy, use **caption + mono or tabular** for technical ids (`urlKey`) at **tertiary** color, **never** same weight as display name.

**Edge labels:** **Caption** size, **tertiary**, max **24ch** then ellipsis; on hover show full text in **tooltip** (not inline expansion).

---

## 3. Empty / zero state

When **no agents** match (or org has zero agents):

- **Illustration or icon:** Single **24–32px** muted glyph (same family as empty list states in Pharos).
- **Title:** `text-body`, **semibold**: “No agents to show”
- **Body:** `text-secondary`, **max-width 360px**, centered: “Add an agent or adjust filters to see relationships on the graph.”
- **Primary CTA** (if product has add flow): “Add agent” — same button component as empty roster elsewhere.
- **Secondary:** Text button “Clear filters” **only if** any filter active.

Avoid a bare graph canvas with no message — always **center the empty block** in the viewport minus toolbar height.

---

## 4. Filter + graph chrome (consistency)

| Element | Spec |
|---------|------|
| **Toolbar** | Same **height** and **border-bottom** as list/detail toolbars (`1px` `border-subtle`); horizontal padding **12–16px** aligned with page gutters |
| **Filter chips** | Reuse **chip** component from roster; active state = **filled subtle bg** + **primary border**; **8px** gap between chips |
| **Search** | If present, **min-width 200px**, **max-width 320px**, placeholder “Search agents…” |
| **View toggles** (list/graph) | **Segmented control** pattern already used app-wide; graph selected state uses **icon + label** where space allows |
| **Legend** (if any) | **Caption** text, **collapsible** drawer or **bottom-left** floating panel with **8px** radius and **shadow-sm** — not mixed into filter row |

**Background:** Graph canvas `bg-canvas` or `bg-subtle` — **one step** lighter than main content panel so the graph reads as a “stage.”

---

## 5. Before / after (implementation notes)

- **Before:** Mixed type weights on nodes; filters visually detached from other views; empty canvas unclear.  
- **After:** Clear **primary → secondary → caption** stack; toolbar reads as same product chrome; empty state matches list empty patterns.

---

## 6. Engineering follow-up

If any token names above are not in the design system, map to the **closest existing** token and note the alias in code comments. Track implementation in the normal issue or PR workflow your team uses.

---

## 7. QA acceptance (post-implementation)

Use after engineering lands the polish; not blocking spec approval.

- **Grid:** Node min/max width and vertical meta gaps match the section 1 table (spot-check three nodes at default zoom).
- **Type:** Primary name is visually dominant vs role line vs caption meta; no third body weight on the same card.
- **Empty:** Zero-data and filtered-empty both show title + body + optional CTA; content is centered below toolbar, not clipped.
- **Chrome:** Toolbar height, border, and chip spacing match roster/list view on same build; graph canvas background is one step subtler than panel.
- **Edges:** Rest stroke 1px; hover/focus 1.5px; labels truncate with tooltip for full text.
- **Motion:** Optional soft refit after filter change feels ≤300ms debounce, no layout jump mid-drag/pan.
