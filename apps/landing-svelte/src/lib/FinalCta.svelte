<script lang="ts">
  import ScrollReveal from './ScrollReveal.svelte'

  const commands = [
    'git clone https://github.com/akushniruk/pharos.git && cd pharos',
    'make up',
    'open http://localhost:5173',
  ] as const

  const releasesUrl = 'https://github.com/akushniruk/pharos/releases'
  const repoUrl = 'https://github.com/akushniruk/pharos'
</script>

<section class="final" aria-labelledby="final-heading">
  <ScrollReveal>
    <div class="final__container">
      <h2 id="final-heading" class="final__heading">GET_STARTED</h2>
      <p class="final__sub">
        Download the desktop app or build from source. Running in under a minute.
      </p>

      <div class="final__terminal" role="region" aria-label="Quickstart commands">
        {#each commands as cmd (cmd)}
          <div class="final__line">
            <span class="final__prompt" aria-hidden="true">$</span>
            <code class="final__cmd">{cmd}</code>
          </div>
        {/each}
      </div>

      <div class="final__actions">
        <a
          class="final__btn final__btn--primary"
          href={releasesUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg class="final__icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          DOWNLOAD_APP
        </a>
        <a
          class="final__btn final__btn--ghost"
          href={repoUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg class="final__icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
          </svg>
          VIEW_SOURCE
        </a>
      </div>
    </div>
  </ScrollReveal>
</section>

<style>
  .final {
    --bg0: #0a0c0e;
    --bg1: #0d1117;
    --bg2: #1a2426;
    --accent: #00ff41;
    --accent-hover: #00f3ff;
    --text: #e6edf3;
    --text-secondary: #8b949e;
    --stroke: #30363d;

    padding-block: 8rem;
    background: #000;
    border-top: 1px solid #1a2426;
    font-family: 'Fira Code', ui-monospace, monospace;
  }

  .final__container {
    max-width: 48rem;
    margin-inline: auto;
    padding-inline: 1.5rem;
    text-align: center;
  }

  .final__heading {
    margin: 0 0 1rem;
    font-size: 2.25rem;
    line-height: 2.5rem;
    font-weight: 700;
    color: var(--accent);
    text-shadow:
      0 0 12px rgba(0, 255, 65, 0.45),
      0 0 28px rgba(0, 255, 65, 0.25),
      0 0 48px rgba(0, 255, 65, 0.12);
  }

  @media (min-width: 640px) {
    .final__heading {
      font-size: 2.5rem;
      line-height: 1.1;
    }
  }

  .final__sub {
    margin: 0 0 2rem;
    font-size: 1.125rem;
    line-height: 1.75rem;
    color: var(--text-secondary);
  }

  .final__terminal {
    margin-inline: auto;
    margin-bottom: 2rem;
    max-width: 36rem;
    text-align: left;
    padding: 1.5rem;
    background: var(--bg0);
    border: 1px solid var(--stroke);
    font-family: 'Fira Code', ui-monospace, monospace;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .final__line {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    margin: 0;
  }

  .final__prompt {
    flex-shrink: 0;
    color: var(--accent);
    font-weight: 600;
    user-select: none;
  }

  .final__cmd {
    font-size: 0.875rem;
    line-height: 1.5;
    color: var(--text);
    font-family: inherit;
    word-break: break-all;
  }

  .final__actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
  }

  @media (min-width: 480px) {
    .final__actions {
      flex-direction: row;
      gap: 1rem;
    }
  }

  .final__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.65rem 1.35rem;
    font-size: 0.8125rem;
    font-weight: 700;
    font-family: inherit;
    text-decoration: none;
    border-radius: 2px;
    transition:
      background-color 0.15s ease,
      color 0.15s ease,
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  .final__icon {
    width: 1rem;
    height: 1rem;
  }

  .final__btn--primary {
    background: var(--accent);
    color: #000;
    border: 1px solid var(--accent);
  }

  .final__btn--primary:hover {
    background: var(--accent-hover);
    border-color: var(--accent-hover);
    color: #000;
    box-shadow: 0 0 20px rgba(0, 243, 255, 0.35);
  }

  .final__btn--ghost {
    background: transparent;
    color: var(--accent);
    border: 1px solid var(--accent);
  }

  .final__btn--ghost:hover {
    background: rgba(0, 255, 65, 0.1);
  }
</style>
