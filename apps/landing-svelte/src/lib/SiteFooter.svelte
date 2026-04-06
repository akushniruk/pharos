<script lang="ts">
  const repoUrl = 'https://github.com/akushniruk/pharos'
</script>

<footer class="foot">
  <div class="foot__inner">
    <p>
      Pharos — <span class="mono">daemon + dashboard</span> for AI agent sessions. Copy aligns to
      <a href={`${repoUrl}/blob/main/docs/gtm/launch-narrative-v1.md`}>launch narrative v1</a> and README hero
      outcome <strong>A</strong> (      <a href={`${repoUrl}/blob/main/docs/gtm/readme-hero-variants-pha36.md`}>PHA-36 variants</a>).
    </p>
    <p class="fine">
      This page is a static marketing shell; canonical product story remains the GitHub README, Releases, and
      in-repo docs.
    </p>
  </div>
</footer>

<style>
  .foot {
    padding: 2.5rem 1.5rem 3rem;
    border-top: 1px solid var(--stroke);
    background: var(--bg0);
  }

  .foot__inner {
    max-width: var(--max);
    margin: 0 auto;
  }

  p {
    margin: 0 0 0.75rem;
    color: var(--muted);
    font-size: 0.9rem;
  }

  .fine {
    margin: 0;
    font-size: 0.8rem;
    opacity: 0.85;
  }

  .mono {
    font-family: var(--font-mono);
    font-size: 0.85em;
    color: var(--text);
  }
</style>
