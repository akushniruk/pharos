<script lang="ts">
  import { Marked } from 'marked'
  import hljs from 'highlight.js/lib/core'
  import javascript from 'highlight.js/lib/languages/javascript'
  import typescript from 'highlight.js/lib/languages/typescript'
  import bash from 'highlight.js/lib/languages/bash'
  import rust from 'highlight.js/lib/languages/rust'
  import json from 'highlight.js/lib/languages/json'
  import yaml from 'highlight.js/lib/languages/yaml'
  import xml from 'highlight.js/lib/languages/xml'
  import css from 'highlight.js/lib/languages/css'
  import markdown from 'highlight.js/lib/languages/markdown'
  import { slugifyPath } from './docsPortal'

  hljs.registerLanguage('javascript', javascript)
  hljs.registerLanguage('js', javascript)
  hljs.registerLanguage('typescript', typescript)
  hljs.registerLanguage('ts', typescript)
  hljs.registerLanguage('bash', bash)
  hljs.registerLanguage('sh', bash)
  hljs.registerLanguage('shell', bash)
  hljs.registerLanguage('rust', rust)
  hljs.registerLanguage('json', json)
  hljs.registerLanguage('yaml', yaml)
  hljs.registerLanguage('yml', yaml)
  hljs.registerLanguage('html', xml)
  hljs.registerLanguage('xml', xml)
  hljs.registerLanguage('css', css)
  hljs.registerLanguage('markdown', markdown)
  hljs.registerLanguage('md', markdown)

  let {
    content = '',
    title = '',
    sourcePath = '',
    onnavigate,
  }: {
    content?: string
    title?: string
    sourcePath?: string
    onnavigate?: (path: string) => void
  } = $props()

  const REPO_BLOB = 'https://github.com/akushniruk/pharos/blob/main'

  function resolveImageSrc(src: string): string {
    if (src.startsWith('http://') || src.startsWith('https://')) return src
    const path = src.replace(/^\.?\//, '')
    if (path.startsWith('docs-supported/')) return `/${path}`
    return `${REPO_BLOB}/${path}?raw=true`
  }

  function resolveLink(href: string): string {
    if (!href || href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:') || href.startsWith('#')) return href
    const clean = href.replace(/^\.\//, '')
    if (clean.startsWith('docs-supported/')) return `/${clean}`

    const sourceDir = sourcePath.includes('/') ? sourcePath.slice(0, sourcePath.lastIndexOf('/')) : ''
    const segments = [...(sourceDir ? sourceDir.split('/') : []), ...clean.split('/')]
    const out: string[] = []
    for (const seg of segments) {
      if (seg === '' || seg === '.') continue
      if (seg === '..') out.pop()
      else out.push(seg)
    }
    const resolved = out.join('/')

    if (resolved.endsWith('.md')) {
      return `#/docs/${slugifyPath(resolved)}`
    }
    return `${REPO_BLOB}/${resolved}`
  }

  let mermaidModule: any = $state(null)

  $effect(() => {
    if (content.includes('```mermaid')) {
      import('mermaid').then((m) => {
        m.default.initialize({ startOnLoad: false, theme: 'dark' })
        mermaidModule = m.default
      })
    }
  })

  const marked = new Marked()

  const renderer = {
    link({ href, text }: { href: string; text: string }) {
      const resolved = resolveLink(href)
      const isExternal = resolved.startsWith('http://') || resolved.startsWith('https://')
      const attrs = isExternal ? ' target="_blank" rel="noopener noreferrer"' : ''
      return `<a href="${resolved}"${attrs}>${text}</a>`
    },
    image({ href, text }: { href: string; text: string }) {
      const src = resolveImageSrc(href)
      return `<img src="${src}" alt="${text || ''}" loading="lazy" decoding="async" class="docs-img" />`
    },
    code({ text, lang }: { text: string; lang?: string }) {
      if (lang === 'mermaid') {
        return `<div class="mermaid-block" data-mermaid="${encodeURIComponent(text)}"></div>`
      }
      if (lang && hljs.getLanguage(lang)) {
        const highlighted = hljs.highlight(text, { language: lang }).value
        return `<pre class="docs-pre"><code class="hljs language-${lang}">${highlighted}</code></pre>`
      }
      const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      return `<pre class="docs-pre"><code>${escaped}</code></pre>`
    },
  }

  marked.use({ renderer })

  let htmlContent = $derived(content ? marked.parse(content) as string : '')

  let readerEl: HTMLElement | undefined = $state()

  $effect(() => {
    if (!mermaidModule || !readerEl) return
    const blocks = readerEl.querySelectorAll('.mermaid-block')
    blocks.forEach(async (block, i) => {
      const src = decodeURIComponent(block.getAttribute('data-mermaid') || '')
      if (!src || block.querySelector('svg')) return
      try {
        const { svg } = await mermaidModule.render(`mermaid-${Date.now()}-${i}`, src)
        block.innerHTML = svg
      } catch {
        block.textContent = src
      }
    })
  })

  function handleLinkClick(e: MouseEvent) {
    const target = (e.target as HTMLElement).closest('a')
    if (!target) return
    const href = target.getAttribute('href')
    if (!href || !href.startsWith('#/docs/')) return
    e.preventDefault()
    const slug = href.replace('#/docs/', '')
    onnavigate?.(slug)
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
<article class="reader" bind:this={readerEl} onclick={handleLinkClick}>
  {#if title}
    <h1 class="reader__title">{title}</h1>
  {/if}
  {#if htmlContent}
    {@html htmlContent}
  {:else}
    <p class="reader__empty">Select a document from the sidebar.</p>
  {/if}
</article>

<style>
  .reader {
    flex: 1;
    min-width: 0;
    max-width: 52rem;
    padding: var(--space-xl) var(--space-2xl);
    overflow-y: auto;
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    line-height: 1.7;
    color: var(--text);
  }

  .reader__title {
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--accent);
    margin: 0 0 var(--space-lg);
    padding-bottom: var(--space-sm);
    border-bottom: 1px solid var(--stroke);
  }

  .reader__empty {
    color: var(--text-secondary);
    font-style: italic;
  }

  .reader :global(h1) {
    font-size: 1.375rem;
    font-weight: 700;
    color: var(--accent);
    margin: var(--space-2xl) 0 var(--space-md);
    letter-spacing: -0.01em;
  }

  .reader :global(h2) {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text);
    margin: var(--space-xl) 0 var(--space-sm);
    padding-bottom: var(--space-xs);
    border-bottom: 1px solid var(--stroke);
  }

  .reader :global(h3) {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text);
    margin: var(--space-lg) 0 var(--space-xs);
  }

  .reader :global(h4),
  .reader :global(h5),
  .reader :global(h6) {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-secondary);
    margin: var(--space-md) 0 var(--space-xs);
  }

  .reader :global(p) {
    margin: 0 0 var(--space-md);
  }

  .reader :global(ul),
  .reader :global(ol) {
    margin: 0 0 var(--space-md);
    padding-left: var(--space-lg);
  }

  .reader :global(li) {
    margin-bottom: var(--space-xs);
  }

  .reader :global(a) {
    color: var(--accent);
    text-decoration: none;
  }

  .reader :global(a:hover) {
    color: var(--accent-hover);
    text-decoration: underline;
  }

  .reader :global(code) {
    font-family: var(--font-mono);
    font-size: 0.8em;
    background: var(--bg2);
    padding: 1px 4px;
    border-radius: 2px;
  }

  .reader :global(.docs-pre) {
    margin: 0 0 var(--space-md);
    padding: var(--space-md);
    background: var(--bg2);
    border: 1px solid var(--stroke);
    border-radius: var(--radius);
    overflow-x: auto;
    font-size: 0.75rem;
    line-height: 1.6;
  }

  .reader :global(.docs-pre code) {
    background: none;
    padding: 0;
    font-size: inherit;
  }

  .reader :global(.docs-img) {
    max-width: 100%;
    height: auto;
    border-radius: var(--radius);
  }

  .reader :global(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 var(--space-md);
    font-size: 0.75rem;
  }

  .reader :global(th) {
    text-align: left;
    font-weight: 600;
    color: var(--text-secondary);
    padding: var(--space-xs) var(--space-sm);
    border-bottom: 1px solid var(--stroke);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: 0.6875rem;
  }

  .reader :global(td) {
    padding: var(--space-xs) var(--space-sm);
    border-bottom: 1px solid color-mix(in srgb, var(--stroke) 50%, transparent);
    vertical-align: top;
  }

  .reader :global(blockquote) {
    margin: 0 0 var(--space-md);
    padding: var(--space-sm) var(--space-md);
    border-left: 2px solid var(--accent);
    color: var(--text-secondary);
    background: var(--accent-dim);
  }

  .reader :global(hr) {
    border: none;
    border-top: 1px solid var(--stroke);
    margin: var(--space-xl) 0;
  }

  .reader :global(.mermaid-block) {
    margin: var(--space-md) 0;
    display: flex;
    justify-content: center;
  }

  .reader :global(.mermaid-block svg) {
    max-width: 100%;
    height: auto;
  }

  .reader :global(.hljs-keyword),
  .reader :global(.hljs-selector-tag) {
    color: #ff7b72;
  }

  .reader :global(.hljs-string),
  .reader :global(.hljs-attr) {
    color: #a5d6ff;
  }

  .reader :global(.hljs-comment) {
    color: #8b949e;
  }

  .reader :global(.hljs-function),
  .reader :global(.hljs-title) {
    color: #d2a8ff;
  }

  .reader :global(.hljs-number),
  .reader :global(.hljs-literal) {
    color: #79c0ff;
  }

  .reader :global(.hljs-built_in) {
    color: #ffa657;
  }

  .reader :global(.hljs-type),
  .reader :global(.hljs-params) {
    color: #7ee787;
  }

  @media (max-width: 768px) {
    .reader {
      padding: var(--space-md);
    }
  }
</style>
