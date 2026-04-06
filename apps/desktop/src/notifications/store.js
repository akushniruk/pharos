/** @typedef {'info' | 'warning' | 'error' | 'run'} NotifyKind */

/** @typedef {{ id: string, title: string, body: string, kind: NotifyKind, source: string, createdAt: number, read: boolean }} StoredNotification */

const STORAGE_KEY = "pharos.notifications.v1";
const MAX_STORED = 60;

/** @type {Set<(items: StoredNotification[]) => void>} */
const listeners = new Set();

/**
 * @returns {StoredNotification[]}
 */
function loadRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * @param {StoredNotification[]} items
 */
function save(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  for (const fn of listeners) fn(items);
  window.dispatchEvent(
    new CustomEvent("pharos:notifications-changed", { detail: { items } }),
  );
}

/**
 * @returns {StoredNotification[]}
 */
export function getNotifications() {
  return loadRaw();
}

/**
 * @param {(items: StoredNotification[]) => void} fn
 * @returns {() => void}
 */
export function subscribeNotifications(fn) {
  listeners.add(fn);
  fn(getNotifications());
  return () => listeners.delete(fn);
}

/**
 * @param {{ title: string, body?: string, kind?: NotifyKind, source?: string }} input
 * @returns {StoredNotification}
 */
export function pushNotification(input) {
  const title = String(input.title || "").trim() || "Notice";
  const body = String(input.body ?? "").trim();
  const kind = input.kind ?? "info";
  const source = input.source ?? "app";

  const item = /** @type {StoredNotification} */ ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    title,
    body,
    kind,
    source,
    createdAt: Date.now(),
    read: false,
  });

  const next = [item, ...loadRaw()].slice(0, MAX_STORED);
  save(next);
  window.dispatchEvent(new CustomEvent("pharos:toast", { detail: { item } }));
  return item;
}

/**
 * @param {string} id
 */
export function markRead(id) {
  const next = loadRaw().map((n) =>
    n.id === id ? { ...n, read: true } : n,
  );
  save(next);
}

export function markAllRead() {
  const next = loadRaw().map((n) => ({ ...n, read: true }));
  save(next);
}

export function clearAll() {
  save([]);
}
