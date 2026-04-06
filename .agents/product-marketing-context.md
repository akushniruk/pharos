# Product Marketing Context

*Last updated: 2026-04-07*

## Product Overview
**One-liner:** Local observability layer for AI coding agents.
**What it does:** Pharos is a Rust daemon that tails AI agent session transcripts on your machine, normalizes them into structured events, and streams them via WebSocket to a dashboard — so teams can see what ran, review it, and prove what happened.
**Product category:** Developer tools / AI agent observability
**Product type:** Open-source local-first tool (daemon + dashboard + desktop app)
**Business model:** Open source (MIT), self-hosted. No SaaS, no accounts required.

## Target Audience
**Target companies:** Security-governed engineering orgs, platform engineering teams, enterprises rolling out AI coding agents at scale.
**Decision-makers:** Security leads, platform engineers, engineering managers, CTOs.
**Primary use case:** Making AI coding agent activity inspectable, auditable, and governable on developer machines.
**Jobs to be done:**
- Answer "what ran, where, and under what assumptions?" for any agent session
- Provide auditable evidence of agent activity (not chat screenshots)
- Enable security and compliance review of agent behavior before scaling rollouts
**Use cases:**
- Security teams reviewing agent execution before approving wider rollout
- Engineering leads maintaining accountability and change control with AI agents
- Developers wanting durable signal of sessions, steps, and outcomes across restarts

## Personas
| Persona | Cares about | Challenge | Value we promise |
|---------|-------------|-----------|------------------|
| Security Lead | Audit trail, policy compliance, evidence | Can't prove what agents did; chat scrollback is not evidence | Inspectable, structured event trail for every agent session |
| Platform Engineer | Standards, tooling consistency, DX | Each developer reinvents "tail this folder, grep JSONL" | One daemon + dashboard convention for the workspace |
| Engineering Lead | Accountability, review habits, velocity | Agents bypass existing review workflows | Observable sessions that fit existing accountability bars |
| Builder / OSS Dev | Transparency, control, durability | Agent work disappears into chat scrollback | Durable signal of sessions and outcomes across restarts |

## Problems & Pain Points
**Core problem:** AI coding agents are becoming default in development, but their execution is opaque — unclear prompts, hidden tool use, hard-to-audit actions. Teams can't answer "what ran?" and trust breaks before velocity scales.
**Why alternatives fall short:**
- Chat scrollback disappears and can't be searched or shared
- Terminal logs are unstructured and scattered
- No convention exists for observing agent sessions locally
- Tooling optimizes for output; risk and compliance need evidence
**What it costs them:** Stalled agent rollouts, blocked approvals, governance anxiety, lost engineering time reverse-engineering what happened.
**Emotional tension:** Anxiety about "what is actually running on my laptop." Leadership can't say yes to agents without trading away understanding.

## Competitive Landscape
**Direct:** No direct competitor occupies "local observability for coding agents" — the category is nascent.
**Secondary:** Generic logging/monitoring tools (Datadog, Sentry) — not designed for agent session structure; cloud-first, not local-first.
**Indirect:** Manual approaches — grep JSONL, tail folders, chat screenshots, tribal knowledge. Falls short because it's fragile, unstructured, and not shareable.

## Differentiation
**Key differentiators:**
- Agents treated as systems worth observing (structured traces, not chat logs)
- Local-first: truth starts on the machine where the agent ran
- Event-shaped: canonical EventEnvelope format, stable enough to build on
- Security-led positioning: governance enables scale, not friction
**How we do it differently:** Daemon tails native session files, normalizes to structured events, streams via WebSocket to a human-readable dashboard.
**Why that's better:** Evidence vs. screenshots. Structured vs. grep. Local control vs. cloud dependency.
**Why customers choose us:** They need to answer "what ran?" before they can scale agent adoption. Nothing else gives them that answer locally.

## Objections
| Objection | Response |
|-----------|----------|
| "We already have logging/monitoring" | Those tools observe infrastructure and apps — not agent sessions. Pharos is purpose-built for the agent execution layer. |
| "Our agents are safe enough" | Until leadership asks for proof. Pharos gives you the evidence layer before you need it urgently. |
| "We'll build our own" | Every team reinvents "tail JSONL, grep, hope." Pharos is the convention so you don't have to. |

**Anti-persona:** Teams not using AI coding agents. Developers who only use agents casually with no governance requirements.

## Switching Dynamics
**Push:** Agent rollouts stalling because security can't approve what they can't see. Developers losing context across sessions.
**Pull:** Structured, searchable event trail. Dashboard that makes agent behavior legible. Open source, local-first, run in 60 seconds.
**Habit:** "We just scroll through chat" / "We grep the logs manually" / "We trust the agent."
**Anxiety:** "Is this another tool to maintain?" / "Will it slow us down?" — addressed by local-first simplicity and MIT license.

## Customer Language
**How they describe the problem:**
- "I have no idea what my agent actually did"
- "Chat scrollback is not evidence"
- "We can't approve what we can't see"
- "Trust breaks first, then rollouts stall"
**How they describe us:**
- "Flight recorder for coding agents"
- "Finally I can see what ran"
- "Observable by default"
**Words to use:** observability, evidence, structured events, local-first, sessions, governance, auditability, flight recorder
**Words to avoid:** AI wrapper, chatbot, SaaS, cloud platform, magic, autonomous
**Glossary:**
| Term | Meaning |
|------|---------|
| source_app | Last path component of the agent's cwd (e.g. "my-project") |
| session_id | UUID from the agent's native session file |
| Agent ID | source_app:session_id (session_id truncated to 8 chars) |
| EventEnvelope | Canonical structured event format emitted by the daemon |

## Brand Voice
**Tone:** Professional, direct, quietly confident. No hype.
**Style:** Technical but accessible. Short sentences. Evidence over promises.
**Personality:** Trustworthy, precise, understated, engineering-first.

## Proof Points
**Metrics:** Run it in 60 seconds (git clone + make daemon + make client).
**Customers:** Early-adopter builders and OSS maintainers (pre-launch phase).
**Testimonials:** N/A (pre-launch).
**Value themes:**
| Theme | Proof |
|-------|-------|
| Auditability first | Agent actions surfaced as structured events, not buried in logs |
| Observable by default | "What ran, in what order, under what rules" is a first-class story |
| Local-first clarity | Truth starts on your machine, your files, your retention |
| Control enables scale | Guardrails let more people use agents safely |
| Clarity, then velocity | Understand first, govern with confidence, ship faster with proof |

## Goals
**Business goal:** Establish Pharos as the standard observability layer for AI coding agents; build community and early adoption through GitHub.
**Conversion action:** Star on GitHub, clone and run, contribute.
**Current metrics:** Pre-launch; tracking GitHub stars, clones, and community engagement.
