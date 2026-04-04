# Event Stream UX Guide

Back to [Docs Portal](README.md).

This is the concise implementation guide for event-stream behavior and styling.

## Simple vs Detailed

- **Simple**: operator-first summaries, minimal noise, readable at a glance.
- **Detailed**: full event type visibility and expandable row payloads.

## Payload Viewer (Detailed Expanded Row)

Expanded rows expose three behaviors:

- **Parsed** (default): structured key/value tree with nested details.
- **Raw JSON**: exact payload view.
- **Copy JSON**: copies the canonical raw JSON payload.

## Style Rules

### Prefer classes over long inline style strings

Avoid embedding long CSS strings in TSX:

`display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 16px;border-bottom:1px solid var(--border);flex-shrink:0`

Use this pattern:

- add semantic class names in TSX (for example `event-stream-focusbar`)
- define declarations once in `styles.css`
- keep dynamic inline styles only for data-driven values (for example badge colors)

### Avoid copied browser-computed style blobs

Do not paste computed style strings such as:

`style="background: none; border-color: var(--border); border-top-style: ; ..."`

Those blobs usually contain empty or redundant properties and are not source-of-truth CSS.

Use clean component classes with token variables:

- `--bg-*` for surfaces
- `--text-*` for typography
- `--border*` for borders
- state classes (`is-active`, `is-hidden`, `is-muted`) for behavior

## Accessibility Checklist (Required)

- Row expansion is keyboard operable (`Enter`/`Space`) and announces expanded state.
- Payload mode controls announce selected state.
- Copy action has a clear accessible label.
- Status remains understandable with text, not only color.
- Contrast is acceptable in both dark and light themes.
