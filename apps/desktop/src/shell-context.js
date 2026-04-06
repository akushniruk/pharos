/**
 * Distinguish Tauri desktop from plain browser (local dev, CI, static host / VPS).
 * @returns {{ channel: 'desktop' | 'web', productLabel: string, homeTagline: string }}
 */
export function getShellContext() {
  if (typeof window === "undefined") {
    return {
      channel: "web",
      productLabel: "pharos.web",
      homeTagline: "Web shell — observability MVP.",
    };
  }
  const w = /** @type {Window & Record<string, unknown>} */ (window);
  const inTauri =
    "__TAURI_INTERNALS__" in w || "__TAURI__" in w || Boolean(w.__TAURI__);
  if (inTauri) {
    return {
      channel: "desktop",
      productLabel: "pharos.desktop",
      homeTagline: "Desktop shell — observability MVP.",
    };
  }
  return {
    channel: "web",
    productLabel: "pharos.web",
    homeTagline: "Web shell — observability MVP.",
  };
}
