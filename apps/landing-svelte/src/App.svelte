<script lang="ts">
  import Header from './lib/Header.svelte'
  import Hero from './lib/Hero.svelte'
  import ProblemStrip from './lib/ProblemStrip.svelte'
  import HowItWorks from './lib/HowItWorks.svelte'
  import Features from './lib/Features.svelte'
  import ProductViz from './lib/ProductViz.svelte'
  import NotThis from './lib/NotThis.svelte'
  import FinalCta from './lib/FinalCta.svelte'
  import SiteFooter from './lib/SiteFooter.svelte'
  import DocsPage from './lib/docs/DocsPage.svelte'

  let hash = $state(window.location.hash)

  function onHashChange() {
    hash = window.location.hash
  }

  $effect(() => {
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  })

  let isDocsRoute = $derived(hash.startsWith('#/docs'))
  let docsSlug = $derived(
    isDocsRoute ? hash.replace(/^#\/docs\/?/, '') : ''
  )
</script>

<a class="sr-only" href="#main">Skip to content</a>
<div class="page">
  <Header isDocsRoute={isDocsRoute} />
  {#if isDocsRoute}
    <main id="main" class="main--docs">
      <DocsPage slug={docsSlug} />
    </main>
  {:else}
    <main id="main">
      <Hero />
      <Features />
      <ProblemStrip />
      <ProductViz />
      <HowItWorks />
      <NotThis />
      <FinalCta />
    </main>
    <SiteFooter />
  {/if}
</div>

<style>
  .page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  main {
    flex: 1;
  }

  .main--docs {
    margin-top: 3rem;
    display: flex;
    flex-direction: column;
    min-height: 0;
    flex: 1;
  }
</style>
