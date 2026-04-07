# Documentation and versions

**Audience:** Anyone using the **in-app** or **web** docs who needs to confirm that what they read matches the **Pharos build** they installed.

---

## What version are these docs?

The documentation bundled with the dashboard is versioned with the **same semver as the Solid client** (`apps/client-solid/package.json`). The **desktop app** and **daemon** crates are released on the same tag when you install from a **GitHub Release**.

In the docs reader you should see the **docs bundle version** in:

- The **documentation sidebar** (under the Documentation label).
- A short **banner** above the article.
- The **browser tab title** on docs pages (includes the version after “Docs”).

If those do not match the version you expect, you are likely on a **different build** (e.g. older installer, or a local dev checkout of `main` that is ahead of the last tag).

---

## Releases and tags

- **Shipped builds** are tied to **Git tags** `v*.*.*` and described in [Releases](releases.md) and the repo [CHANGELOG](../CHANGELOG.md).
- **Open the changelog** for the list of user-visible changes per version.
- **Self-built from `main`:** docs describe the current branch; the bundle version is still the value in `package.json` at the time you run `pnpm run build`, which may be **newer** than the latest published tag.

---

## Older versions

This repository’s docs portal currently ships **one** documentation bundle per app version. To read docs for an older release, open the repo (or release archive) at the corresponding **`v*` tag** and use the `docs/` tree there, or use the release’s source tarball.

---

## Related

- [Docs overview](README.md)
- [Releases](releases.md)
