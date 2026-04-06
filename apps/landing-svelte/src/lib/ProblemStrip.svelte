<script lang="ts">
  import ScrollReveal from './ScrollReveal.svelte'
</script>

<section class="why-pharos" aria-labelledby="why-pharos-heading">
  <div class="why-pharos__inner">
    <div class="why-pharos__grid">
      <div class="why-pharos__left">
        <h2 id="why-pharos-heading" class="why-pharos__title">WHY_PHAROS?</h2>
        <p class="why-pharos__lead">
          AI coding agents run in the background making changes you can't see. Pharos gives you a single dashboard to watch all of them — without sending data anywhere.
        </p>
        <ul class="why-pharos__bullets">
          <li class="why-pharos__bullet">
            <svg
              class="why-pharos__icon"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M12 3 4 6v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V6l-8-3Z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linejoin="round"
              />
              <path
                d="m9 12 2 2 4-4"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span class="why-pharos__bullet-text">Nothing-Leaves-Your-Machine</span>
          </li>
          <li class="why-pharos__bullet">
            <svg
              class="why-pharos__icon"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <circle cx="7.5" cy="15.5" r="3.5" stroke="currentColor" stroke-width="2" />
              <circle cx="16.5" cy="8.5" r="3.5" stroke="currentColor" stroke-width="2" />
              <path
                d="m10.5 13.5 5-5"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
            <span class="why-pharos__bullet-text">Works-With-Any-Agent</span>
          </li>
          <li class="why-pharos__bullet">
            <svg
              class="why-pharos__icon"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="m16 18 6-6-6-6M8 6 2 12l6 6"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span class="why-pharos__bullet-text">Always-Running-Background</span>
          </li>
        </ul>
      </div>

      <div class="why-pharos__right">
        <div class="why-pharos__rail" aria-hidden="true"></div>

        <ScrollReveal delay={0}>
          <article class="why-pharos__trace-item">
            <span class="why-pharos__trace-dot" aria-hidden="true"></span>
            <div class="why-pharos__trace-body">
              <h3 class="why-pharos__trace-title">You can't watch what you can't see</h3>
              <p class="why-pharos__trace-desc">
                Agents edit files, run shell commands, and call APIs — but their session transcripts are buried in JSONL files across your filesystem. Pharos finds and tails them automatically.
              </p>
            </div>
          </article>
        </ScrollReveal>

        <ScrollReveal delay={150}>
          <article class="why-pharos__trace-item">
            <span class="why-pharos__trace-dot" aria-hidden="true"></span>
            <div class="why-pharos__trace-body">
              <h3 class="why-pharos__trace-title">One dashboard for all agents</h3>
              <p class="why-pharos__trace-desc">
                Claude Code, Cursor, Codex, Gemini — each has its own format. Pharos normalizes everything into typed events so you see a unified timeline across all of them.
              </p>
            </div>
          </article>
        </ScrollReveal>

        <ScrollReveal delay={300}>
          <article class="why-pharos__trace-item">
            <span class="why-pharos__trace-dot" aria-hidden="true"></span>
            <div class="why-pharos__trace-body">
              <h3 class="why-pharos__trace-title">Your code stays yours</h3>
              <p class="why-pharos__trace-desc">
                No cloud accounts, no API keys, no data leaving your network. The daemon serves on localhost and the dashboard runs in your browser. That's it.
              </p>
            </div>
          </article>
        </ScrollReveal>
      </div>
    </div>
  </div>
</section>

<style>
  .why-pharos {
    padding-block: 8rem;
    background: var(--bg0);
    font-family: var(--font-mono);
  }

  .why-pharos__inner {
    max-width: var(--max);
    margin-inline: auto;
    padding-inline: var(--space-lg);
  }

  .why-pharos__grid {
    display: grid;
    gap: 6rem;
    align-items: start;
  }

  @media (min-width: 1024px) {
    .why-pharos__grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  .why-pharos__left {
    position: sticky;
    top: 8rem;
  }

  .why-pharos__title {
    margin: 0 0 var(--space-lg);
    font-family: var(--font-mono);
    font-size: clamp(3rem, 5vw, 3.75rem);
    font-weight: 700;
    line-height: 1.05;
    letter-spacing: -0.02em;
    color: var(--text);
  }

  .why-pharos__lead {
    margin: 0 0 var(--space-xl);
    max-width: 28rem;
    font-family: var(--font-mono);
    font-size: 1.125rem;
    line-height: 1.65;
    color: var(--text-secondary);
  }

  .why-pharos__bullets {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .why-pharos__bullet {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .why-pharos__icon {
    flex-shrink: 0;
    color: var(--accent);
  }

  .why-pharos__bullet-text {
    font-family: var(--font-mono);
    font-size: 1rem;
    font-weight: 700;
    color: var(--accent);
    letter-spacing: 0.02em;
  }

  .why-pharos__right {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 4rem;
    padding-left: 1.5rem;
  }

  .why-pharos__rail {
    position: absolute;
    left: 3px;
    top: 4px;
    bottom: 4px;
    width: 1px;
    background: var(--accent);
    opacity: 0.3;
  }

  .why-pharos__trace-item {
    position: relative;
    display: flex;
    align-items: flex-start;
  }

  .why-pharos__trace-dot {
    position: absolute;
    left: -1.5rem;
    top: 6px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 8px color-mix(in srgb, var(--accent) 50%, transparent);
    transform: translateX(-50%);
    margin-left: 3.5px;
  }

  .why-pharos__trace-body {
    padding-left: 0.75rem;
  }

  .why-pharos__trace-title {
    margin: 0 0 var(--space-sm);
    font-family: var(--font-mono);
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.25;
    color: var(--accent-hover);
  }

  .why-pharos__trace-desc {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.9375rem;
    line-height: 1.65;
    color: var(--text-secondary);
  }

  @media (max-width: 1023px) {
    .why-pharos__left {
      position: static;
    }
  }
</style>
