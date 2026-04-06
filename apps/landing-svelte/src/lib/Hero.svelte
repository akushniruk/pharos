<script lang="ts">
  import TerminalBlock from './TerminalBlock.svelte'

  const terminalLines = [
    '<span class="t-dim">$ </span><span class="t-hl">make up</span>',
    '<span class="t-dim">Started daemon on </span><span class="t-prompt">http://127.0.0.1:4000</span>',
    '<span class="t-dim">Started client on </span><span class="t-prompt">http://127.0.0.1:5173</span>',
    '<span class="t-dim">scanning ~/.claude/sessions/ …</span>',
    '<span class="t-hl">+ session</span> <span class="t-prompt">claude:a3f8b2c1</span> <span class="t-dim">cwd=pharos</span>',
    '<span class="t-hl">+ session</span> <span class="t-prompt">cursor:77x9d4e2</span> <span class="t-dim">cwd=my-api</span>',
    '<span class="t-dim">tailing 2 sessions · ws broadcast ready</span>',
    '',
    '<span class="t-prompt">14:22:01</span> <span class="t-hl">tool_use</span> <span class="t-dim">Edit → src/lib/api.ts</span>',
    '<span class="t-prompt">14:22:04</span> <span class="t-hl">assistant</span> <span class="t-dim">summarizing workspace diff</span>',
    '<span class="t-prompt">14:22:09</span> <span class="t-hl">shell</span>   <span class="t-dim">pnpm run check (exit 0)</span>',
    '<span class="t-prompt">14:22:15</span> <span class="t-hl">tool_use</span> <span class="t-dim">Read → apps/daemon-rs/src/model.rs</span>',
  ]
</script>

<section class="hero" aria-labelledby="hero-title">
  <div class="hero__inner">
    <div class="hero__grid">
      <div class="hero__text">
        <div class="hero__badge" role="status">
          <span class="hero__badge-dot" aria-hidden="true"></span>
          <span class="hero__badge-label">V0.1.0_ALPHA</span>
        </div>

        <h1 id="hero-title" class="hero__title">
          SEE WHAT YOUR AI AGENTS ARE ACTUALLY DOING.
        </h1>

        <p class="hero__subtitle">
          Pharos watches your coding agents in real time — tailing session transcripts, structuring events, and streaming everything to a live dashboard. Local-only. Built in Rust.
        </p>

        <div class="hero__actions">
          <a
            class="hero__btn hero__btn--primary"
            href="https://github.com/akushniruk/pharos/releases"
            target="_blank"
            rel="noopener noreferrer"
          >
            DOWNLOAD_APP
            <svg class="hero__btn-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"
              />
            </svg>
          </a>
          <a
            class="hero__btn hero__btn--ghost"
            href="#deploy-heading"
          >
            <svg class="hero__btn-icon hero__btn-icon--terminal" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M4 5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H4Zm0 2h16v10H4V7Zm3.5 2.5 1.06 1.06L6.12 12l2.44 2.44L7.5 15.5 4 12l3.5-3.5ZM11 15h6v-2h-6v2Z"
              />
            </svg>
            RUN_AS_DAEMON
          </a>
        </div>
      </div>

      <div class="hero__terminal-col">
        <div class="hero__terminal-glow" aria-hidden="true"></div>
        <div class="hero__terminal-frame">
          <TerminalBlock
            class="hero__terminal-block"
            title="TTY: agent-77x_stream"
            lines={terminalLines}
            animate={true}
          />
        </div>
      </div>
    </div>
  </div>
</section>

