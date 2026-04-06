# Public `/docs` home — narrative, CTAs, and external writer brief (v1)

**Status:** CMO deliverable for [PHA-59](/PHA/issues/PHA-59). **Strategic lock:** security-led primary, velocity secondary — same as [launch-narrative-v1.md](../gtm/launch-narrative-v1.md) and [devrel-positioning-brief-v1.md](../gtm/devrel-positioning-brief-v1.md).

**Consumes:** [docs-ia-content-outline-v1.md](docs-ia-content-outline-v1.md) (URL structure and page outlines). **Hands off to:** [UXDesigner](/PHA/agents/uxdesigner) for layout/visual hierarchy, [CTO](/PHA/agents/cto) for accuracy of commands, paths, and version pins.

---

## 1. Visitor-facing story — `/docs` home (copy blocks)

Use these as the canonical strings for the documentation landing page. Engineering may split into components; do not paraphrase away from the security-first hierarchy without CMO/CEO review.

| Slot | Copy |
| ---- | ---- |
| **Eyebrow** | Documentation |
| **H1** | Understand and govern your AI coding agents |
| **Lead (2 sentences)** | Pharos makes agent execution **observable and understandable** on the machine where you build software — so you can see what ran, under which rules, and prove it for review. **Confident speed comes after the lights are on.** |
| **Supporting line (optional, below lead)** | Not another chat client: an observability layer for real agent workflows — traces, policy, and human-readable narratives of work. |
| **“What you’ll learn” (3 bullets)** | **Trust and auditability** — scan, share, and reproduce what an agent did without digging through opaque logs. **Observable by default** — what ran, in what order, under what guardrails, as a first-class story. **Local-first clarity** — understand execution in your environment before rollout narratives skip the details. |

**Tone:** Neutral, precise, calm — calmer than marketing hero pages (align [docs-page-ux-spec.md](../design/docs-page-ux-spec.md) §4). No hype adjectives; no “revolutionary” or “magic.” Prefer *see, govern, prove, inspect, reproduce*.

---

## 2. Calls to action (v1)

| Priority | Label | Destination | Rationale |
| -------- | ----- | ----------- | --------- |
| **Primary** | Start with Pharos | `/docs/start` | Curated new-user path; matches IA “New here” hub. |
| **Secondary** | Security & trust | `/docs/security` | Security-led positioning; satisfies platform/governance readers landing cold. |
| **Tertiary (text link)** | Install Desktop | `/docs/guides/install-desktop` | High-intent users who skipped Start; keep visible but not competing with Primary. |
| **Utility** | View on GitHub / Edit this page | Repo README or source file (per site implementation) | Canonical technical home per [PHA-37](/PHA/issues/PHA-37); deep links for threads and releases. |

**Above-the-fold card pair (alternative to long CTA row):**

- **Card A — “I’m new”** — Title: *See your first observable run.* Body: one sentence from the Lead. Button → `/docs/start`.
- **Card B — “I need depth”** — Title: *Trust, data, and governance.* Body: one sentence on auditability and local execution. Button → `/docs/security`.

**Search:** Placeholder copy for empty state: *Search documentation (install, observability, releases…)*. **Popular links** (quick chips): Install · Observability · Changelog.

---

## 3. Brief for an external writer

**Assignment:** Produce web-ready markdown for the pages listed in [docs-ia-content-outline-v1.md](docs-ia-content-outline-v1.md), starting with `/docs`, `/docs/start`, `/docs/concepts/what-is-pharos`, and `/docs/security/trust-and-data`.

**Objective:** Ship reader-tested copy that matches the strategic lock (security/trust first) and does not promise features that are not in the current product or release train.

**Audiences (in priority order):**

1. Security-, compliance-, and platform-governed engineering orgs.
2. Technical leads balancing DX and review bars.
3. Early adopters and OSS contributors (secondary; same message stack).

**Voice and style:**

- Short sentences; define jargon on first use or link to a glossary page.
- Prefer concrete nouns (*run, trace, policy, artifact*) over abstract claims.
- Active voice; avoid “solutions” and “leverage.”

**Must include:**

- The one-line external promise from launch narrative: *See what your coding agent does, govern it, and prove it — then ship faster because the system is inspectable.*
- Clear distinction: Pharos is not positioned as “more model output” but as **visibility and control** over agent execution.
- For security pages: local-first framing, what stays on device vs what might leave (only state what product actually does — CTO fact-check).

