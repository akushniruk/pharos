<script lang="ts">
  import ScrollReveal from './ScrollReveal.svelte'

  const items = [
    {
      title: 'Not a cloud SaaS',
      description:
        'Runs entirely on your machine. No external telemetry, no remote APIs, no data leaves your network.',
    },
    {
      title: 'Not an AI coding tool',
      description:
        "Pharos observes and reports. It doesn't write code, suggest changes, or interfere with agent behavior.",
    },
    {
      title: 'Not vendor-locked',
      description:
        'Works with Claude Code, Cursor, Codex, Gemini, and any agent Pharos can detect. Switch tools freely.',
    },
    {
      title: 'Not a log viewer',
      description:
        'Structures chaotic output into typed events with semantic meaning. Search, filter, and correlate — not just scroll.',
    },
  ] as const

  const delays = [0, 80, 160, 240] as const
</script>

<section class="not-this" aria-labelledby="not-this-heading">
  <div class="not-this__inner">
    <header class="not-this__header">
      <p class="not-this__eyebrow">// SCOPE_DEFINITION</p>
      <h2 id="not-this-heading" class="not-this__title">What Pharos is NOT.</h2>
    </header>

    <div class="not-this__grid">
      {#each items as item, i (item.title)}
        <ScrollReveal delay={delays[i]} class="not-this__reveal">
          <article class="not-this__card">
            <h3 class="not-this__card-title">{item.title}</h3>
            <p class="not-this__card-desc">{item.description}</p>
          </article>
        </ScrollReveal>
      {/each}
    </div>
  </div>
</section>

<style>
  .not-this {
    --bg0: #0a0c0e;
    --bg1: #0d1117;
    --bg2: #1a2426;
    --accent: #00ff41;
    --accent-hover: #00f3ff;
    --text: #e6edf3;
    --text-secondary: #8b949e;
    --stroke: #30363d;

    background: var(--bg0);
    padding-block: 6rem;
    font-family: 'Fira Code', monospace;
  }

  .not-this__inner {
    box-sizing: border-box;
    max-width: 80rem;
    margin-inline: auto;
    padding-inline: 2rem;
  }

  .not-this__header {
    margin-bottom: 2.5rem;
  }

  .not-this__eyebrow {
    margin: 0 0 0.5rem;
    font-size: 0.75rem;
    line-height: 1rem;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent);
  }

  .not-this__title {
    margin: 0;
    font-size: 1.875rem;
    line-height: 2.25rem;
    font-weight: 700;
    color: var(--text);
  }

  .not-this__grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  @media (min-width: 768px) {
    .not-this__grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  .not-this :global(.not-this__reveal) {
    min-width: 0;
    height: 100%;
  }

  .not-this :global(.not-this__reveal) > :global(*) {
    height: 100%;
  }

  .not-this__card {
    box-sizing: border-box;
    height: 100%;
    margin: 0;
    padding: 2rem 2.5rem;
    background: var(--bg1);
    border-left: 2px solid var(--accent);
    transition: border-left-color 0.2s ease;
  }

  .not-this__card:hover {
    border-left-color: var(--accent-hover);
  }

  .not-this__card-title {
    margin: 0 0 0.75rem;
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--text);
  }

  .not-this__card-desc {
    margin: 0;
    font-size: 0.9375rem;
    line-height: 1.65;
    color: var(--text-secondary);
  }
</style>
