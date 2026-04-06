import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: false,
  mangle: false,
  headerIds: true,
});

/**
 * @param {string} markdown
 * @returns {string}
 */
export function renderMarkdown(markdown) {
  return String(marked.parse(markdown));
}
