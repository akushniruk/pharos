import { DOC_ROUTES, findRoute } from "./routes.js";
import { renderMarkdown } from "./render-md.js";
import { getShellContext } from "../shell-context.js";
import { pushNotification } from "../notifications/store.js";
import {
  bindInpageTocSpy,
  fillInpageTocs,
  scrollToArticleHash,
} from "./toc.js";

const TOP_NAV = [
  { path: "/docs/start", label: "Start" },
  { path: "/docs/concepts", label: "Concepts" },
  { path: "/docs/guides", label: "Guides" },
  { path: "/docs/reference", label: "Reference" },
  { path: "/docs/security", label: "Security" },
  { path: "/docs/changelog", label: "Changelog" },
];

/** @type {() => void} */
let disconnectTocSpy = () => {};

function groupBySection() {
  /** @type {Map<string, typeof DOC_ROUTES>} */
  const map = new Map();
  for (const route of DOC_ROUTES) {
    if (route.path === "/docs") continue;
    const list = map.get(route.section) ?? [];
    list.push(route);
    map.set(route.section, list);
  }
  return map;
}

function closeMobileDocsNav(root) {
  root.querySelector("#ph-docs-sidebar")?.classList.remove("is-open");
  root.querySelector(".ph-docs-backdrop")?.setAttribute("hidden", "");
  const btn = root.querySelector(".ph-docs-menu-btn");
  btn?.setAttribute("aria-expanded", "false");
  document.body.classList.remove("ph-docs-nav-open");
}

/**
 * @param {HTMLElement} root
 */
function wireMobileDocsChrome(root) {
  if (root.dataset.phMobileChromeWired) return;
  root.dataset.phMobileChromeWired = "1";
  const btn = root.querySelector(".ph-docs-menu-btn");
  const aside = root.querySelector("#ph-docs-sidebar");
  const backdrop = root.querySelector(".ph-docs-backdrop");
  /** @type {HTMLElement | null} */
  let returnFocusEl = null;

  const close = () => {
    closeMobileDocsNav(root);
    returnFocusEl?.focus();
    returnFocusEl = null;
  };

  const open = () => {
    returnFocusEl =
      document.activeElement instanceof HTMLElement ? document.activeElement : btn;
    aside?.classList.add("is-open");
    backdrop?.removeAttribute("hidden");
    btn?.setAttribute("aria-expanded", "true");
    document.body.classList.add("ph-docs-nav-open");
    const first = aside?.querySelector("a[href], button:not([disabled]), input");
    (first || btn)?.focus();
  };

  btn?.addEventListener("click", () => {
    if (aside?.classList.contains("is-open")) close();
    else open();
  });
  backdrop?.addEventListener("click", close);
  root.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && aside?.classList.contains("is-open")) {
      e.preventDefault();
      close();
    }
  });
}

/**
 * @param {HTMLElement} root
 */
function setInpageTocLoading(root) {
  disconnectTocSpy();
  disconnectTocSpy = () => {};
  for (const nav of root.querySelectorAll("[data-ph-inpage-toc]")) {
    nav.innerHTML = `
      <div class="ph-docs-toc-loading" aria-busy="true">
        <div class="ph-docs-toc-loading-row"></div>
        <div class="ph-docs-toc-loading-row"></div>
        <div class="ph-docs-toc-loading-row ph-docs-toc-loading-row--short"></div>
      </div>`;
  }
}

/**
 * @param {HTMLElement} root
 * @param {string} pathForHash
 */
function refreshInpageToc(root, pathForHash) {
  const article = root.querySelector(".ph-docs-article");
  if (!article) return;
  disconnectTocSpy();
  disconnectTocSpy = () => {};

  const mobileTitle = root.querySelector(".ph-docs-mobile-title");
  const h1 = article.querySelector("h1");
  if (mobileTitle) {
    mobileTitle.textContent = h1?.textContent?.trim() || "";
  }

  const headings = fillInpageTocs(
    root,
    article,
    pathForHash,
    () => closeMobileDocsNav(root),
  );
  disconnectTocSpy = bindInpageTocSpy(headings, root);
  scrollToArticleHash(article);
}

/**
 * @param {HTMLElement} root
 */
export function mountApp(root) {
  root.innerHTML = "";

  window.addEventListener("popstate", () => {
    void renderPath(root, window.location.pathname);
  });

  window.addEventListener("hashchange", () => {
    if (!window.location.pathname.startsWith("/docs")) return;
    const article = document.querySelector(".ph-docs-article");
    if (article instanceof HTMLElement) scrollToArticleHash(article);
  });

  document.addEventListener("click", (ev) => {
    const target = ev.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest("a");
    if (!anchor || !anchor.href) return;
    const url = new URL(anchor.href);
    if (url.origin !== window.location.origin) return;
    if (url.pathname === "/" || url.pathname === "") {
      ev.preventDefault();
      window.history.pushState(null, "", "/");
      void renderPath(root, "/");
      return;
    }
    if (!url.pathname.startsWith("/docs")) return;
    ev.preventDefault();
    navigate(url.pathname + url.search + url.hash);
  });

  void renderPath(root, window.location.pathname);
}

