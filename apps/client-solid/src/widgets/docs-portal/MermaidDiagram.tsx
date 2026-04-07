import { onMount } from 'solid-js';

let mermaidInit: Promise<void> | null = null;

function ensureMermaidInit(): Promise<void> {
  if (!mermaidInit) {
    mermaidInit = import('mermaid').then((m) => {
      m.default.initialize({
        startOnLoad: false,
        theme: 'dark',
        securityLevel: 'strict',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
      });
    });
  }
  return mermaidInit;
}

let renderSeq = 0;

export function MermaidDiagram(props: { source: string }) {
  let host: HTMLDivElement | undefined;

  onMount(() => {
    const el = host;
    if (!el) return;
    let cancelled = false;

    void (async () => {
      try {
        await ensureMermaidInit();
        const mermaid = (await import('mermaid')).default;
        const id = `mermaid-svg-${renderSeq++}`;
        const { svg } = await mermaid.render(id, props.source.trim());
        if (cancelled || !el) return;
        el.innerHTML = svg;
      } catch {
        if (cancelled || !el) return;
        el.replaceChildren();
        const pre = document.createElement('pre');
        pre.className = 'docs-book-raw-code';
        pre.textContent = props.source;
        el.appendChild(pre);
      }
    })();

    return () => {
      cancelled = true;
    };
  });

  return <div class="docs-book-mermaid" ref={(div) => (host = div)} />;
}