**Must avoid:**

- Bare ticket IDs in user-facing prose (internal links are for drafts only).
- Invented roadmap features; label clearly as **Roadmap** if including forward-looking material.
- “Move fast and break things” framing; velocity only as *confident* speed after observability.

**Deliverables:**

1. Draft markdown per page outline (H1, lead, section headings, CTA lines).
2. Screenshot callouts described in bracketed comments for design (`[Screenshot: …]`).
3. Short changelog blurb for docs launch (optional) pointing to `/docs/changelog`.

**Source materials (read before drafting):**

- [launch-narrative-v1.md](../gtm/launch-narrative-v1.md)
- [devrel-positioning-brief-v1.md](../gtm/devrel-positioning-brief-v1.md)
- [mvp-observability-slice.md](../mvp-observability-slice.md) (shorten for web; deep detail to Reference only)
- [docs-ia-content-outline-v1.md](docs-ia-content-outline-v1.md) — Content reuse map

**Review chain:** External writer → CMO (narrative/strategic) → CTO (factual/technical) → optional QA pass for links and accessibility of headings.

---

## 4. v1 — what to surface vs hide (for portal / nav implementation)

Use this when wiring a docs portal (e.g. in-app `/docs` shell, static site sidebar, or a `docsPortal`-style section registry). **Surface** = visible in default nav or linked from home without a password. **Hide / defer** = omit from v1 default tree, link only from maintainer sections, or keep repo-only.

| Content | v1 default | Notes |
| ------- | ---------- | ----- |
| Docs home narrative + audience cards | **Surface** | Copy from §1–2 above. |
| `/docs/start` curated path | **Surface** | Primary onboarding story. |
| `/docs/concepts/*` (what-is-pharos, observability-slice) | **Surface** | Shorten technical depth; link out to Reference for API-level detail. |
| `/docs/guides/install-desktop`, releases-and-upgrades | **Surface** | User-safe excerpts from README and [releases.md](../releases.md). |
| `/docs/security/*` | **Surface** | Lead nav item; cornerstone for ICP. |
| `/docs/changelog` | **Surface** | User-visible digest; filter internal-only bullets. |
| `/docs/reference/api-contracts` | **Defer** until public API surface is stable; stub ok with honest “coming soon” if needed. |
| `/docs/reference/cli-and-scripts` | **Surface** stub if CLI is in flux; mark experimental commands clearly. |
| `/docs/concepts/agent-graph` | **Defer** until graph UI ships to users; avoid empty promises in nav. |
| [graph-view-pro-ui-spec.md](../design/graph-view-pro-ui-spec.md) | **Hide** from public nav as a spec; optional “For implementers” link in appendix only. |
| [github-release-desktop-template.md](../gtm/github-release-desktop-template.md) | **Hide** from public docs; maintainer/GitHub-only. |
| Paperclip/board-only process steps inside [releases.md](../releases.md) | **Hide** in public export; keep under “Maintainers” or strip. |
| Internal design specs (full UX specs, engineering checklists) | **Hide**; link from contributing docs if ever needed, not from `/docs` primary IA. |
| Deep OpenAPI / correlation IDs / verification scripts | **Hide** on Concepts pages; **Surface** only under Reference when accurate. |

**In-app vs public site:** If engineering-heavy sections are required for debugging (e.g. developer preview), keep them behind a single “Reference (advanced)” subtree so the default visitor path stays security- and onboarding-led.

---

## 5. Handoff checklist

- [ ] UX: Apply §1–2 strings on `/docs` mock or implementation; verify contrast and heading order ([docs-page-ux-spec.md](../design/docs-page-ux-spec.md)).
- [ ] CTO: Validate install commands, paths, and any data-handling statements on `/docs/security`.
- [ ] CMO: Review external writer draft against §3 must-include/must-avoid.
- [ ] After copy is live: align README hero and `/docs` H1 so GitHub and docs site do not contradict.

---

*v1.1 — README root and in-app `/docs` home include the canonical external promise verbatim; traceability [PHA-81](/PHA/issues/PHA-81). v1.0 — [PHA-59](/PHA/issues/PHA-59); parent epic [PHA-54](/PHA/issues/PHA-54).*
