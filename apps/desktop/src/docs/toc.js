/** In-page TOC + scroll spy (docs-page-ux-spec §3, §5). */

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function slugify(text) {
  const base = String(text)
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  const t = base.replace(/^-|-$/g, "");
  return t || "section";
}

/**
 * @param {HTMLElement} article
 * @returns {{ id: string, level: number, text: string, el: HTMLElement }[]}
 */
export function ensureHeadingIds(article) {
  const used = new Set();
  const headings = article.querySelectorAll("h2, h3");
  headings.forEach((el) => {
    let id = el.id;
    if (!id) {
      let base = slugify(el.textContent || "");
      id = base;
      let n = 2;
      while (used.has(id)) id = `${base}-${n++}`;
      el.id = id;
    }
    used.add(el.id);
  });
  return [...headings].map((el) => ({
    id: el.id,
    level: el.tagName === "H2" ? 2 : 3,
    text: el.textContent?.trim() || "",
    el,
  }));
}

/**
 * @param {HTMLElement} root
 * @param {HTMLElement} article
 * @param {string} basePath
 * @param {() => void} afterClick
 */
export function fillInpageTocs(root, article, basePath, afterClick) {
  const navs = root.querySelectorAll("[data-ph-inpage-toc]");
  const headings = ensureHeadingIds(article);

  for (const nav of navs) {
    nav.replaceChildren();
    if (!headings.length) {
      const p = document.createElement("p");
      p.className = "ph-docs-toc-empty";
      p.textContent = "No sections on this page";
      nav.appendChild(p);
      continue;
    }
    for (const h of headings) {
      const a = document.createElement("a");
      a.href = `${basePath}#${encodeURIComponent(h.id)}`;
      a.dataset.targetId = h.id;
      a.className = `ph-inpage-toc__link ph-inpage-toc__link--h${h.level}`;
      a.textContent = h.text;
      a.title = h.text;
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const t = article.querySelector(`#${CSS.escape(h.id)}`);
        if (t) {
          t.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" });
          t.focus({ preventScroll: true });
        }
        afterClick();
      });
      nav.appendChild(a);
    }
  }

  return headings;
}

/**
 * @param {{ id: string, el: HTMLElement }[]} headings
 * @param {HTMLElement} root
 * @returns {() => void}
 */
export function bindInpageTocSpy(headings, root) {
  const links = root.querySelectorAll("a.ph-inpage-toc__link");
  if (!headings.length || !links.length) return () => {};

  const setActive = (id) => {
    links.forEach((a) => {
      const on = a.dataset.targetId === id;
      a.classList.toggle("is-active", on);
      if (on) a.setAttribute("aria-current", "location");
      else a.removeAttribute("aria-current");
    });
  };

  const io = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (!visible.length) return;
      const id = visible[0].target.id;
      if (id) setActive(id);
    },
    { root: null, rootMargin: "-18% 0px -52% 0px", threshold: [0, 0.25, 0.5, 1] },
  );

  for (const h of headings) io.observe(h.el);

  return () => io.disconnect();
}

/**
 * @param {HTMLElement} article
 */
export function scrollToArticleHash(article) {
  const hash = decodeURIComponent(location.hash.slice(1));
  if (!hash) return;
  requestAnimationFrame(() => {
    const t = article.querySelector(`#${CSS.escape(hash)}`);
    t?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" });
  });
}
