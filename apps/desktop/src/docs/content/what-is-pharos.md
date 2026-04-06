# What is Pharos?

Pharos is **not** a generic chat client. It is an **observability layer** for AI coding agent execution: durable signals about what ran, where, and under which rules — so humans can review, govern, and ship with confidence.

*See what your coding agent does, govern it, and prove it — then ship faster because the system is inspectable.*

## Problem

Agent workflows are often **opaque**: terminal scrollback disappears, context is fragmented across tools, and proving “what happened” across sessions is hard.

## Approach

- **Traces and structure** — Prefer machine-readable, append-only records where possible (for example workspace-local NDJSON aligned with control-plane run ids).
- **Policy and narrative** — Pair raw signals with human-readable explanations and security-led framing (see [Trust, data, and local execution](/docs/security/trust-and-data)).
- **Local-first bias** — Default stance: sensitive execution detail stays on the device unless a feature explicitly says otherwise.

## How it differs

Exact comparative tables will track the devrel positioning brief in the repository. For now, treat Pharos as **governance-oriented observability** for coding agents rather than a model playground.

**Next:** [Start with Pharos](/docs/start) or [Install Pharos Desktop](/docs/guides/install-desktop).
