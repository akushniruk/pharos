import {
  clearAll,
  getNotifications,
  markAllRead,
  markRead,
  subscribeNotifications,
} from "./store.js";

const TOAST_MS = 9000;
const TOAST_ERR_MS = 24000;

/** @param {string} kind */
function kindClass(kind) {
  switch (kind) {
    case "error":
      return "ph-notify-toast--error";
    case "warning":
      return "ph-notify-toast--warning";
    case "run":
      return "ph-notify-toast--run";
    default:
      return "ph-notify-toast--info";
  }
}

/**
 * @param {HTMLElement} stack
 * @param {{ id: string, title: string, body: string, kind: string }} item
 */
function showToast(stack, item) {
  const el = document.createElement("div");
  el.className = `ph-notify-toast ${kindClass(item.kind)}`;
  el.setAttribute("role", item.kind === "error" ? "alert" : "status");
  el.innerHTML = `
    <div class="ph-notify-toast-inner">
      <p class="ph-notify-toast-title"></p>
      <p class="ph-notify-toast-body" hidden></p>
      <button type="button" class="ph-notify-toast-close" aria-label="Dismiss notification">×</button>
    </div>`;
  const titleEl = el.querySelector(".ph-notify-toast-title");
  const bodyEl = el.querySelector(".ph-notify-toast-body");
  const closeBtn = el.querySelector(".ph-notify-toast-close");
  if (titleEl) titleEl.textContent = item.title;
  if (bodyEl) {
    if (item.body) {
      bodyEl.textContent = item.body;
      bodyEl.removeAttribute("hidden");
    }
  }
  const dismiss = () => {
    el.remove();
    markRead(item.id);
  };
  closeBtn?.addEventListener("click", dismiss);
  stack.appendChild(el);
  const ms = item.kind === "error" ? TOAST_ERR_MS : TOAST_MS;
  window.setTimeout(() => {
    if (el.isConnected) dismiss();
  }, ms);
}

/**
 * @param {HTMLElement} list
 */
function renderList(list) {
  const items = getNotifications();
  if (!items.length) {
    list.innerHTML =
      '<p class="ph-notify-panel-empty">No notifications yet.</p>';
    return;
  }
  list.innerHTML = items
    .map((n) => {
      const unread = n.read ? "" : " ph-notify-row--unread";
      const body = n.body
        ? `<p class="ph-notify-row-body">${escapeHtml(n.body)}</p>`
        : "";
      return `<li class="ph-notify-row${unread}" data-id="${escapeAttr(n.id)}">
        <span class="ph-notify-row-kind ph-notify-row-kind--${escapeAttr(n.kind)}">${escapeHtml(n.kind)}</span>
        <p class="ph-notify-row-title">${escapeHtml(n.title)}</p>
        ${body}
        <time class="ph-notify-row-time" datetime="${new Date(n.createdAt).toISOString()}">${formatTime(n.createdAt)}</time>
      </li>`;
    })
    .join("");
}

/**
 * @param {number} t
 */
function formatTime(t) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(t));
  } catch {
    return new Date(t).toLocaleString();
  }
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

export function mountNotificationHost() {
  if (document.getElementById("ph-notify-host")) return;

  const host = document.createElement("div");
  host.id = "ph-notify-host";
  host.innerHTML = `
    <div class="ph-notify-toast-stack" aria-label="Notifications"></div>
    <div class="ph-notify-chrome">
      <button type="button" class="ph-notify-bell" aria-expanded="false" aria-controls="ph-notify-panel" aria-label="Open notification inbox">
        <svg class="ph-notify-bell-icon" aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        <span class="ph-notify-bell-badge" hidden data-count>0</span>
      </button>
      <div id="ph-notify-panel" class="ph-notify-panel" hidden role="dialog" aria-label="Notification inbox">
        <div class="ph-notify-panel-head">
          <h2 class="ph-notify-panel-title">Inbox</h2>
          <div class="ph-notify-panel-actions">
            <button type="button" class="ph-notify-text-btn" data-action="read-all">Mark all read</button>
            <button type="button" class="ph-notify-text-btn" data-action="clear">Clear</button>
          </div>
        </div>
        <ul class="ph-notify-list" aria-live="polite"></ul>
      </div>
    </div>
  `;
  document.body.appendChild(host);

  const stack = /** @type {HTMLElement} */ (host.querySelector(".ph-notify-toast-stack"));
  const bell = /** @type {HTMLButtonElement | null} */ (host.querySelector(".ph-notify-bell"));
  const panel = /** @type {HTMLElement | null} */ (host.querySelector("#ph-notify-panel"));
  const list = /** @type {HTMLElement | null} */ (host.querySelector(".ph-notify-list"));
  const badge = /** @type {HTMLElement | null} */ (host.querySelector(".ph-notify-bell-badge"));

  function updateBadge(items) {
    const n = items.filter((i) => !i.read).length;
    if (!badge) return;
    if (n > 0) {
      badge.removeAttribute("hidden");
      badge.textContent = String(n > 99 ? "99+" : n);
      badge.setAttribute("data-count", String(n));
    } else {
      badge.setAttribute("hidden", "");
    }
  }

  function refreshPanel() {
    if (list) renderList(list);
    updateBadge(getNotifications());
  }

  subscribeNotifications((items) => {
    updateBadge(items);
    if (panel && !panel.hidden && list) renderList(list);
  });

  window.addEventListener("pharos:toast", (ev) => {
    const ce = /** @type {CustomEvent} */ (ev);
    const item = ce.detail?.item;
    if (item && stack) showToast(stack, item);
  });

  bell?.addEventListener("click", () => {
    const open = panel?.hidden === false;
    if (open) {
      panel?.setAttribute("hidden", "");
      bell?.setAttribute("aria-expanded", "false");
    } else {
      panel?.removeAttribute("hidden");
      bell?.setAttribute("aria-expanded", "true");
      refreshPanel();
    }
  });

  list?.addEventListener("click", (e) => {
    const row = e.target instanceof Element ? e.target.closest(".ph-notify-row") : null;
    const id = row?.getAttribute("data-id");
    if (id) {
      markRead(id);
      refreshPanel();
    }
  });

  panel?.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const action = t.closest("[data-action]")?.getAttribute("data-action");
    if (action === "read-all") {
      markAllRead();
      refreshPanel();
    }
    if (action === "clear") {
      clearAll();
      refreshPanel();
    }
  });

  document.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof Node)) return;
    if (!host.contains(t) && panel && !panel.hidden) {
      panel.setAttribute("hidden", "");
      bell?.setAttribute("aria-expanded", "false");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && panel && !panel.hidden) {
      panel.setAttribute("hidden", "");
      bell?.setAttribute("aria-expanded", "false");
    }
  });

  refreshPanel();
}
