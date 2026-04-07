<script lang="ts">
  import DocsSidebar from './DocsSidebar.svelte'
  import DocsReader from './DocsReader.svelte'
  import { docContentForPath } from './docsContent'
  import { slugifyPath, docsEntryBySlug, docsEntryByPath, DEFAULT_DOC_PATH } from './docsPortal'

  let {
    slug = '',
  }: {
    slug?: string
  } = $props()

  let currentPath = $derived.by(() => {
    if (!slug) return DEFAULT_DOC_PATH
    const entry = docsEntryBySlug(slug)
    return entry?.path ?? DEFAULT_DOC_PATH
  })

  let currentEntry = $derived(docsEntryByPath(currentPath))
  let content = $derived(docContentForPath(currentPath) ?? '')

  function navigateToPath(path: string) {
    const s = slugifyPath(path)
    window.location.hash = `/docs/${s}`
  }

  function navigateToSlug(s: string) {
    window.location.hash = `/docs/${s}`
  }
</script>

<div class="docs-outer">
  <div class="docs-shell">
    <DocsSidebar currentPath={currentPath} onselect={navigateToPath} />
    <DocsReader
      content={content}
      title={currentEntry?.title ?? ''}
      sourcePath={currentPath}
      onnavigate={navigateToSlug}
    />
  </div>
</div>

<style>
  .docs-outer {
    width: 100%;
    max-width: var(--max);
    margin: 0 auto;
    padding: 0 var(--space-lg);
    box-sizing: border-box;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .docs-shell {
    display: flex;
    flex: 1;
    min-height: 0;
    height: calc(100vh - 3rem);
    overflow: hidden;
    border: 1px solid var(--stroke);
    border-radius: var(--radius-lg);
    background: color-mix(in srgb, var(--bg1) 92%, transparent);
  }

  @media (max-width: 768px) {
    .docs-shell {
      flex-direction: column;
      height: auto;
      min-height: calc(100vh - 3rem);
      border-left: none;
      border-right: none;
      border-radius: 0;
    }

    .docs-outer {
      padding: 0 var(--space-sm);
    }
  }
</style>
