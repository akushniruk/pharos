<script lang="ts">
  import ScrollReveal from './ScrollReveal.svelte'

  const features = [
    {
      title: 'Multi-Agent Tracking',
      description:
        'Discovers Claude, Cursor, Codex, and Gemini sessions automatically. See every active agent across all your projects at once.',
      tone: 'green' as const,
      delay: 0,
    },
    {
      title: 'Live Event Stream',
      description:
        'Tails JSONL transcripts and broadcasts structured events over WebSocket. Tool calls, file edits, shell commands — as they happen.',
      tone: 'cyan' as const,
      delay: 80,
    },
    {
      title: 'Runs 100% Locally',
      description:
        'No cloud. No telemetry sent anywhere. The daemon reads session files on your machine and serves a dashboard on localhost.',
      tone: 'green' as const,
      delay: 160,
    },
    {
      title: 'Built in Rust',
      description:
        'Lightweight daemon with sub-millisecond overhead. Desktop app powered by Tauri, or run headless as a service on any machine.',
      tone: 'cyan' as const,
      delay: 240,
    },
  ] as const
</script>

{#snippet iconCircuit()}
  <svg class="feature-card__svg" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.75" />
    <path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
    <path d="M8 11h6M11 8v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
  </svg>
{/snippet}

{#snippet iconDatabase()}
  <svg class="feature-card__svg" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4.5 12h15M4.5 12l3-3m-3 3l3 3" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />
    <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.75" />
    <circle cx="17" cy="8" r="1.5" fill="currentColor" />
  </svg>
{/snippet}

{#snippet iconTerminal()}
  <svg class="feature-card__svg" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" />
    <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
{/snippet}

{#snippet iconGear()}
  <svg
    class="feature-card__svg"
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.75" />
    <path
      d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M4.2 19.8l1.8-1.8M18 6l1.8-1.8"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
    />
  </svg>
{/snippet}

<section class="features" aria-labelledby="features-heading">
  <div class="features__container">
    <header class="features__header">
      <p class="features__label font-label">// CAPABILITIES</p>
      <h2 id="features-heading" class="features__heading">
        Everything you need to watch your AI agents work.
      </h2>
    </header>

    <ul class="features__grid" role="list">
      {#each features as feature, i (feature.title)}
        <li class="features__cell">
          <ScrollReveal delay={feature.delay}>
            <article
              class="feature-card"
              class:feature-card--odd={i % 2 === 0}
              class:feature-card--even={i % 2 === 1}
            >
              <div
                class="feature-card__icon-box"
                class:feature-card__icon-box--green={feature.tone === 'green'}
                class:feature-card__icon-box--cyan={feature.tone === 'cyan'}
              >
                {#if i === 0}
                  {@render iconCircuit()}
                {:else if i === 1}
                  {@render iconDatabase()}
                {:else if i === 2}
                  {@render iconTerminal()}
                {:else}
                  {@render iconGear()}
                {/if}
              </div>
              <h3
                class="feature-card__title"
                class:feature-card__title--green={feature.tone === 'green'}
                class:feature-card__title--cyan={feature.tone === 'cyan'}
              >
                {feature.title}
              </h3>
              <p class="feature-card__description">{feature.description}</p>
            </article>
          </ScrollReveal>
        </li>
      {/each}
    </ul>
  </div>
</section>

<style>
  .features {
    --bg0: #000000;
    --bg1: #0d1117;
    --bg2: #1a2426;
    --accent: #00ff41;
    --accent-hover: #00f3ff;
    --text: #e6edf3;
    --text-secondary: #8b949e;
    --stroke: #30363d;

    --terminal-bg: #0a0c0e;
    --terminal-green: #00ff41;
    --terminal-cyan: #00f3ff;
    --terminal-dim: #1a2426;
    --surface: #0d1117;
    --on-surface: #e6edf3;
    --on-surface-variant: #8b949e;
    --outline: #30363d;

    background: var(--bg0);
    border-top: 1px solid var(--terminal-dim);
    border-bottom: 1px solid var(--terminal-dim);
    padding-block: 8rem;
    font-family: 'Fira Code', 'Fira Mono', ui-monospace, monospace;
    box-sizing: border-box;
  }

  .features *,
  .features *::before,
  .features *::after {
    box-sizing: border-box;
  }

  .features__container {
    max-width: 1280px;
    margin-inline: auto;
    padding-inline: 2rem;
  }

  .features__header {
    margin-bottom: 5rem;
  }

  .font-label {
    font-size: 0.75rem;
    line-height: 1.25;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }

  .features__label {
    margin: 0 0 0.75rem;
    color: var(--terminal-green);
    text-shadow: 0 0 12px color-mix(in srgb, var(--terminal-green) 45%, transparent);
  }

  .features__heading {
    margin: 0;
    max-width: 48rem;
    font-size: clamp(1.875rem, 2.5vw + 1rem, 3rem);
    font-weight: 700;
    line-height: 1.15;
    color: var(--on-surface);
    letter-spacing: -0.02em;
  }

  .features__grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  @media (min-width: 768px) {
    .features__grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (min-width: 1024px) {
    .features__grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  .features__cell {
    margin: 0;
    padding: 0;
    min-width: 0;
    display: flex;
  }

  .features__cell :global(> *) {
    flex: 1;
    display: flex;
  }

  .features__cell :global(> * > *) {
    flex: 1;
  }

  .feature-card {
    height: 100%;
    background: var(--terminal-bg);
    border: 1px solid var(--outline);
    border-radius: 0;
    padding: 2rem;
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  .feature-card--odd:hover {
    border-color: var(--terminal-green);
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--terminal-green) 35%, transparent),
      0 0 24px color-mix(in srgb, var(--terminal-green) 22%, transparent);
  }

  .feature-card--even:hover {
    border-color: var(--terminal-cyan);
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--terminal-cyan) 35%, transparent),
      0 0 24px color-mix(in srgb, var(--terminal-cyan) 22%, transparent);
  }

  .feature-card__icon-box {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 3rem;
    height: 3rem;
    margin-bottom: 1.25rem;
    border: 1px solid var(--outline);
    border-radius: 0;
    background: transparent;
    transition:
      background-color 0.2s ease,
      border-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  .feature-card__icon-box--green {
    color: var(--terminal-green);
    box-shadow: 0 0 10px color-mix(in srgb, var(--terminal-green) 18%, transparent);
  }

  .feature-card__icon-box--cyan {
    color: var(--terminal-cyan);
    box-shadow: 0 0 10px color-mix(in srgb, var(--terminal-cyan) 18%, transparent);
  }

  .feature-card--odd:hover .feature-card__icon-box--green {
    background: var(--terminal-green);
    border-color: var(--terminal-green);
    color: #000000;
    box-shadow: 0 0 16px color-mix(in srgb, var(--terminal-green) 40%, transparent);
  }

  .feature-card--even:hover .feature-card__icon-box--cyan {
    background: var(--terminal-cyan);
    border-color: var(--terminal-cyan);
    color: #000000;
    box-shadow: 0 0 16px color-mix(in srgb, var(--terminal-cyan) 40%, transparent);
  }

  .feature-card__svg {
    display: block;
  }

  .feature-card__title {
    margin: 0 0 0.75rem;
    font-size: 1.25rem;
    font-weight: 700;
    line-height: 1.3;
  }

  .feature-card__title--green {
    color: var(--terminal-green);
  }

  .feature-card__title--cyan {
    color: var(--terminal-cyan);
  }

  .feature-card__description {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.625;
    color: var(--on-surface-variant);
  }

  @media (prefers-reduced-motion: reduce) {
    .feature-card {
      transition: none;
    }

    .feature-card__icon-box {
      transition: none;
    }
  }
</style>
