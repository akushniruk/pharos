# Pharos docs overview

Welcome. These pages are written for **several audiences** — pick the path that matches you.

The in-app reader shows which **documentation bundle** matches your build (sidebar and banner). See [Documentation and versions](documentation-versioning.md) if your installed version does not match what you expect.

## Agent runtimes (first-class)

**Current release: v0.1.0** — still **pre-1.0**; event quality and discoverability vary by tool and OS. The Rust daemon ships **dedicated profiles** (native session discovery and tailored tailing) for the coding-agent surfaces below.

Logos below are **vendor marks** (via [Simple Icons](https://simpleicons.org), CC0) shown for recognition only; trademarks belong to their owners and **do not imply endorsement**.

| Claude Code | Codex CLI | Gemini CLI | Cursor |
| :---: | :---: | :---: | :---: |
| ![Claude Code — first-class integration](docs-supported/claude-code.svg) | ![OpenAI Codex CLI — first-class integration](docs-supported/codex-cli.svg) | ![Google Gemini CLI — first-class integration](docs-supported/gemini-cli.svg) | ![Cursor agent sessions — first-class integration](docs-supported/cursor-agent.svg) |
| Native JSONL under `~/.claude/` (configurable) | Codex home metadata + process hooks | Gemini home metadata + process hooks | Cursor workspace metadata and session files |
| Richest transcript signal today | Improving | Improving | Improving |

**Also configurable:** the daemon can **match additional CLIs** (for example Pi, OpenCode, Aider, generic agent CLIs, or your own toolchain) via **runtime matchers** — see the **`RuntimeSource` enum** in [`apps/daemon-rs/domain/src/envelope.rs`](../apps/daemon-rs/domain/src/envelope.rs) and config under `PHAROS_RUNTIME_MATCHERS_PATH`. Coverage depends on what each tool writes locally and how matchers are defined.

Tiles load from the dashboard bundle under `apps/client-solid/public/docs-supported/` (see `ATTRIBUTION.txt` there for icon licensing). GitHub’s Markdown preview does not run that static host; use the in-app docs reader or a local `pnpm run dev` to see them rendered.

---

## Who you might be

| You are… | Start here |
|----------|------------|
| **Trying the product** | [Desktop app](getting-started-desktop.md) or [Web dashboard on your machine](getting-started-daemon-web.md) |
| **Running a shared observer on a VPS** | [Daemon on a server](getting-started-remote-daemon.md) |
| **Security, compliance, or platform** | [Security and data boundaries](security-for-reviewers.md), then [Why Pharos exists](positioning.md) |
| **Developer evaluating or self-hosting** | [Desktop vs web dashboard](desktop-vs-daemon-web.md), then [Sessions, events, and the graph](understanding-sessions-and-events.md) |
| **Open-source contributor** | [How to contribute](../CONTRIBUTING.md) and the **Contributing** section in the in-app sidebar |

## How this documentation is organized

We follow **[Diátaxis](https://diataxis.fr/)** ideas:

- **Tutorials** — *Getting started* (hands-on: Desktop, local daemon + UI, remote daemon).
- **Explanation** — *Understand Pharos* (trade-offs, security story, what you see in the UI).
- **How-to** — Embedded in tutorials where possible; advanced topics link to the reference.
- **Reference** — HTTP/WebSocket contracts for integrators.

**Product copy** inside the **desktop app** also lives in the repo at [`apps/desktop/src/docs/content/`](../apps/desktop/src/docs/content/) (first-run and in-app `/docs` articles). The **sidebar you are reading now** mirrors this `docs/` tree for the same Solid build used on the web.

## Quick links

- [Documentation and versions](documentation-versioning.md) — *docs ↔ app version*
- [Architecture at a glance (diagrams)](architecture-how-it-works.md) — *how the pieces connect*
- [Desktop vs web dashboard](desktop-vs-daemon-web.md) — *which shape should I use?*
- [Reading the event stream](event-stream-ux-guide.md)
- [HTTP and WebSocket API](frontend-api-reference.md)
- [Repository README](../README.md) — clone, ports, Makefile
