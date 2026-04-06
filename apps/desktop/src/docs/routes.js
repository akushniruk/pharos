/**
 * In-app docs routes aligned with docs/site/docs-ia-content-outline-v1.md (CMO handoff).
 * `load` returns the markdown source string (Vite ?raw default export).
 */

/** @typedef {{ path: string, title: string, section: string, load: () => Promise<{ default: string }> }} DocRoute */

/** @type {DocRoute[]} */
export const DOC_ROUTES = [
  {
    path: "/docs",
    title: "Documentation",
    section: "Home",
    load: () => import("./content/home.md?raw"),
  },
  {
    path: "/docs/start",
    title: "Start with Pharos",
    section: "Start",
    load: () => import("./content/start.md?raw"),
  },
  {
    path: "/docs/concepts/what-is-pharos",
    title: "What is Pharos?",
    section: "Concepts",
    load: () => import("./content/what-is-pharos.md?raw"),
  },
  {
    path: "/docs/concepts/observability-slice",
    title: "The observability slice",
    section: "Concepts",
    load: () => import("../../../../docs/mvp-observability-slice.md?raw"),
  },
  {
    path: "/docs/concepts/agent-graph",
    title: "Relationship graph",
    section: "Concepts",
    load: () => import("./content/agent-graph.md?raw"),
  },
  {
    path: "/docs/guides/install-desktop",
    title: "Install Pharos Desktop",
    section: "Guides",
    load: () => import("./content/install-desktop.md?raw"),
  },
  {
    path: "/docs/guides/releases-and-upgrades",
    title: "Releases and upgrades",
    section: "Guides",
    load: () => import("./content/releases-and-upgrades.md?raw"),
  },
  {
    path: "/docs/reference/cli-and-scripts",
    title: "CLI and automation",
    section: "Reference",
    load: () => import("./content/cli-and-scripts.md?raw"),
  },
  {
    path: "/docs/reference/api-contracts",
    title: "API reference",
    section: "Reference",
    load: () => import("./content/api-contracts.md?raw"),
  },
  {
    path: "/docs/security/trust-and-data",
    title: "Trust, data, and local execution",
    section: "Security",
    load: () => import("./content/trust-and-data.md?raw"),
  },
  {
    path: "/docs/security/governance-patterns",
    title: "Governance patterns",
    section: "Security",
    load: () => import("./content/governance-patterns.md?raw"),
  },
  {
    path: "/docs/changelog",
    title: "Changelog",
    section: "Changelog",
    load: () => import("../../../../CHANGELOG.md?raw"),
  },
];

/** @param {string} pathname */
export function findRoute(pathname) {
  const normalized =
    pathname.endsWith("/") && pathname.length > 1
      ? pathname.slice(0, -1)
      : pathname;
  return DOC_ROUTES.find((r) => r.path === normalized) ?? null;
}
