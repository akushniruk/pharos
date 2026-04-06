# Pharos desktop — GitHub Release notes template

**Purpose:** Reusable structure and voice for **desktop** (and repo-native) ships. **Canonical story surface is GitHub** — README, `docs/`, and Releases ([PHA-35](/PHA/issues/PHA-35), [PHA-37](/PHA/issues/PHA-37)).

**Copy sources (do not paraphrase away from these without CEO/board revision):**

- Approved hero strings: [site/onboarding-homepage.html](../../site/onboarding-homepage.html) (same as [PHA-15](/PHA/issues/PHA-15#comment-90c579de-c094-43e1-bad5-15c64bae0de2))
- Narrative hierarchy (security-led, velocity secondary): [launch-narrative-v1.md](launch-narrative-v1.md)

---

## Voice checklist (before you publish)

- Lead with **trust, control, observability** — what users can **see**, **govern**, and **prove**; treat speed as **confident velocity** only after that.
- Prefer concrete outcomes: what changed in the app, what is visible in runs/traces/UI, what admins or reviewers gain.
- Avoid hype adjectives; write for security- and platform-minded engineers skimming on GitHub.
- **One primary CTA** per release (e.g. star/watch, docs path, early access) — match README anchors so X threads can deep-link.

---

## Paste-this: GitHub Release body (Markdown)

Replace `vX.Y.Z`, links, and bullets. Keep section headings stable so diffs across releases stay scannable.

```markdown
## Pharos Desktop vX.Y.Z

**Summary:** <!-- One sentence in hero voice: observable / governable agent execution; optional secondary line for confident velocity. -->

### What’s new

- <!-- User-visible capability; tie to observability or control when relevant. -->
- <!-- … -->

### Upgrade & migration

- **Platforms:** <!-- e.g. macOS 14+, Windows … -->
- **Breaking changes:** <!-- None, or list with migration steps / links to docs. -->
- **Notable dependencies:** <!-- Version bumps users should know for compliance or lockfiles. -->

### Security & integrity

- **Downloads:** Installers and checksums are attached to this release. Verify before install: <!-- `shasum -a 256 …` or link to checksum file if published alongside assets. -->
- **CVE / advisories:** <!-- None, or link GitHub Security tab / advisory IDs. -->
- **Disclosure:** Report issues via <!-- SECURITY.md path or GitHub private disclosure URL. -->

### Links

- **Full changelog:** <!-- compare view default branch, e.g. `…/compare/vX.Y.Z-1…vX.Y.Z` -->
- **Documentation:** <!-- stable `docs/` paths on default branch -->
```

---

## Optional: X (Twitter) thread — bullets that deep-link to the Release

Post **after** the GitHub Release is public. Every bullet should point at the **Release URL** or a **default-branch** anchor (README / `docs/`), not a marketing microsite.

**Thread scaffold (copy and trim):**

1. Ship note: Pharos Desktop **vX.Y.Z** — <!-- one-line hook in hero voice -->. Release: `https://github.com/<org>/<repo>/releases/tag/vX.Y.Z`
2. What shipped: <!-- bullet from “What’s new” — link to Release section anchor if you use HTML anchor in body, else link Release + quote the line -->
3. Why it matters: <!-- observability / governance / proof — link README or docs heading -->
4. Upgrade: <!-- link Release “Upgrade & migration” or docs -->
5. Security: <!-- link Release “Security & integrity” + checksum reminder -->

**Guardrails:** Same approved strings deck as README/releases ([PHA-15](/PHA/issues/PHA-15)); distribution only — full narrative stays on GitHub ([PHA-37](/PHA/issues/PHA-37)).

---

*v1 — [PHA-45](/PHA/issues/PHA-45); parent [PHA-44](/PHA/issues/PHA-44).*