/**
 * @param {string} pathname
 */
export function navigate(pathname) {
  window.history.pushState(null, "", pathname);
  const app = document.getElementById("app");
  if (app) void renderPath(app, pathname);
}

function pathMatchesTopNav(path, topPath) {
  if (path === topPath) return true;
  if (topPath === "/docs/start" && path.startsWith("/docs/start")) return true;
  if (topPath === "/docs/concepts" && path.startsWith("/docs/concepts")) return true;
  if (topPath === "/docs/guides" && path.startsWith("/docs/guides")) return true;
  if (topPath === "/docs/reference" && path.startsWith("/docs/reference")) return true;
  if (topPath === "/docs/security" && path.startsWith("/docs/security"))
    return true;
  if (topPath === "/docs/changelog" && path.startsWith("/docs/changelog")) return true;
  return false;
}

function loadingSkeletonHtml() {
  return `
    <div class="ph-docs-skeleton" aria-busy="true">
      <div class="ph-docs-skeleton-title"></div>
      <div class="ph-docs-skeleton-line"></div>
      <div class="ph-docs-skeleton-line ph-docs-skeleton-line--mid"></div>
      <div class="ph-docs-skeleton-line"></div>
      <div class="ph-docs-skeleton-line ph-docs-skeleton-line--short"></div>
    </div>`;
}

/**
 * @param {HTMLElement} root
 * @param {string} pathname
 */
async function renderPath(root, pathname) {
  if (!pathname.startsWith("/docs")) {
    disconnectTocSpy();
    disconnectTocSpy = () => {};
    renderHome(root);
    document.title = getShellContext().productLabel;
    return;
  }

  const route = findRoute(pathname);
  const pathKey =
    pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;

  if (!route) {
    renderDocsShell(root, null);
    wireMobileDocsChrome(root);
    const article = root.querySelector(".ph-docs-article");
    if (article) {
      article.innerHTML = `
        <h1>Page not found</h1>
        <p class="ph-docs-lead">No documentation page matches this URL.</p>
        <p><a href="/docs">Back to docs home</a></p>`;
    }
    document.title = `Not found · ${getShellContext().productLabel} docs`;
    refreshInpageToc(root, pathKey);
    return;
  }

  renderDocsShell(root, route.path);
  wireMobileDocsChrome(root);
  const article = root.querySelector(".ph-docs-article");
  if (!article) return;

  article.innerHTML = loadingSkeletonHtml();
  setInpageTocLoading(root);

  const mobileTitle = root.querySelector(".ph-docs-mobile-title");
  if (mobileTitle) mobileTitle.textContent = route.title;

  try {
    const mod = await route.load();
    const md = mod.default;
    let html = renderMarkdown(md);
    if (route.path === "/docs/concepts/observability-slice") {
      html =
        '<p class="ph-docs-banner">This page is imported from the repository. Links that point to other repo files (for example <code>../scripts/</code>) are written for the monorepo layout; open the same path in your checkout if a link does not resolve here.</p>' +
        html;
    }
    if (route.path === "/docs/changelog") {
      html =
        '<p class="ph-docs-banner">Imported from root <code>CHANGELOG.md</code>. User-facing release summaries should still follow the GitHub Release workflow in <code>docs/releases.md</code>.</p>' +
        html;
    }
    article.innerHTML = html;
  } catch (err) {
    console.error(err);
    const msg = err instanceof Error ? err.message : String(err);
    pushNotification({
      kind: "error",
      source: "app",
      title: "Documentation failed to load",
      body: `${route.title}: ${msg}`,
    });
    article.innerHTML =
      "<h1>Could not load page</h1><p class=\"ph-docs-lead\">Something went wrong while loading this article. Check the devtools console.</p>";
  }

  document.title = `${route.title} · ${getShellContext().productLabel} docs`;
  syncActiveNav(root, route.path);
  syncTopNav(root, route.path);
  refreshInpageToc(root, route.path);
}

/**
 * @param {HTMLElement} root
 */
function renderHome(root) {
  const { productLabel, homeTagline } = getShellContext();
  root.innerHTML = `
    <div class="ph-app-home">
      <h1>${escapeHtml(productLabel)}</h1>
      <p>${escapeHtml(homeTagline)}</p>
      <p><a href="/docs">Documentation</a></p>
    </div>
  `;
}

/**
 * @param {HTMLElement} root
 * @param {string | null} activePath
 */
