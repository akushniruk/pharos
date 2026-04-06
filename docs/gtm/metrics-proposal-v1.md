# Metrics proposal (v1) — leading indicators

**Scope:** Recommendations only; no tooling implementation in this task. Tune definitions with CEO/finance once tracking stack is chosen.

**ICP emphasis (CEO lock):** **Security-led primary.** Qualified traffic and conversions should **over-index** signals from security, platform, compliance, and governance-adjacent roles without abandoning strong IC engineering interest.

## 1. Qualified GitHub / in-repo interest

**Metric:** Count of **qualified** repo or docs engagements per week (proxy until product analytics mature).

**Examples (pick what instrumentation allows):** referral traffic to README or key `docs/` pages with time-on-page or scroll threshold; issue/Discussion participants who self-ID as security/platform; **not** raw star count alone (use stars + watcher growth as a secondary pulse only).

**Qualification (v1):** Same **security/platform/compliance/engineering leadership** vs. general IC split as before — use form fields, issue templates, or survey links **from** the README/Release CTA rather than a standalone marketing site.

**Why:** Canonical surface is the repo ([PHA-37](/PHA/issues/PHA-37)); this measures **ICP reach** where the argument actually lives.

**Operational note:** Define “qualified” minimally at first (e.g. completed role field on waitlist form linked from README, or read of governance/observability doc vs. README bounce-only).

## 2. Waitlist or early-access conversion quality

**Metric:** **Waitlist signups** and **activation proxy** — e.g. % who confirm email, join community, or start onboarding within 7 days.

**Why:** Separates curiosity from **intent to try**; correlates with future product feedback loops DevRel and PM need. Segment by role where possible to watch **security/platform** vs. general engineer conversion.

## 3. Content engagement (leading, not vanity)

**Metric:** **Engaged reads** on flagship artifacts — e.g. deep reads of README sections or long `docs/` pages, or inbound clicks from X/technical threads into those URLs — plus **secondary actions** (subscribe, star/watch repo, join Discussions).

**Why:** Early brand is built on **credibility** with buyers and champions; shallow impressions matter less than proof that **governance-minded** readers stayed for the argument.

---

## Optional secondary (add when volume allows)

- **Community questions per week** — qualitative signal for positioning and docs gaps (tag security/governance themes).
- **Inbound “observability”- or “audit”-themed mentions** — manual tag in support or social for message-market fit.

---

**Dashboard set:** Pick **2–3** as the official quarter set to avoid metric sprawl; default recommendation is **1 + 2 + 3** above with role segmentation on **1** and **2** as soon as form data allows.

*v1.2 — metrics reframed for GitHub-primary surfaces per [PHA-37](/PHA/issues/PHA-37); ICP lock from [PHA-18](/PHA/issues/PHA-18) unchanged.*
