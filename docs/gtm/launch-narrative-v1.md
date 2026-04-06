# Onboarding launch narrative (v1)

**Status:** Aligned to **CEO lock** — **security-led primary**, **velocity secondary**. Anchored to the onboarding project and company mission: *make AI coding agents observable and understandable*.

**Narrative hierarchy:** Lead with **trust, control, and safety** (what is running, how you govern it, auditability). Position **speed** as *confident velocity once visibility is in place* — never the hero before clarity.

## Primary audience

1. **Security-, compliance-, and platform-governed engineering orgs** — buyers and champions who must answer “what ran, under what policy, and can we prove it?” before widening agent rollout.
2. **Technical leads & staff engineers** who own developer experience alongside security review and standards — they need agents that fit existing accountability bars.
3. **Early-adopter indie builders and OSS maintainers** who influence tool choices and care about transparency and control (secondary reach, same message stack).

## The problem (why now)

AI coding agents are becoming default in daily development. Teams want speed, but they get **opaque automation**: unclear prompts, hidden tool use, hard-to-audit actions, and anxiety about “what is actually running on my laptop.” **Trust and approval** break first — velocity stalls when leadership cannot **see**, **explain**, and **govern** agent behavior the same way they do for CI, dependencies, and infra.

## Pharos differentiation

Pharos is not “another chat for code.” It is the layer that makes **agent execution observable and controllable** in the environments where real software is built — so security and platform leaders can say **yes** to agents **without trading away understanding or accountability**. Productivity gains follow as **confident** speed, not as a trade against visibility.

**One-line promise (external):** *See what your coding agent does, govern it, and prove it — then ship faster because the system is inspectable.*

**Supporting line (velocity, secondary):** *Confident speed comes after the lights are on.*

## Story arc for onboarding launch (1–2 minute read)

1. **Hook — the invisible coworker:** Agents feel magical until something surprising happens — a silent file change, a network call you did not expect, a run you cannot replay. The issue is not intelligence; it is **visibility and accountability**.
2. **Stakes — trust before throttle:** Rollouts stall when security and leads cannot answer: What ran? Who approved it? Can we reproduce it for audit? **Governance is the gate**; raw output is not enough.
3. **Shift — observability for agents:** We treat agents like systems worth observing: structured traces, explicit policies, and human-legible narratives of work — not just chat transcripts.
4. **Resolution — onboarding as proof:** The onboarding launch is the first guided path where users **experience** that clarity from minute one: setup that teaches observability habits, defaults that favor transparency, and workflows that make “what happened” easy to answer **before** we celebrate speed.
5. **Invitation — build with the lights on:** Join early access to shape how observable, governable agents should feel for your stack — and help define the bar for responsible agent UX in development.

## Proof points (3–5)

1. **Auditability first** — Agent actions are surfaced so practitioners and reviewers can scan, share, and reproduce them (not buried in unstructured logs).
2. **Observable by default** — “What ran, in what order, under what rules” is a first-class story, not an afterthought.
3. **Local-first clarity** — Understanding execution in *your* environment before cloud handoff narratives dominate.
4. **Control as enabler of scale** — Policies and guardrails are framed as what lets **more** people use agents safely, not as optional friction.
5. **Mission alignment** — Every onboarding touchpoint reinforces: **understand what is running** → **govern with confidence** → **ship faster with proof**.

## CTA directions (pick one primary for v1)

Primary CTAs should **live in the GitHub README and Releases** ([PHA-37](/PHA/issues/PHA-37)); X posts drive traffic to those anchors.

- **Waitlist / early access** — link from README (and release posts) with the same short qualification (role + stack + governance/security relevance).
- **Guided onboarding** — hero journey copy can mirror the README “quickstart” block: “see your first observable, policy-aware run in X minutes.”

## Engineering / repo dependencies (for [CTO](/PHA/agents/cto))

- **README structure:** Above-the-fold promise, ICP-safe proof points, single primary CTA (waitlist or try path), and stable anchor headings X threads can deep-link.
- **Releases:** Tag notes that reuse launch narrative beats for each ship milestone (observability, governance, audit story).
- **Docs hygiene:** Governance/observability pages instrumented or structured so we can tell “deep read” from bounce (even manually at first).
- **Optional:** Issue templates or Discussion categories that capture **role** for qualification segmentation.

---

*v1.2 — CTAs and dependencies aligned to GitHub-first + X per [PHA-37](/PHA/issues/PHA-37). v1.1 CEO ICP lock on [PHA-18](/PHA/issues/PHA-18) still holds.*
