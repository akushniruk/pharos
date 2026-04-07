<script lang="ts">
  import { DOCS_PORTAL_SECTIONS, slugifyPath, type DocsPortalEntry } from './docsPortal'

  let {
    currentPath = '',
    onselect,
  }: {
    currentPath?: string
    onselect?: (path: string) => void
  } = $props()

  function handleClick(entry: DocsPortalEntry, e: MouseEvent) {
    e.preventDefault()
    onselect?.(entry.path)
  }
</script>

<nav class="sidebar" aria-label="Documentation">
  {#each DOCS_PORTAL_SECTIONS as section}
    <div class="section">
      <h3 class="section__title">{section.title}</h3>
      {#if section.subtitle}
        <p class="section__subtitle">{section.subtitle}</p>
      {/if}
      <ul class="section__list">
        {#each section.entries as entry}
          <li>
            <a
              class="entry"
              class:entry--active={currentPath === entry.path}
              href="#/docs/{slugifyPath(entry.path)}"
              onclick={(e: MouseEvent) => handleClick(entry, e)}
            >
              <span class="entry__title">{entry.title}</span>
            </a>
          </li>
        {/each}
      </ul>
    </div>
  {/each}
</nav>

<style>
  .sidebar {
    width: 260px;
    flex-shrink: 0;
    overflow-y: auto;
    padding: var(--space-lg) var(--space-md);
    border-right: 1px solid var(--stroke);
    font-family: var(--font-mono);
  }

  .section {
    margin-bottom: var(--space-lg);
  }

  .section__title {
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-secondary);
    margin: 0 0 2px;
  }

  .section__subtitle {
    font-size: 0.625rem;
    color: var(--text-secondary);
    opacity: 0.6;
    margin: 0 0 var(--space-xs);
  }

  .section__list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .entry {
    display: block;
    padding: 3px 0;
    font-size: 0.75rem;
    color: var(--text-secondary);
    text-decoration: none;
    transition: color 0.12s ease;
    line-height: 1.4;
  }

  .entry:hover {
    color: var(--accent-hover);
  }

  .entry--active {
    color: var(--accent);
  }

  .entry__title {
    display: block;
  }

  @media (max-width: 768px) {
    .sidebar {
      width: 100%;
      border-right: none;
      border-bottom: 1px solid var(--stroke);
      padding: var(--space-md);
      max-height: 50vh;
    }
  }
</style>