function renderDocsShell(root, activePath) {
  if (root.querySelector(".ph-docs")) {
    return;
  }

  root.innerHTML = "";

  const sections = groupBySection();
  const sectionOrder = [
    "Start",
    "Concepts",
    "Guides",
    "Reference",
    "Security",
    "Changelog",
  ];

  const navParts = [
    `<div class="ph-nav-section" data-section="home"><h2>Home</h2><ul><li data-title="documentation home docs"><a href="/docs">Documentation home</a></li></ul></div>`,
  ];
  for (const name of sectionOrder) {
    const routes = sections.get(name);
    if (!routes?.length) continue;
    const items = routes
      .map(
        (r) =>
          `<li data-title="${escapeAttr(r.title.toLowerCase())}"><a href="${r.path}">${escapeHtml(r.title)}</a></li>`,
      )
      .join("");
    navParts.push(
      `<div class="ph-nav-section" data-section="${escapeAttr(name.toLowerCase())}"><h2>${escapeHtml(name)}</h2><ul>${items}</ul></div>`,
    );
  }

  const topLinks = TOP_NAV.map(
    (t) =>
      `<a href="${t.path}" data-path="${t.path}">${escapeHtml(t.label)}</a>`,
  ).join("");

  const brand = escapeHtml(getShellContext().productLabel);

  root.innerHTML = `
    <div class="ph-docs">
      <a class="ph-docs-skip" href="#ph-docs-main">Skip to content</a>
      <header class="ph-docs-header">
        <div class="ph-docs-brand"><a href="/">${brand}</a> · <a href="/docs">Docs</a></div>
        <nav class="ph-docs-topnav" aria-label="Primary">${topLinks}</nav>
      </header>
      <div class="ph-docs-mobile-bar">
        <button type="button" class="ph-docs-menu-btn" aria-expanded="false" aria-controls="ph-docs-sidebar">
          <span class="ph-docs-menu-btn-inner">Docs menu</span>
        </button>
        <span class="ph-docs-mobile-title" aria-live="polite"></span>
      </div>
      <div class="ph-docs-backdrop" hidden></div>
      <div class="ph-docs-body">
        <aside class="ph-docs-aside" id="ph-docs-sidebar" aria-label="Documentation">
          <label class="visually-hidden" for="ph-docs-search">Filter docs pages</label>
          <input id="ph-docs-search" class="ph-docs-search" type="search" placeholder="Filter pages…" autocomplete="off" />
          <nav class="ph-docs-nav" aria-label="Articles">${navParts.join("")}</nav>
          <div class="ph-docs-toc-block">
            <p class="ph-docs-toc-label">On this page</p>
            <nav class="ph-docs-toc-nav" data-ph-inpage-toc aria-label="On this page"></nav>
          </div>
        </aside>
        <div class="ph-docs-main-col">
          <main id="ph-docs-main" class="ph-docs-main" tabindex="-1">
            <article class="ph-docs-article" aria-live="polite"></article>
            <footer class="ph-docs-footer">
              Mission: make AI coding agents observable and understandable — ship and govern with confidence.
            </footer>
          </main>
        </div>
      </div>
    </div>
  `;

  const search = root.querySelector("#ph-docs-search");
  if (search instanceof HTMLInputElement) {
    search.addEventListener("input", () => filterNav(root, search.value));
  }

  if (activePath) {
    syncActiveNav(root, activePath);
    syncTopNav(root, activePath);
  }
}

/**
 * @param {HTMLElement} root
 * @param {string} query
 */
function filterNav(root, query) {
  const q = query.trim().toLowerCase();
  const sections = root.querySelectorAll(".ph-nav-section");
  sections.forEach((sec) => {
    const items = sec.querySelectorAll("li");
    let visible = 0;
    items.forEach((li) => {
      const title = li.getAttribute("data-title") ?? "";
      const match = !q || title.includes(q);
      li.classList.toggle("is-hidden", !match);
      if (match) visible += 1;
    });
    sec.classList.toggle("is-hidden", visible === 0);
  });
}

/**
 * @param {HTMLElement} root
 * @param {string} path
 */
function syncActiveNav(root, path) {
  root.querySelectorAll(".ph-docs-nav a").forEach((a) => {
    const href = a.getAttribute("href");
    a.classList.toggle("is-active", href === path);
  });
}

/**
 * @param {HTMLElement} root
 * @param {string} path
 */
function syncTopNav(root, path) {
  root.querySelectorAll(".ph-docs-topnav a").forEach((a) => {
    const p = a.getAttribute("data-path");
    a.classList.toggle("is-active", !!(p && pathMatchesTopNav(path, p)));
  });
}

/**
 * @param {string} s
 */
function escapeHtml(s) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * @param {string} s
 */
function escapeAttr(s) {
  return escapeHtml(s).replaceAll("\n", " ");
}
