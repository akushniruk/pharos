<script lang="ts">
  const repoUrl = 'https://github.com/akushniruk/pharos'
</script>

<footer class="foot">
  <div class="foot__inner">
    <p>
      Pharos pairs a <span class="mono">Rust daemon</span> with a dashboard so coding-agent sessions are
      readable where they actually run. Positioning and proof points track
      <a href={`${repoUrl}/blob/main/docs/gtm/launch-narrative-v1.md`}>launch narrative v1</a>; deeper detail
      lives in the <a href={`${repoUrl}#readme`}>README</a> and
      <a href={`${repoUrl}/releases`}>Releases</a>.
    </p>
    <p class="fine">
      Static landing only—the README and repo docs stay the source of truth.
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
