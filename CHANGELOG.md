# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Square Tauri icon master (`apps/desktop/src-tauri/icons/source/app-icon.svg`) and generated bundle icons (Pharos mark on brand indigo).
- GitHub Actions workflow to build desktop artifacts and attach them to a **draft** GitHub Release on version tags (`v*.*.*`).
- Release process documentation under `docs/releases.md`.

### Changed

- `release-desktop` workflow release body now pulls the matching `CHANGELOG.md` section for the tagged version when present, with a QA / marketing footer.
