# README hero imagery — UX handoff (PHA-116)

**Board ask:** polish the GitHub README entry with a small, brand-consistent visual set. **Scope:** README-first; CTO owns merge placement unless expanded.

**Parent narrative:** [PHA-104](/PHA/issues/PHA-104) · **Brand colors** align with [`assets/brand/pharos-mark-square.svg`](../../assets/brand/pharos-mark-square.svg) (blues `#2563eb` → `#1a56db`, accent `#1244b4`, light text `#f8fafc`).

---

## Delivered assets

| File | Role |
| --- | --- |
| [`assets/readme/readme-hero-architecture.svg`](../../assets/readme/readme-hero-architecture.svg) | **Primary hero** — left-to-right flow: agent session files → Pharos daemon (EventEnvelope / WebSocket) → dashboard sketch. Subtle lighthouse beam in background. Supports `prefers-color-scheme` for light/dark README viewing. |
| [`assets/readme/readme-ui-screenshot-frame.svg`](../../assets/readme/readme-ui-screenshot-frame.svg) | **Optional** — browser chrome + dashed “drop screenshot here” area until a real product still exists. Replace content by embedding a PNG in README or by swapping the file. |

---

## Alt text (accessibility)

- **Architecture diagram:**  
  `alt="Diagram: local agent session JSONL files feed a Pharos daemon that emits structured events over WebSocket to a dashboard."`

- **Screenshot frame (if used before a real screenshot):**  
  `alt="Placeholder browser window labeled Pharos for a future product screenshot."`

- **After a real screenshot replaces the frame:**  
  `alt="Pharos dashboard showing live agent sessions and events."`  
  (Adjust to match the actual capture.)

---

## Suggested README placement

**Option A — single hero under the pronunciation line (recommended first ship)**

Insert after the link row (after line 5 in current `README.md`), before `## What is Pharos?`:

```markdown
![Diagram: local agent session JSONL files feed a Pharos daemon that emits structured events over WebSocket to a dashboard.](assets/readme/readme-hero-architecture.svg)
```

**Option B — hero + optional screenshot row**

```markdown
| | |
| --- | --- |
| ![Architecture diagram: sessions to daemon to dashboard.](assets/readme/readme-hero-architecture.svg) | *Optional:* replace with PNG from `assets/readme/readme-ui-screenshot-frame.svg` guidance above. |
```

For a single-column README, stack two images with a short caption line between them rather than a table.

**Relative paths** work on GitHub default branch; no raw.githubusercontent.com needed for SVG in-repo.

---

## File hygiene

- SVGs use no XML comments (matches Tauri icon constraint elsewhere in repo).
- If marketing later needs raster fallbacks, export PNG at 2× from these SVGs for Retina.

---

## QA checklist (post-integration)

- [ ] Light and dark GitHub themes: diagram remains legible.
- [ ] Mobile README: image scales; no critical labels clipped.
- [ ] `CHANGELOG.md` `[Unreleased]` if the README change is user-visible per repo contributing rules.
