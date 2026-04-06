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
    backdrop-filter: blur(10px);
    background: rgba(11, 15, 20, 0.72);
    border-bottom: 1px solid var(--stroke);
  }

  .top__inner {
    max-width: var(--max);
    margin: 0 auto;
    padding: 0.85rem 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .top__wordmark {
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  .top__nav {
    display: flex;
    gap: 1.25rem;
    font-size: 0.9rem;
    font-weight: 500;
  }

  .top__nav a {
    text-decoration: none;
    color: var(--muted);
  }

  .top__nav a:hover {
    color: var(--accent);
  }

  main {
    flex: 1;
  }
</style>
