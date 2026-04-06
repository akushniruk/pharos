<script lang="ts">
  import ScrollReveal from './ScrollReveal.svelte'

  const steps = [
    { label: '1. clone', command: 'git clone github.com/akushniruk/pharos && cd pharos' },
    { label: '2. start', command: 'make up' },
    { label: '3. open', command: 'open http://localhost:5173' },
  ] as const
</script>

<ScrollReveal>
  <section class="deploy" aria-labelledby="deploy-heading">
    <div class="deploy__container">
      <div class="deploy__grid">
        <div class="deploy__col deploy__col--copy">
          <h2 id="deploy-heading" class="deploy__title">GET_STARTED</h2>
          <p class="deploy__desc">
            Download the desktop app from GitHub Releases, or build the daemon from source and run it headless on any machine.
          </p>
          <ul class="deploy__steps">
            {#each steps as step (step.label)}
              <li class="deploy__steps-item">
                <button type="button" class="deploy__step">
                  <span class="deploy__step-label">{step.label}</span>
                  <code class="deploy__step-cmd">{step.command}</code>
                </button>
              </li>
            {/each}
          </ul>
        </div>

        <div class="deploy__col deploy__col--viz">
          <div class="deploy__viz-shell">
            <span class="deploy__stream-id" aria-hidden="true">pharos-daemon · localhost:4000</span>
            <div class="deploy__viz-frame">
              <div class="deploy__viz-mock" aria-hidden="true">
                <div class="deploy__line deploy__line--prompt">
                  <span class="deploy__prompt">$</span>
                  <span class="deploy__line-body deploy__w-90"></span>
                </div>
                <div class="deploy__line deploy__line--ok deploy__w-70"></div>
                <div class="deploy__line deploy__line--dim deploy__w-55"></div>
                <div class="deploy__line deploy__line--cyan deploy__w-82"></div>
                <div class="deploy__line deploy__line--green deploy__w-40"></div>
                <div class="deploy__line deploy__line--dim deploy__w-95"></div>
                <div class="deploy__line deploy__line--muted deploy__w-30"></div>
                <div class="deploy__line deploy__line--green deploy__w-65"></div>
                <div class="deploy__line deploy__line--cyan deploy__w-48"></div>
                <div class="deploy__line deploy__line--dim deploy__w-88"></div>
                <div class="deploy__line deploy__line--ok deploy__w-52"></div>
                <div class="deploy__line deploy__line--prompt">
                  <span class="deploy__prompt">$</span>
                  <span class="deploy__line-body deploy__w-25 deploy__cursor"></span>
                </div>
              </div>
              <div class="deploy__viz-overlay" aria-hidden="true"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</ScrollReveal>

<style>
  .deploy {
    font-family: 'Fira Code', var(--font-mono, monospace);
    background: #000;
    border-top: 1px solid var(--bg2);
    padding-block: 8rem;
    color: var(--text);
  }

  .deploy__container {
    max-width: 1280px;
    margin-inline: auto;
    padding-inline: 2rem;
  }

  .deploy__grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 4rem;
    align-items: center;
  }

  @media (min-width: 1024px) {
    .deploy__grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  .deploy__title {
    margin: 0 0 1rem;
    font-size: 2.25rem;
    line-height: 1.15;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--accent);
  }

  .deploy__desc {
    margin: 0 0 1.5rem;
    max-width: 36rem;
    font-size: 1.125rem;
    line-height: 1.6;
    color: var(--text-secondary);
  }

  .deploy__steps {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .deploy__steps-item {
    margin: 0;
    padding: 0;
  }

  .deploy__step {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    width: 100%;
    margin: 0;
    padding: 1rem;
    text-align: left;
    font: inherit;
    color: inherit;
    cursor: pointer;
    background: var(--bg0);
    border: 1px solid var(--stroke);
    border-radius: 2px;
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  .deploy__step:hover,
  .deploy__step:focus-visible {
    border-color: var(--accent);
    outline: none;
    box-shadow: 0 0 0 1px rgba(0, 255, 65, 0.15);
  }

  .deploy__step-label {
    flex-shrink: 0;
    font-size: 0.875rem;
    color: var(--accent-hover);
    white-space: nowrap;
  }

  .deploy__step-cmd {
    font-family: inherit;
    font-size: 0.75rem;
    color: var(--accent);
    white-space: nowrap;
    overflow-x: auto;
    max-width: 100%;
    text-align: right;
  }

  .deploy__viz-shell {
    position: relative;
    border-radius: 4px;
  }

  .deploy__stream-id {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.65rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-secondary);
    opacity: 0.85;
  }

  .deploy__viz-frame {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    border-radius: 4px;
    border: 1px solid rgba(0, 255, 65, 0.35);
    background: var(--bg1);
    box-shadow: 0 0 0 1px rgba(0, 243, 255, 0.06);
  }

  .deploy__viz-mock {
    padding: 1.25rem 1rem;
    min-height: 280px;
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    filter: grayscale(1);
    opacity: 0.92;
  }

  .deploy__viz-overlay {
    position: absolute;
    inset: 0;
    border-radius: 4px;
    pointer-events: none;
    background: rgba(0, 255, 65, 0.05);
    border: 1px solid rgba(0, 255, 65, 0.2);
    box-sizing: border-box;
    z-index: 1;
  }

  .deploy__line {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 0.5rem;
    border-radius: 1px;
  }

  .deploy__line-body,
  .deploy__line:not(.deploy__line--prompt) {
    min-height: 0.45rem;
  }

  .deploy__line--prompt {
    gap: 0.5rem;
    min-height: auto;
  }

  .deploy__prompt {
    flex-shrink: 0;
    color: var(--accent);
    font-size: 0.75rem;
    font-weight: 600;
    opacity: 0.9;
  }

  .deploy__line-body {
    display: inline-block;
    height: 0.5rem;
    border-radius: 1px;
    background: linear-gradient(90deg, var(--accent), var(--accent-hover));
    opacity: 0.85;
  }

  .deploy__line--ok {
    background: linear-gradient(90deg, rgba(0, 255, 65, 0.45), rgba(0, 243, 255, 0.25));
  }

  .deploy__line--cyan {
    background: linear-gradient(90deg, rgba(0, 243, 255, 0.5), rgba(0, 243, 255, 0.15));
  }

  .deploy__line--green {
    background: linear-gradient(90deg, rgba(0, 255, 65, 0.55), rgba(0, 255, 65, 0.12));
  }

  .deploy__line--dim {
    background: rgba(26, 36, 38, 0.9);
  }

  .deploy__line--muted {
    background: rgba(139, 148, 158, 0.25);
  }

  .deploy__w-25 {
    width: 25%;
  }
  .deploy__w-30 {
    width: 30%;
  }
  .deploy__w-40 {
    width: 40%;
  }
  .deploy__w-48 {
    width: 48%;
  }
  .deploy__w-52 {
    width: 52%;
  }
  .deploy__w-55 {
    width: 55%;
  }
  .deploy__w-65 {
    width: 65%;
  }
  .deploy__w-70 {
    width: 70%;
  }
  .deploy__w-82 {
    width: 82%;
  }
  .deploy__w-88 {
    width: 88%;
  }
  .deploy__w-90 {
    width: 90%;
  }
  .deploy__w-95 {
    width: 95%;
  }

  .deploy__cursor {
    animation: deploy-blink 1.1s step-end infinite;
  }

  @keyframes deploy-blink {
    50% {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .deploy__step {
      transition: none;
    }

    .deploy__cursor {
      animation: none;
      opacity: 1;
    }
  }
</style>
