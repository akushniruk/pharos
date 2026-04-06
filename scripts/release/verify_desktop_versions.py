#!/usr/bin/env python3
"""Ensure apps/desktop version fields stay aligned and match a release tag (when tagging).

Reads:
  - apps/desktop/package.json (version)
  - apps/desktop/src-tauri/tauri.conf.json (version)
  - apps/desktop/src-tauri/Cargo.toml ([package] version)

When GITHUB_REF is refs/tags/vX.Y.Z, all three must equal X.Y.Z (semver without leading v).
Otherwise, all three must still match each other (CI / local guard).
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
DESKTOP = REPO / "apps" / "desktop"
PKG_JSON = DESKTOP / "package.json"
TAURI_CONF = DESKTOP / "src-tauri" / "tauri.conf.json"
CARGO_TOML = DESKTOP / "src-tauri" / "Cargo.toml"


def _read_package_version() -> str:
    data = json.loads(PKG_JSON.read_text(encoding="utf-8"))
    return str(data["version"])


def _read_tauri_version() -> str:
    data = json.loads(TAURI_CONF.read_text(encoding="utf-8"))
    return str(data["version"])


def _read_cargo_version() -> str:
    text = CARGO_TOML.read_text(encoding="utf-8")
    m = re.search(r"^version\s*=\s*\"([^\"]+)\"", text, re.MULTILINE)
    if not m:
        print("Could not find [package] version in Cargo.toml", file=sys.stderr)
        sys.exit(1)
    return m.group(1)


def _tag_version_from_ref(ref: str) -> str | None:
    prefix = "refs/tags/"
    if not ref.startswith(prefix):
        return None
    tag = ref.removeprefix(prefix)
    return tag.removeprefix("v")


def main() -> None:
    ref = os.environ.get("GITHUB_REF", "")
    tag_expected = _tag_version_from_ref(ref)

    versions = {
        "apps/desktop/package.json": _read_package_version(),
        "apps/desktop/src-tauri/tauri.conf.json": _read_tauri_version(),
        "apps/desktop/src-tauri/Cargo.toml": _read_cargo_version(),
    }
    distinct = set(versions.values())
    if len(distinct) != 1:
        print("Desktop version mismatch:", file=sys.stderr)
        for path, ver in versions.items():
            print(f"  {path}: {ver}", file=sys.stderr)
        sys.exit(1)

    resolved = next(iter(distinct))
    if tag_expected is not None and resolved != tag_expected:
        print(
            f"Release tag expects version {tag_expected!r} "
            f"but desktop manifests are {resolved!r} ({ref}). "
            "Bump package.json, tauri.conf.json, and Cargo.toml together.",
            file=sys.stderr,
        )
        sys.exit(1)

    suffix = f" (matches tag {ref})" if tag_expected else ""
    print(f"OK: desktop version {resolved} is consistent{suffix}")


if __name__ == "__main__":
    main()
