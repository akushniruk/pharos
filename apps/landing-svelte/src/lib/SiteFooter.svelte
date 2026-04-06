<script lang="ts">
  const repoUrl = 'https://github.com/akushniruk/pharos'
</script>

<footer class="foot">
  <div class="foot__inner">
    <div class="foot__main">
      <p class="foot__lead">
        Pharos pairs a <span class="mono">Rust daemon</span> with a dashboard so coding-agent sessions are
        readable where they actually run. Positioning and proof points track
        <a href={`${repoUrl}/blob/main/docs/gtm/launch-narrative-v1.md`}>launch narrative v1</a>; deeper
        detail lives in the <a href={`${repoUrl}#readme`}>README</a> and
        <a href={`${repoUrl}/releases`}>Releases</a>.
      </p>
      <p class="fine">
        Static landing only — the README and repo docs stay the source of truth.
      </p>
    </div>
  </div>
</footer>

<style>
  .foot {
    padding: var(--space-2xl) var(--space-lg) var(--space-3xl);
    border-top: 1px solid var(--stroke-strong);
    background: var(--bg0);
  }

  .foot__inner {
    max-width: var(--max);
    margin: 0 auto;
  }

  .foot__main {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    max-width: 42rem;
  }

  .foot__lead {
    margin: 0;
    color: var(--text-secondary);
    font-size: 0.9375rem;
    line-height: 1.62;
  }

  .fine {
    margin: 0;
    font-size: 0.8125rem;
    line-height: 1.55;
    color: var(--muted);
  }

  .mono {
    font-family: var(--font-mono);
    font-size: 0.9em;
    font-weight: 500;
    color: var(--text);
  }
</style>
