# Gemini Live Event Tailing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parse Gemini `logs.json` entries into prompt, assistant, tool call, and tool result events, normalize them into the existing event model, and tail them from the scanner without changing Claude behavior.

**Architecture:** Keep Gemini logic inside `apps/daemon-rs/src/profiles/gemini.rs` with a small live-event parser that returns the existing `CodexSessionEvent`-style event shape or a Gemini-specific equivalent mapped in `envelope.rs`. Extend `scanner.rs` with a Gemini branch that tracks file progress for `logs.json`, de-duplicates already-seen records, and feeds normalized events through the same store/broadcast path used for other runtimes.

**Tech Stack:** Rust 2024, `serde_json`, existing `EventEnvelope` / `TranscriptEvent` / scanner plumbing, targeted `cargo test`.

---

### Task 1: Add Gemini log parsing coverage

**Files:**
- Modify: `apps/daemon-rs/tests/gemini_profile.rs`
- Modify: `apps/daemon-rs/tests/envelope.rs`

- [ ] **Step 1: Write the failing tests**

```rust
#[test]
fn gemini_profile_parses_prompt_assistant_tool_and_result_records() {
    // sample logs.json records exercising the four supported Gemini event types
}

#[test]
fn gemini_envelope_normalization_maps_supported_events_to_existing_kinds() {
    // assert user prompt, assistant response, tool start, tool success/failure
}
```

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run: `cargo test -p pharos-daemon gemini_profile_parses_prompt_assistant_tool_and_result_records -- --nocapture`

Expected: fail because Gemini live parsing is not implemented yet.

- [ ] **Step 3: Implement the minimal parser coverage**

```rust
// add a Gemini live event enum and a parser for logs.json records
// map user prompt, assistant text, tool call, and tool result only
```

- [ ] **Step 4: Re-run the focused tests**

Run: `cargo test -p pharos-daemon gemini_profile_parses_prompt_assistant_tool_and_result_records gemini_envelope_normalization_maps_supported_events_to_existing_kinds`

Expected: pass.

### Task 2: Tail Gemini logs in the scanner

**Files:**
- Modify: `apps/daemon-rs/src/scanner.rs`
- Modify: `apps/daemon-rs/src/profiles/gemini.rs`

- [ ] **Step 1: Write the failing scanner integration test**

```rust
#[test]
fn scanner_tails_gemini_logs_json_into_envelopes() {
    // create a temporary Gemini home, seed logs.json, and assert one envelope per supported record
}
```

- [ ] **Step 2: Run the focused scanner test and confirm it fails**

Run: `cargo test -p pharos-daemon scanner_tails_gemini_logs_json_into_envelopes -- --nocapture`

Expected: fail because the scanner does not tail Gemini live logs yet.

- [ ] **Step 3: Implement Gemini tailing and de-duplication**

```rust
// track per-session logs.json progress in scanner state
// read new Gemini records, normalize them, store/broadcast envelopes
```

- [ ] **Step 4: Re-run the focused scanner test**

Run: `cargo test -p pharos-daemon scanner_tails_gemini_logs_json_into_envelopes`

Expected: pass.

### Task 3: Run the targeted Rust suite and commit

**Files:**
- Modify: `apps/daemon-rs/tests/gemini_profile.rs`
- Modify: `apps/daemon-rs/tests/envelope.rs`
- Modify: `apps/daemon-rs/src/profiles/gemini.rs`
- Modify: `apps/daemon-rs/src/scanner.rs`

- [ ] **Step 1: Run the focused Rust tests**

Run: `cargo test -p pharos-daemon gemini_profile -- --nocapture && cargo test -p pharos-daemon envelope -- --nocapture && cargo test -p pharos-daemon scanner -- --nocapture`

Expected: all targeted tests pass.

- [ ] **Step 2: Commit the change**

```bash
git add apps/daemon-rs/src/profiles/gemini.rs apps/daemon-rs/src/scanner.rs apps/daemon-rs/src/envelope.rs apps/daemon-rs/tests/gemini_profile.rs apps/daemon-rs/tests/envelope.rs docs/superpowers/plans/2026-04-03-gemini-live-event-tailing.md
git commit -m "feat: tail gemini live logs"
```

