import { For, Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js';

import { extractHeadings, MarkdownDocument } from './DocsBook';

export default function DocsReadingGuide(props: {
  selectedDocPath: string;
  selectedDocContent?: string;
  onSelectDocPath?: (path: string, fragment?: string) => void;
}) {
  const docHeadings = createMemo(() => extractHeadings(props.selectedDocContent ?? ''));
  const [activeHeadingId, setActiveHeadingId] = createSignal<string | null>(null);
  let docsScrollEl: HTMLElement | undefined;

  createEffect(() => {
    const headings = docHeadings();
    setActiveHeadingId(headings[0]?.id ?? null);
  });

  let lastScrollResetPath: string | undefined;
  createEffect(() => {
    const path = props.selectedDocPath;
    props.selectedDocContent;
    queueMicrotask(() => {
      const el = docsScrollEl;
      if (!el) return;
      if (path !== lastScrollResetPath) {
        el.scrollTop = 0;
        lastScrollResetPath = path;
      }
    });
  });

  createEffect(() => {
    const container = docsScrollEl;
    if (!container) return;
    const onScroll = () => {
      const headings = docHeadings();
      if (headings.length === 0) {
        setActiveHeadingId(null);
        return;
      }
      const top = container.getBoundingClientRect().top + 64;
      let current = headings[0].id;
      for (const heading of headings) {
        const el = document.getElementById(heading.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= top) {
          current = heading.id;
        } else {
          break;
        }
      }
      setActiveHeadingId(current);
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    window.setTimeout(onScroll, 0);
    onCleanup(() => {
      container.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    });
  });

  return (
    <div class="reading-guide-shell docs-layout">
      <div class="docs-book-content-shell">
        <section
          class="docs-book-content"
          ref={(el) => {
            docsScrollEl = el;
          }}
        >
          <Show
            when={props.selectedDocContent}
            fallback={
              <p class="docs-portal-empty">
                This document is not available in the app bundle.
              </p>
            }
          >
            <div class="docs-book-article-wrap">
              <MarkdownDocument
                markdown={props.selectedDocContent || ''}
                sourcePath={props.selectedDocPath}
                onSelectDocPath={props.onSelectDocPath}
              />
            </div>
          </Show>
        </section>
        <aside class="docs-book-toc">
          <div class="docs-book-toc-title">On this page</div>
          <div class="docs-book-toc-list">
            <For each={docHeadings()}>
              {(heading) => (
                <button
                  type="button"
                  class="docs-book-toc-item"
                  classList={{
                    'is-active': activeHeadingId() === heading.id,
                    'is-level2': heading.level === 2,
                    'is-level3': heading.level === 3,
                  }}
                  onClick={() => {
                    const target = document.getElementById(heading.id);
                    setActiveHeadingId(heading.id);
                    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                >
                  {heading.title}
                </button>
              )}
            </For>
          </div>
        </aside>
      </div>
    </div>
  );
}