<style>
  .hero {
    --bg0: #0a0c0e;
    --bg1: #0d1117;
    --bg2: #1a2426;
    --accent: #00ff41;
    --accent-hover: #00f3ff;
    --text: #e6edf3;
    --text-secondary: #8b949e;
    --stroke: #30363d;
    --accent-glow: rgba(0, 255, 65, 0.35);
    --shadow-glow: 0 0 24px rgba(0, 255, 65, 0.25);
    --font-mono: 'Fira Code', ui-monospace, monospace;

    font-family: var(--font-mono);
    color: var(--text);
    background: var(--bg0);
  }

  .hero__inner {
    max-width: 1280px;
    margin-inline: auto;
    padding: 6rem 2rem;
  }

  .hero__grid {
    display: grid;
    gap: 3rem;
    align-items: center;
  }

  .hero__text {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    min-width: 0;
  }

  .hero__badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    align-self: flex-start;
    padding: 0.35rem 0.65rem;
    border: 1px solid var(--accent);
    border-radius: 2px;
    background: color-mix(in srgb, var(--accent) 5%, transparent);
  }

  .hero__badge-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 9999px;
    background: var(--accent);
    box-shadow: 0 0 8px var(--accent-glow);
    animation: hero-pulse 1.6s ease-in-out infinite;
  }

  .hero__badge-label {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--accent);
  }

  .hero__title {
    margin: 0;
    font-size: clamp(3rem, 5vw + 1.5rem, 4.5rem);
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.02em;
    text-transform: uppercase;
    color: var(--text);
  }

  .hero__subtitle {
    margin: 0;
    max-width: 42rem;
    font-size: clamp(1.125rem, 0.5vw + 1rem, 1.25rem);
    line-height: 1.6;
    color: var(--text-secondary);
  }

  .hero__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 0.25rem;
  }

  .hero__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-decoration: none;
    border-radius: 2px;
    border: 1px solid transparent;
    transition:
      background-color 0.15s ease,
      color 0.15s ease,
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  .hero__btn--primary {
    background: var(--accent);
    color: #000000;
    border-color: var(--accent);
    box-shadow: var(--shadow-glow);
  }

  .hero__btn--primary:hover {
    background: var(--accent-hover);
    border-color: var(--accent-hover);
    color: #000000;
    box-shadow: 0 0 28px rgba(0, 243, 255, 0.35);
  }

  .hero__btn--ghost {
    background: transparent;
    color: var(--accent);
    border-color: var(--accent);
  }

  .hero__btn--ghost:hover {
    background: color-mix(in srgb, var(--accent) 10%, transparent);
    color: var(--accent);
    border-color: var(--accent);
  }

  .hero__btn-icon {
    width: 1.125rem;
    height: 1.125rem;
    flex-shrink: 0;
  }

  .hero__btn--ghost .hero__btn-icon--terminal {
    margin-right: 0.125rem;
  }

  .hero__terminal-col {
    position: relative;
    min-width: 0;
  }

  .hero__terminal-glow {
    position: absolute;
    left: 50%;
    bottom: -15%;
    width: 85%;
    height: 55%;
    transform: translateX(-50%);
    pointer-events: none;
    background: radial-gradient(ellipse at center, var(--accent-glow), transparent 70%);
    filter: blur(48px);
    opacity: 0.65;
    z-index: 0;
  }

  .hero__terminal-frame {
    position: relative;
    z-index: 1;
    width: 100%;
  }

  :global(.hero__terminal-block) {
    width: 100%;
    height: 100%;
    border-radius: 2px;
    display: flex;
    flex-direction: column;
    background: var(--bg1) !important;
    border-color: var(--accent) !important;
  }

  :global(.hero__terminal-block .terminal__body) {
    flex: 1;
    min-height: 0;
  }

  :global(.t-prompt) {
    color: var(--accent-hover);
  }

  :global(.t-hl) {
    color: var(--accent);
  }

  :global(.t-dim) {
    color: var(--text-secondary);
  }

  @keyframes hero-pulse {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.45;
      transform: scale(0.92);
    }
  }

  @media (min-width: 768px) {
    .hero__inner {
      padding-block: 8rem;
    }
  }

  @media (min-width: 1024px) {
    .hero__grid {
      grid-template-columns: repeat(12, minmax(0, 1fr));
      gap: 2.5rem;
    }

    .hero__text {
      grid-column: span 7;
    }

    .hero__terminal-col {
      grid-column: span 5;
    }

    .hero__terminal-frame {
      aspect-ratio: 1 / 1;
    }

    :global(.hero__terminal-block) {
      min-height: 100%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .hero__badge-dot {
      animation: none;
    }
  }
</style>
