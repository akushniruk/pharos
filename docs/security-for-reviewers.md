# Security and data boundaries

**Audience:** Security engineering, platform owners, compliance partners, and technical leads who must decide if Pharos fits an agent governance story.

**Intent:** State plainly what Pharos **does**, what stays **local**, and what it **does not** promise.

---

## What Pharos is

Pharos is a **local observability layer** for AI coding agents: it reads session artifacts where agents run, normalizes them into **events**, and exposes them through an API and dashboard so people can **see**, **review**, and **reference** what happened.

It is **not** a replacement for your agent product (Claude Code, Cursor, Codex, and so on). It **observes**; it does not execute policy in your name unless you add such layers elsewhere.

---

## Local-first execution (default framing)

- **Transcript and session discovery** happen in the environment configured for the **daemon**.
- **Structured history** (SQLite and related state) is written where you configure **`PHAROS_DAEMON_DB_PATH`** (or defaults under your workspace in development setups).
- **No mandatory hosted control plane** — the open-source path is **your** daemon + **your** UI.

If you expose the daemon socket to a network (see [remote daemon](getting-started-remote-daemon.md)), you inherit normal **service exposure** risks—TLS, authentication, and network allow lists are your responsibility.

---

## Auditability story (today)

- Events are **structured** (canonical envelope in the Rust model) rather than only raw chat screenshots.
- The UI surfaces **sessions, tools, and activity** in forms people can skim and search.

Pharos helps teams answer **“what happened on this machine?”** It does **not**, by itself, define **whether** that activity was allowed—that remains organizational policy.

---

## What is explicitly out of scope (OSS positioning)

- **Hosted multi-tenant analytics** as a product feature.
- **Guaranteed compliance** with a named framework—Pharos provides **evidence**; your GRC process decides sufficiency.
- **Remote mind-reading** of agents that never wrote artifacts to paths the daemon can read.

---

## Suggested review questions

1. Where will the daemon run — **per developer laptop**, **shared CI**, or **bastion/VPS**? Who can reach that network socket?
2. Which **agent products** are in scope and where do they write transcripts today?
3. What **retention and deletion** policy applies to SQLite + logs on disk?
4. If you use **Paperclip** or another control plane, what identifiers (if any) may appear in local run logs—see contributor notes in [MVP observability slice](mvp-observability-slice.md).

---

## Related

- [Why Pharos exists](positioning.md)
- [Understanding sessions and events](understanding-sessions-and-events.md)
- [Desktop vs web dashboard](desktop-vs-daemon-web.md)
