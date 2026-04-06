# Brand name fit — GitHub-first + X (v1)

**Context:** Supports [PHA-36](/PHA/issues/PHA-36) under board direction [PHA-35](/PHA/issues/PHA-35) / [PHA-37](/PHA/issues/PHA-37): **GitHub is the canonical story surface** (README, releases, in-repo docs); **X/Twitter is distribution**, not the home for the full narrative.

**Mission alignment:** Names should reinforce *observable, governable AI coding agents* — security-led clarity first (see launch narrative v1.1).

## 1. Hard constraints (must pass)

| Check | Why it matters |
| --- | --- |
| **GitHub org + repo slug** | Short, unambiguous, no awkward hyphen stacks; easy to type from a terminal and paste into issues/PRs. |
| **npm/crate handle sanity** (if applicable) | Avoid collisions and misleading namespaces for OSS consumers. |
| **README hero readability** | First H1 + one-line subtitle must read cleanly; no forced acronyms that need a glossary. |
| **Search & disambiguation** | Can you find the project in search without wading through mythology, astronomy, and unrelated “pharos” brands? |
| **Trademark / obvious confusion** | Quick pass for same-category tools; document known conflicts before public launch. |

## 2. GitHub-first narrative fit

- **Repo is the homepage:** The name appears most often next to **stars, forks, Releases, and `/docs`**. It should feel credible to a security- or platform-minded engineer skimming the README.
- **Avoid “consumer SaaS” vibes** if the product story is control and observability — overly cute or hypey names undermine the CEO lock (trust before velocity).
- **OSS signal:** Prefer something that sounds maintainable and serious; contributors should be proud to wear it on their profile.

## 3. X / Twitter fit (secondary)

- Handle should be **short**, memorable, and **available** (or have a clear, stable variant).
- Threading and quote-tweets will **point back to GitHub** for depth — the name should work as a **label** in screenshots and changelog posts, not carry the whole positioning alone.
- Avoid names that only work visually (puns needing emoji) — accessibility and CLI contexts still matter.

## 4. Scoring shortlists (practical rubric)

For each candidate, rate **1–5** (5 = strong):

1. **Slug quality** — `github.com/<org>/<repo>` looks professional.  
2. **Explainability in one tweet** — Can you describe *what it is* without sounding generic?  
3. **Differentiation** — Not “another AI code assistant” name; hints at *visibility / control / runs*.  
4. **Pronounceability** — Works on podcasts, meetups, and support calls.  
5. **Longevity** — Still makes sense if you add adjacent products later.

**Gate:** Any **1** on slug or explainability should drop the candidate unless there is a compensating story (and documented risk).

## 5. “Pharos”-specific notes (current working name)

- **Strengths:** Lighthouse metaphor → visibility; short slug; ties to “signal / guidance.”  
- **Risks:** Crowded semantic space; pronunciation/spelling drift (“Pharaohs”); mythology distance from enterprise buyers unless narrative explicitly maps to *illumination of agent runs*.

If the CEO keeps **Pharos**, double-down in README: **one sentence** mapping the name to *observable agent execution* so the metaphor does the GTM job.

## 6. Recommended next step for CEO

Pick **2–3 finalists**, run them through §1–§4 in a 15-minute pass, then **sleep on it** and test README H1 + fake X bio for each. CMO can tighten copy once the shortlist is frozen.
