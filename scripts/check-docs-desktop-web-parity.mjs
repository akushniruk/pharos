#!/usr/bin/env node
/**
 * Ensures desktop in-app docs (`apps/desktop/src/docs/routes.js` ?raw imports) and
 * the Solid docs portal (`apps/client-solid/src/lib/docsPortal.ts` entry paths) stay
 * intentionally aligned: any drift must be documented in
 * `scripts/docs-desktop-web-parity-allowlist.json`.
 *
 * `slugRoutes.ts` only derives slugs from `DOCS_PORTAL_SECTIONS`; no separate extraction.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, relative, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

const ROUTES_FILE = join(REPO_ROOT, 'apps/desktop/src/docs/routes.js');
const PORTAL_FILE = join(REPO_ROOT, 'apps/client-solid/src/lib/docsPortal.ts');
const ALLOWLIST_FILE = join(REPO_ROOT, 'scripts/docs-desktop-web-parity-allowlist.json');

function toPosix(p) {
  return p.split(/\\/g).join('/');
}

function posixRelative(fromRoot, absolutePath) {
  return toPosix(relative(fromRoot, normalize(absolutePath)));
}

/** @returns {Set<string>} */
function loadDesktopMarkdownPaths() {
  const text = readFileSync(ROUTES_FILE, 'utf8');
  const routesDir = dirname(ROUTES_FILE);
  const re = /import\(\s*["']([^"']+?)\?raw["']\s*\)/g;
  const out = new Set();
  let m;
  while ((m = re.exec(text))) {
    const spec = m[1];
    const abs = normalize(join(routesDir, spec));
    out.add(posixRelative(REPO_ROOT, abs));
  }
  return out;
}

/** @returns {Set<string>} */
function loadWebPortalPaths() {
  const text = readFileSync(PORTAL_FILE, 'utf8');
  const re = /path:\s*['"]([^'"]+)['"]/g;
  const out = new Set();
  let m;
  while ((m = re.exec(text))) {
    out.add(m[1]);
  }
  return out;
}

function loadAllowlist() {
  if (!existsSync(ALLOWLIST_FILE)) {
    return { onlyOnDesktop: [], onlyOnWeb: [] };
  }
  const raw = JSON.parse(readFileSync(ALLOWLIST_FILE, 'utf8'));
  return {
    onlyOnDesktop: raw.onlyOnDesktop ?? [],
    onlyOnWeb: raw.onlyOnWeb ?? [],
  };
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function main() {
  const desktop = loadDesktopMarkdownPaths();
  const web = loadWebPortalPaths();
  const allow = loadAllowlist();

  const onlyOnDesktop = [...desktop].filter((p) => !web.has(p)).sort();
  const onlyOnWeb = [...web].filter((p) => !desktop.has(p)).sort();

  const allowedDesktop = new Set(allow.onlyOnDesktop.map((e) => e.path));
  const allowedWeb = new Set(allow.onlyOnWeb.map((e) => e.path));

  for (const p of desktop) {
    const full = join(REPO_ROOT, p);
    if (!existsSync(full)) {
      fail(`check-docs-desktop-web-parity: desktop route points to missing file: ${p}`);
    }
  }

  for (const p of web) {
    const full = join(REPO_ROOT, p);
    if (!existsSync(full)) {
      fail(`check-docs-desktop-web-parity: docs portal path missing on disk: ${p}`);
    }
  }

  const errors = [];

  for (const p of onlyOnDesktop) {
    if (!allowedDesktop.has(p)) {
      errors.push(`Only on desktop (add to allowlist or sync portal): ${p}`);
    }
  }
  for (const p of onlyOnWeb) {
    if (!allowedWeb.has(p)) {
      errors.push(`Only on web portal (add to allowlist or sync desktop routes): ${p}`);
    }
  }

  for (const e of allow.onlyOnDesktop) {
    if (!onlyOnDesktop.includes(e.path)) {
      errors.push(`Stale allowlist onlyOnDesktop entry (no longer a drift): ${e.path}`);
    }
    if (!e.rationale || String(e.rationale).trim() === '') {
      errors.push(`Allowlist onlyOnDesktop missing rationale: ${e.path}`);
    }
  }
  for (const e of allow.onlyOnWeb) {
    if (!onlyOnWeb.includes(e.path)) {
      errors.push(`Stale allowlist onlyOnWeb entry (no longer a drift): ${e.path}`);
    }
    if (!e.rationale || String(e.rationale).trim() === '') {
      errors.push(`Allowlist onlyOnWeb missing rationale: ${e.path}`);
    }
  }

  if (errors.length) {
    fail(
      ['check-docs-desktop-web-parity: failed.', '', ...errors, '', `Allowlist: ${posixRelative(REPO_ROOT, ALLOWLIST_FILE)}`].join(
        '\n',
      ),
    );
  }

  console.log(
    `check-docs-desktop-web-parity: ok (${desktop.size} desktop markdown paths, ${web.size} portal paths, ${onlyOnDesktop.length} + ${onlyOnWeb.length} documented drifts).`,
  );
}

main();
