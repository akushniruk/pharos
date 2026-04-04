export interface DocsPortalEntry {
  title: string;
  path: string;
  summary: string;
}

export interface DocsPortalSection {
  title: string;
  entries: DocsPortalEntry[];
}

export const DOCS_PORTAL_SECTIONS: DocsPortalSection[] = [
  {
    title: 'Start Here',
    entries: [
      {
        title: 'Docs Portal Index',
        path: 'docs/README.md',
        summary: 'Primary entry point for project documentation.',
      },
      {
        title: 'Event Stream UX Guide',
        path: 'docs/event-stream-ux-guide.md',
        summary: 'Simple/Detailed behavior, payload modes, and style rules.',
      },
      {
        title: 'Frontend API Reference',
        path: 'docs/frontend-api-reference.md',
        summary: 'HTTP + WebSocket contracts used by the Solid frontend.',
      },
      {
        title: 'Multi-Agent Team Setup',
        path: 'docs/multi-agent-team-setup.md',
        summary: 'PM/FE/BE/Docs/Reviewer ownership and delivery gates.',
      },
    ],
  },
  {
    title: 'UI And Design',
    entries: [
      {
        title: 'Full Solid UI Design Spec',
        path: 'docs/superpowers/specs/2026-04-03-solidjs-full-ui-design.md',
        summary: 'Primary UI contract for layout, interaction, and accessibility.',
      },
      {
        title: 'Pharos V1 Roadmap',
        path: 'docs/superpowers/specs/2026-04-02-v1-roadmap.md',
        summary: 'Product roadmap and phased direction for V1.',
      },
    ],
  },
  {
    title: 'Architecture And Observation',
    entries: [
      {
        title: 'Process-Based Observation Design',
        path: 'docs/superpowers/specs/2026-04-02-process-based-observation-design.md',
        summary: 'Core design for runtime detection and transcript observation.',
      },
      {
        title: 'Claude No-Hook Observation Design',
        path: 'docs/superpowers/specs/2026-04-02-claude-no-hook-observation-design.md',
        summary: 'Earlier design baseline for hook-free Claude visibility.',
      },
    ],
  },
  {
    title: 'Implementation Plans',
    entries: [
      {
        title: 'Rust Core Foundation Plan',
        path: 'docs/superpowers/plans/2026-04-02-pharos-rust-core-foundation.md',
        summary: 'Bootstrap plan for daemon core model, storage, and API.',
      },
      {
        title: 'Process-Based Observation Plan',
        path: 'docs/superpowers/plans/2026-04-02-process-based-observation.md',
        summary: 'Execution steps for process-driven runtime observation.',
      },
      {
        title: 'Gemini Live Event Tailing Plan',
        path: 'docs/superpowers/plans/2026-04-03-gemini-live-event-tailing.md',
        summary: 'Gemini runtime event parsing and scanner integration plan.',
      },
    ],
  },
  {
    title: 'Operations And Release',
    entries: [
      {
        title: 'macOS Desktop Release',
        path: 'docs/macos-desktop-release.md',
        summary: 'Release flow and runbook for shipping the desktop app.',
      },
    ],
  },
  {
    title: 'Project References',
    entries: [
      {
        title: 'Repository Overview',
        path: 'README.md',
        summary: 'Top-level product overview, quick start, and commands.',
      },
      {
        title: 'Architecture Cheat Sheet',
        path: 'CLAUDE.md',
        summary: 'Canonical architecture terms and daemon/frontend pointers.',
      },
      {
        title: 'Rust and Agent Conventions',
        path: 'AGENTS.md',
        summary: 'Rust edition/linting and coding guidance for contributors.',
      },
    ],
  },
];

export const DOCS_PORTAL_RUN_COMMANDS = ['make daemon', 'make client', 'make test'];
