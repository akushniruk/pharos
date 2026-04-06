# Brand naming: Pharos critique and alternatives (v1)

**Status:** Draft for board decision. Parent context: [PHA-36](/PHA/issues/PHA-36). Execution ticket: [PHA-38](/PHA/issues/PHA-38).

**Constraints (from board):** Working name **Pharos**; concern that it is **weak for broad marketing** and **awkward on Twitter/X**; **GitHub feels acceptable**. Product is **open source** — community pronunciation, repo ergonomics, and handle availability matter as much as “enterprise polish.”

## How we evaluated each name

- **Memorability & pronunciation** — Can a maintainer say it on a podcast once and have people spell it?
- **Metaphor fit** — Ties to *observable, understandable agents* without over-claiming.
- **GitHub/repo** — Short enough for org/repo; avoids obvious collisions with mega-projects where possible.
- **X/Twitter (high level)** — Likelihood of short `@handle` vs need for compound (`@nameoss`, `@namehq`). Not a legal availability search.

---

## Candidate shortlist (8)

| Name | Pronunciation | Metaphor | GitHub feel | X / social (high level) |
|------|---------------|----------|-------------|-------------------------|
| **Pharos** (status quo) | FAIR-oss / FEAR-oss (ambiguous) | Lighthouse, guidance, signal | Strong: short, repo-friendly | **Weak:** crowded term; bare `@pharos` likely taken → expect `@pharosdev`, `@pharososs` |
| **Beacon** | BEE-kun | Signal, visibility, “here we are” | Good | **Crowded** — compound handle almost certain |
| **Lantern** | LAN-tern | Light in the dark, inspection | Good | Moderately crowded; compounds workable |
| **Harbor** | HAR-ber | Safe place for workloads / agents | Good | Very crowded commercially |
| **Faro** | FAIR-oh (EN) / FAR-oh | Lighthouse (Spanish/Portuguese) | **Excellent** — short, clean | Often freer than “Pharos”; still check product collisions |
| **Sextant** | SEK-stunt | Navigation, precision, instrumentation | OK — devs recognize it | Spelling friction for mass market |
| **Witness** | WIT-nis | Auditability, “what happened” | Good | Strong metaphor; legal/HR connotations in some contexts |
| **Runlog** | RUN-log | Literal observability | **Very clear** for developers | Weaker romance; better as sub-brand or CLI than umbrella |

**Honorable mentions (not top picks):** *Prism* (strong metaphor, heavy existing brand use), *Helm* (navigation metaphor collides hard with Kubernetes ecosystem).

---

## Recommendation

**Default: keep Pharos, fix the go-to-market wrapper — do not force a repo rename pre-launch.**

1. **Metaphor is on-mission** — A lighthouse is a credible symbol for *visibility and safe passage*; it matches the narrative in [launch narrative v1](launch-narrative-v1.md) better than a generic devtool noun.
2. **GitHub is already “good enough”** — Renaming the OSS root is a **high-friction** event (redirects, stars, inbound links, package names). It should happen only for a **clear legal or discovery conflict**, not mild marketing discomfort.
3. **X awkwardness is mostly a handle + consistency problem** — Solve with a **single compound handle** (e.g. `@PharosDev` / `@pharos_obs`) and **pinned bio line**: *“Pharos — observable coding agents”* so search surfaces the software, not the ancient wonder.

**When to evolve instead of keep**

- **Variant (low cost):** Keep repo **Pharos**, use **“Pharos Open”** or **“Pharos OSS”** only in social display names and README H1 if the board wants distance from ambiguous pronunciation.
- **Rebrand (high cost):** If discovery tests show **persistent confusion** with unrelated “Pharos” products (crypto, wellness, etc.) *or* the team cannot secure a **stable** public handle set, pivot to **Faro** as the leading alternative: **short, lighthouse-native, often cleaner namespace**, still distinctive in dev tooling.

---

## If the board chooses rename (rollout sketch — CTO)

Escalate to [CTO](/PHA/agents/cto) early; this is **engineering-owned** with marketing comms support.

1. **Inventory** — GitHub org/repo, docs site paths, any packages, CI badges, release assets, internal Paperclip project name (optional alignment).
2. **Mechanics** — GitHub rename + redirects window, search/replace in README and `docs/`, announcement **GitHub Release** + X thread (per [PHA-35](/PHA/issues/PHA-35) channel policy).
3. **Comms** — One “why we renamed” paragraph: *clarity for OSS community and handles*, not a strategy pivot away from observability.
4. **Timeline** — Prefer **not** parallel to a major launch week; bundle with a versioned release for a natural story.

---

## Next step for board

Reply on [PHA-38](/PHA/issues/PHA-38) with **A)** keep Pharos + approved public handle pattern, **B)** Pharos + display variant only, or **C)** rebrand (candidate: **Faro** first reserve).
