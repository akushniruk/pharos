export interface DocsPortalEntry {
  title: string;
  path: string;
  summary: string;
  showFilePath?: boolean;
}

export interface DocsPortalSection {
  title: string;
  subtitle?: string;
  entries: DocsPortalEntry[];
}

export const DOCS_PORTAL_SECTIONS: DocsPortalSection[] = [
  {
    title: 'Welcome',
    subtitle: 'Pick where to start',
    entries: [
      {
        title: 'Docs overview',
        path: 'docs/README.md',
        summary:
          'Supported agent runtimes (first-class), audiences, and how guides are organized.',
      },
      {
        title: 'Documentation and versions',
        path: 'docs/documentation-versioning.md',
        summary: 'How bundled docs map to app releases, tags, and your installed build.',
      },
    ],
  },
  {
    title: 'Getting started',
    subtitle: 'Tutorials — first working setup',
    entries: [
      {
        title: 'Desktop app',
        path: 'docs/getting-started-desktop.md',
        summary: 'Install the packaged app and view sessions with a local daemon.',
      },
      {
        title: 'Web dashboard on your machine',
        path: 'docs/getting-started-daemon-web.md',
        summary: 'Run the Rust daemon and Solid UI from source (typical developer setup).',
      },
      {
        title: 'Daemon on a server (VPS)',
        path: 'docs/getting-started-remote-daemon.md',
        summary: 'Run the daemon remotely and point the dashboard at it.',
      },
    ],
  },
  {
    title: 'Understand Pharos',
    subtitle: 'Context for evaluators, security, and builders',
    entries: [
      {
        title: 'Desktop vs web dashboard',
        path: 'docs/desktop-vs-daemon-web.md',
        summary: 'What each shape is, when to choose it, ports, and data location.',
      },
      {
        title: 'Why Pharos exists',
        path: 'docs/positioning.md',
        summary: 'Security-led positioning, audiences, and proof themes.',
      },
      {
        title: 'Sessions, events, and the graph',
        path: 'docs/understanding-sessions-and-events.md',
        summary: 'What you see in the UI and how it maps to agent transcripts.',
      },
      {
        title: 'Security and data boundaries',
        path: 'docs/security-for-reviewers.md',
        summary: 'Local-first execution, auditability, and what is not in scope.',
      },
    ],
  },
  {
    title: 'How it works',
    subtitle: 'Architecture diagrams and data flow',
    entries: [
      {
        title: 'Architecture at a glance',
        path: 'docs/architecture-how-it-works.md',
        summary: 'Figures for transcripts, daemon, dashboard, desktop, and remote setups.',
      },
    ],
  },
  {
    title: 'Using the dashboard',
    subtitle: 'Day-to-day product behavior',
    entries: [
      {
        title: 'Reading the event stream',
        path: 'docs/event-stream-ux-guide.md',
        summary: 'Simple vs detailed mode, search, filters, expansion, and attention banners.',
      },
    ],
  },
  {
    title: 'Reference',
    subtitle: 'Integrators and automation',
    entries: [
      {
        title: 'HTTP and WebSocket API',
        path: 'docs/frontend-api-reference.md',
        summary: 'Endpoints and stream contract consumed by the dashboard.',
      },
    ],
  },
  {
    title: 'Contributing',
    subtitle: 'People working in this repository',
    entries: [
      {
        title: 'How to contribute',
        path: 'CONTRIBUTING.md',
        summary: 'PRs, tests, and expectations for contributors.',
      },
      {
        title: 'Repository overview (README)',
        path: 'README.md',
        summary: 'Clone, Makefile targets, and layout of the monorepo.',
      },
      {
        title: 'Architecture cheat sheet',
        path: 'CLAUDE.md',
        summary: 'Daemon, events, and session terms for agent-assisted development.',
      },
      {
        title: 'Workspace notes (AGENTS.md)',
        path: 'AGENTS.md',
        summary:
          'Tooling, commands, and style for humans and coding assistants working in this repository.',
      },
      {
        title: 'Releases',
        path: 'docs/releases.md',
        summary: 'Tag workflow, drafts, and publishing desktop builds.',
      },
    ],
  },
];

export function slugifyPath(path: string): string {
  return path
    .replace(/\.md$/, '')
    .replace(/\//g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .toLowerCase();
}

export function docsEntryByPath(path: string): DocsPortalEntry | undefined {
  for (const section of DOCS_PORTAL_SECTIONS) {
    const entry = section.entries.find((e) => e.path === path);
    if (entry) return entry;
  }
  return undefined;
}

export function docsEntryBySlug(slug: string): DocsPortalEntry | undefined {
  for (const section of DOCS_PORTAL_SECTIONS) {
    const entry = section.entries.find((e) => slugifyPath(e.path) === slug);
    if (entry) return entry;
  }
  return undefined;
}

export const DEFAULT_DOC_PATH = 'docs/README.md';
