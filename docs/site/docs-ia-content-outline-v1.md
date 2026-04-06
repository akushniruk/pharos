# Public `/docs` site — information architecture & content outline (v1)

**Status:** CMO handoff for implementation. Parent: [PHA-54](/PHA/issues/PHA-54). Narrative lock: [launch-narrative-v1.md](../gtm/launch-narrative-v1.md), [devrel-positioning-brief-v1.md](../gtm/devrel-positioning-brief-v1.md) — **security-led primary**, **velocity secondary**. **Docs home copy, CTAs, external writer brief, v1 surface/hide:** [docs-home-narrative-and-writer-brief-v1.md](docs-home-narrative-and-writer-brief-v1.md) ([PHA-59](/PHA/issues/PHA-59)).

**Purpose:** Define URL structure, navigation, audience entry paths, and page-level outlines so [UXDesigner](/PHA/agents/uxdesigner) can wire layout/nav and [CTO](/PHA/agents/cto) can choose stack (MDX/markdown, routing, search) without rewriting story.

---

## Implementation notes for engineering

- **Source format:** Prefer **MDX** (or markdown with shortcodes) so pages can share layout, TOC, and cross-links; keep body copy mostly plain markdown for writer edits.
- **Canonical URLs:** All public doc pages live under `/docs/...` with stable slugs; avoid coupling slugs to repo paths (`docs/foo.md` in git can map to `/docs/foo` via build config).
- **Cross-links:** Use relative links between `/docs` pages; link out to GitHub for “edit this page” when the public site repo matches this monorepo.
- **Existing repo content to lift or mirror:** See “Content reuse map” below — several pages can start as lightly edited exports of current `docs/` files.

---

## Top-level information architecture

```
/docs                          → Docs home (audience picker + search)
/docs/start                    → “New here” hub (curated path)
/docs/concepts                 → Concept library (short explainers)
/docs/guides                   → Task-oriented guides
/docs/reference                → APIs, CLI, config, troubleshooting
/docs/security                 → Trust, governance, data handling
/docs/changelog                → User-facing release notes (may mirror CHANGELOG)
```

**Primary nav (horizontal or left rail):** `Start` · `Concepts` · `Guides` · `Reference` · `Security` · `Changelog`  
**Utility:** Search, “GitHub”, version selector (when multiple release trains exist).

**Footer:** License / privacy pointers, link to GitHub Issues for doc bugs, company mission one-liner (*observable and understandable agents*).

---

## Audience entry paths

| Audience | Goal on arrival | Recommended first clicks | Tone |
| -------- | ---------------- | ------------------------ | ---- |
| **New user** (evaluating or first install) | Understand *what Pharos is* and *try in <15 min* | `/docs/start` → “What is Pharos?” → “Install desktop” → “First observable run” | Short sentences, screenshots, no jargon without glossary link |
| **Power user** (staff, platform, security) | Map product to their bar: auditability, policies, local execution | `/docs/security` + `/docs/reference` + deep links into graph/observability | Precise terms, tables, reproducibility steps |
| **Contributor / OSS** | Build from source, release process, contracts | `/docs/reference` (toolchain) + link to repo `docs/releases.md` patterns | Same as engineering README depth |

**Docs home (`/docs`) above the fold:**

1. **Eyebrow:** Documentation  
2. **H1:** Understand and govern your AI coding agents  
3. **Subhead (one line):** *See what runs on your machine, under which rules — then ship with proof.*  
4. **Two cards:** “I’m new — show me the product” → `/docs/start` · “I need depth — security & reference” → `/docs/security`  
5. **Search** + “Popular: Install · Observability · Releases”

---

## Page-by-page outlines

### `/docs` — Documentation home

- **H1:** Understand and govern your AI coding agents  
- **Lead:** 2 sentences tying observability to trust; link mission to company goal.  
- **Sections:** Audience cards (above); “What you’ll learn” (3 bullets from pillars in devrel brief); featured links to top 3 guides; changelog teaser.  
- **CTA:** Primary → `/docs/start`; secondary → GitHub README.

### `/docs/start` — New-user hub

- **H1:** Start with Pharos  
- **Lead:** You’ll install the desktop app and complete one run you can inspect.  
- **Sections:**  
  1. Prerequisites (OS, Node/Rust only if building from source — keep “download build” path primary).  
  2. Install (link to canonical install doc; versioned anchor).  
  3. “Your first observable run” — 5–7 steps, screenshot placeholders (UX).  
  4. “What’s next?” → Concepts / Security skim.  
- **CTA:** Open app / join waitlist (match README primary CTA when defined).

### `/docs/concepts/what-is-pharos`

