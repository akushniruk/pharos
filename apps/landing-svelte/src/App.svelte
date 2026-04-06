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
</script>

<a class="sr-only" href="#main">Skip to content</a>
<div class="page">
  <Header />
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
</style>
