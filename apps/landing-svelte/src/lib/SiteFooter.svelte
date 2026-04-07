<script lang="ts">
  const repoUrl = 'https://github.com/akushniruk/pharos'
  const docsUrl = `${repoUrl}#readme`
  const privacyUrl = `${repoUrl}/security`
</script>

<footer class="foot">
  <div class="foot__inner">
    <div class="foot__brand">
      <div class="foot__logo">
        <img src="/pharos-mark.svg" alt="" class="foot__logo-img" width="24" height="24" />
        <span class="foot__title">PHAROS</span>
      </div>
      <p class="foot__legal">Open-source AI agent observability.</p>
    </div>

    <nav class="foot__nav" aria-label="Footer">
      <a class="foot__link" href="#/docs">
        DOCUMENTATION
      </a>
      <a class="foot__link" href={privacyUrl} target="_blank" rel="noopener noreferrer">
        PRIVACY_POLICY
      </a>
    </nav>

  </div>
</footer>

<style>
  .foot {
    --bg0: #0a0c0e;
    --accent: #00ff41;
    --accent-hover: #00f3ff;
    --text-secondary: #8b949e;
    --stroke: #30363d;

    width: 100%;
    border-top: 1px solid #1a2426;
    background: var(--bg0);
    font-family: 'Fira Code', ui-monospace, monospace;
  }

  .foot__inner {
    max-width: 80rem;
    margin-inline: auto;
    padding: 3rem 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    text-align: center;
  }

  @media (min-width: 768px) {
    .foot__inner {
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      text-align: left;
    }
  }

  .foot__brand {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .foot__logo {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .foot__logo-img {
    width: 24px;
    height: 24px;
  }

  .foot__title {
    margin: 0;
    font-size: 1.25rem;
    line-height: 1.75rem;
    font-weight: 700;
    color: var(--accent);
  }

  .foot__legal {
    margin: 0;
    font-size: 0.75rem;
    line-height: 1.5;
    color: var(--text-secondary);
    max-width: 20rem;
  }

  .foot__nav {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 1rem 1.5rem;
  }

  .foot__link {
    font-size: 0.875rem;
    line-height: 1.25rem;
    color: var(--text-secondary);
    text-decoration: none;
    transition: color 0.15s ease;
  }

  .foot__link:hover {
    color: var(--accent);
  }

</style>