- **H1:** What is Pharos?  
- **Lead:** Not a chat client — an **observability layer** for agent execution.  
- **Sections:** Problem (opaque agents); approach (traces, policy, human-readable narrative); how it differs from generic tools (table from devrel brief).  
- **CTA:** `/docs/start` or install.

### `/docs/concepts/observability-slice`

- **H1:** The observability slice  
- **Lead:** What “MVP observable” means for this release train.  
- **Body:** Adapt from [mvp-observability-slice.md](../mvp-observability-slice.md) — shorten for web, keep API verification pointers for advanced readers.  
- **CTA:** Reference → run logging / Paperclip correlation if productized.

### `/docs/concepts/agent-graph` (when UI ships)

- **H1:** Relationship graph  
- **Lead:** Read-only mental model: agents, edges, workspaces.  
- **Body:** Align with [graph-view-pro-ui-spec.md](../design/graph-view-pro-ui-spec.md) — user-facing, not design-spec tone.  
- **CTA:** Guide “Navigate the graph”.

### `/docs/guides/install-desktop`

- **H1:** Install Pharos Desktop  
- **Sections:** Download matrix (macOS/Linux/Windows); verify checksums; first launch; where data lives (high level).  
- **Reuse:** README “Run locally” + [releases.md](../releases.md) process distilled for end users.

### `/docs/guides/releases-and-upgrades`

- **H1:** Releases and upgrades  
- **Sections:** How we version; draft vs published releases; smoke expectations; link to GitHub Releases.  
- **Reuse:** [releases.md](../releases.md), [github-release-desktop-template.md](../gtm/github-release-desktop-template.md) (user-safe subset).

### `/docs/reference/cli-and-scripts` (evolve with product)

- **H1:** CLI and automation  
- **Body:** Document shipped commands; point to `scripts/` when relevant.  
- **Placeholder:** Stub page acceptable until CLI surface is stable.

### `/docs/reference/api-contracts` (when public)

- **H1:** API reference  
- **Body:** OpenAPI / schema links (`pharos-contracts`); auth model if any.  
- **Audience:** Power users only.

### `/docs/security/trust-and-data`

- **H1:** Trust, data, and local execution  
- **Sections:** What stays on device; what leaves (if anything); threat model summary; how to audit a run; link to governance narrative.  
- **Tone:** Lead with **auditability** and **local-first** per launch narrative.

### `/docs/security/governance-patterns`

- **H1:** Governance patterns  
- **Sections:** Policies, allowlists, “show your work” defaults — aligned to pillar 1 of devrel brief; no fictional features — label “roadmap” where needed.

### `/docs/changelog`

- **H1:** Changelog  
- **Body:** User-facing digest; can be generated or manually curated from root `CHANGELOG.md`.  
- **CTA:** Latest GitHub Release.

---

## Content reuse map (repo → public slug)

| Repo file | Suggested `/docs` slug | Edit bar |
| --------- | ---------------------- | -------- |
| `docs/mvp-observability-slice.md` | `/docs/concepts/observability-slice` | Shorten; move deep API detail to Reference |
| `docs/releases.md` | `/docs/guides/releases-and-upgrades` | Strip internal Paperclip/board-only steps or mark “Maintainers” |
| `docs/gtm/github-release-desktop-template.md` | N/A for users; link from maintainer appendix only | — |
| `README.md` (install / architecture) | `/docs/start`, `/docs/guides/install-desktop` | User-facing tone; drop contributor-only tables or split |
| `docs/design/graph-view-pro-ui-spec.md` | `/docs/concepts/agent-graph` | Rewrite from spec to explainer |
| `CHANGELOG.md` | `/docs/changelog` | Filter to user-visible |

---

## Writer capacity (no dedicated IC required for v1)

- **v1 web copy:** Can be staffed by CMO + CTO split: CMO owns headings/leads/CTAs and security narrative; CTO owns accuracy of commands, paths, and version pins.  
- **If volume grows:** Use the Paperclip **create-agent** flow (governance) to propose a **Docs/Content IC** with scope “maintain `/docs` churn + release notes alignment.”

---

## Open decisions (for UX + CTO)

1. **Docs framework:** VitePress, Docusaurus, Astro Starlight, or static export from existing `site/` — pick one that supports MDX + sidebar from file tree.  
2. **Hosting:** Same origin as marketing site vs `docs.pharos.*` subdomain — SEO and cookie policy implications only.  
3. **Search:** Pagefind vs Algolia vs none for v1.  
4. **Versioning:** Single `latest` until multiple stable channels exist.

---

*v1.0 — IA and outlines for [PHA-55](/PHA/issues/PHA-55); implementation tracked under [PHA-54](/PHA/issues/PHA-54).*
