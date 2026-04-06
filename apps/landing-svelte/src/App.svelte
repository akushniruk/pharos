<script lang="ts">
  import Hero from './lib/Hero.svelte'
  import ProblemStrip from './lib/ProblemStrip.svelte'
  import ProofPoints from './lib/ProofPoints.svelte'
  import SiteFooter from './lib/SiteFooter.svelte'
</script>

<a class="sr-only" href="#main">Skip to content</a>
<div class="page">
  <header class="top">
    <div class="top__inner">
      <span class="top__wordmark">Pharos</span>
      <nav class="top__nav" aria-label="Primary">
        <a href="https://github.com/akushniruk/pharos">GitHub</a>
        <a href="https://github.com/akushniruk/pharos/releases">Releases</a>
      </nav>
    </div>
  </header>
  <main id="main">
    <Hero />
    <ProblemStrip />
    <ProofPoints />
  </main>
  <SiteFooter />
</div>

<style>
  .page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .top {
    position: sticky;
    top: 0;
    z-index: 10;
    backdrop-filter: blur(14px) saturate(1.2);
    -webkit-backdrop-filter: blur(14px) saturate(1.2);
    background: color-mix(in srgb, var(--bg0) 78%, transparent);
    border-bottom: 1px solid var(--stroke);
  }

  .top__inner {
    max-width: var(--max);
    margin: 0 auto;
    padding: var(--space-md) var(--space-lg);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
  }

  .top__wordmark {
    font-weight: 700;
    font-size: 1.05rem;
    letter-spacing: -0.03em;
    color: var(--text);
  }

  .top__nav {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    font-size: 0.875rem;
    font-weight: 600;
  }

  .top__nav a {
    padding: var(--space-sm) var(--space-md);
    border-radius: 999px;
    text-decoration: none;
    color: var(--muted);
    transition:
      background 0.15s ease,
      color 0.15s ease;
  }

  .top__nav a:hover {
    background: var(--surface);
    color: var(--accent);
  }

  main {
    flex: 1;
  }
</style>
