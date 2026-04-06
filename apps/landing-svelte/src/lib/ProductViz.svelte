<script lang="ts">
  import TerminalBlock from './TerminalBlock.svelte'
  import ScrollReveal from './ScrollReveal.svelte'

  const sessions = [
    { id: 'cursor:a3f8b2c1', active: true, selected: true },
    { id: 'claude:77x9d4e2', active: false, selected: false },
    { id: 'myapp:b4e9f1a3', active: false, selected: false },
    { id: 'api-srv:2c7d8e01', active: false, selected: false },
  ]

  const events = [
    {
      time: '14:22:01',
      badge: 'tool_use',
      badgeTone: 'cyan' as const,
      desc: 'Edit → src/lib/api.ts',
    },
    {
      time: '14:22:04',
      badge: 'message',
      badgeTone: 'green' as const,
      desc: 'Assistant: summarizing workspace diff',
    },
    {
      time: '14:22:09',
      badge: 'shell',
      badgeTone: 'dim' as const,
      desc: 'pnpm run check (exit 0)',
    },
    {
      time: '14:22:15',
      badge: 'tool_use',
      badgeTone: 'cyan' as const,
      desc: 'Read → apps/daemon-rs/src/model.rs',
    },
  ]

  const k = 'pviz-json-key'
  const s = 'pviz-json-str'
  const p = 'pviz-json-punct'
  const n = 'pviz-json-num'

  const terminalLines = [
    `<span class="${p}">{</span>`,
    `  <span class="${k}">"type"</span><span class="${p}">: </span><span class="${s}">"tool_use"</span><span class="${p}">,</span>`,
    `  <span class="${k}">"agent"</span><span class="${p}">: </span><span class="${s}">"claude:77x9d4e2"</span><span class="${p}">,</span>`,
    `  <span class="${k}">"tool"</span><span class="${p}">: </span><span class="${s}">"Edit"</span><span class="${p}">,</span>`,
    `  <span class="${k}">"path"</span><span class="${p}">: </span><span class="${s}">"src/lib/api.ts"</span><span class="${p}">,</span>`,
    `  <span class="${k}">"ts"</span><span class="${p}">: </span><span class="${s}">"2024-03-15T14:22:01Z"</span><span class="${p}">,</span>`,
    `  <span class="${k}">"cost_usd"</span><span class="${p}">: </span><span class="${n}">0.003</span>`,
    `<span class="${p}">}</span>`,
  ]
</script>

<ScrollReveal threshold={0.12}>
  <section class="pviz" aria-labelledby="pviz-heading">
    <div class="pviz__inner">
      <header class="pviz__header">
        <p class="pviz__label">// RUNTIME_DIAGNOSTICS</p>
        <h2 id="pviz-heading" class="pviz__title">See everything your agents execute.</h2>
      </header>

      <div class="pviz__grid">
        <div class="pviz__mock">
          <div class="dash">
            <div class="dash__titlebar">
              <span class="dash__titlebar-dots" aria-hidden="true">
                <span class="dash__dot dash__dot--r"></span>
                <span class="dash__dot dash__dot--y"></span>
                <span class="dash__dot dash__dot--g"></span>
              </span>
              <span class="dash__titlebar-text">pharos — live stream</span>
            </div>

            <div class="dash__body">
              <aside class="dash__sidebar" aria-label="Sessions">
                <div class="dash__sidebar-head">sessions</div>
                {#each sessions as row (row.id)}
                  <div class="sess" class:sess--on={row.selected}>
                    <span class="sess__led" class:sess__led--active={row.active} aria-hidden="true"></span>
                    <span class="sess__id">{row.id}</span>
                  </div>
                {/each}
              </aside>

              <div class="dash__main">
                <div class="dash__main-top">
                  <span class="dash__focus">cursor:a3f8b2c1</span>
                  <span class="dash__pill">streaming</span>
                </div>

                <div class="dash__timeline" role="list">
                  {#each events as ev (ev.time + ev.badge)}
                    <div class="ev" role="listitem">
                      <span class="ev__ts">{ev.time}</span>
                      <span class="ev__badge ev__badge--{ev.badgeTone}">{ev.badge}</span>
                      <span class="ev__txt">{ev.desc}</span>
                    </div>
                  {/each}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="pviz__terminal">
          <TerminalBlock title="event_envelope.json" lines={terminalLines} class="pviz-terminal-block" />
        </div>
      </div>
    </div>
  </section>
</ScrollReveal>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&display=swap');

  .pviz {
    --bg0: #0a0c0e;
    --bg1: #0d1117;
    --bg2: #1a2426;
    --accent: #00ff41;
    --accent-hover: #00f3ff;
    --text: #e6edf3;
    --text-secondary: #8b949e;
    --stroke: #30363d;
    --terminal-bg: #0a0c0e;
    --terminal-dim: #1a2426;
    --surface: #0d1117;

    font-family: 'Fira Code', ui-monospace, monospace;
    --font-mono: 'Fira Code', ui-monospace, monospace;

    background: var(--surface);
    padding-block: 8rem;
    color: var(--text);
  }

  .pviz__inner {
    max-width: 80rem;
    margin-inline: auto;
    padding-inline: 2rem;
  }

  .pviz__header {
    margin-bottom: 3rem;
  }

  .pviz__label {
    margin: 0 0 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    letter-spacing: 0.06em;
    color: var(--accent);
  }

  .pviz__title {
    margin: 0;
    max-width: 28rem;
    font-size: clamp(1.5rem, 3vw, 2rem);
    font-weight: 600;
    line-height: 1.25;
    color: var(--text);
  }

  .pviz__grid {
    display: grid;
    gap: 1.75rem;
    align-items: start;
  }

  @media (min-width: 960px) {
    .pviz__grid {
      grid-template-columns: 1.15fr 0.85fr;
      align-items: stretch;
    }
  }

  /* Dashboard mockup */

  .dash {
    border: 1px solid var(--stroke);
    background: var(--terminal-bg);
    box-shadow:
      0 0 0 1px rgba(0, 255, 65, 0.06),
      0 24px 48px rgba(0, 0, 0, 0.45);
    overflow: hidden;
    font-family: inherit;
  }

  .dash__titlebar {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.625rem 0.875rem;
    border-bottom: 1px solid var(--stroke);
    background: var(--bg1);
  }

  .dash__titlebar-dots {
    display: flex;
    gap: 0.375rem;
  }

  .dash__dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: var(--terminal-dim);
  }

  .dash__dot--r {
    background: #ff5f56;
  }
  .dash__dot--y {
    background: #ffbd2e;
  }
  .dash__dot--g {
    background: var(--accent);
    box-shadow: 0 0 8px rgba(0, 255, 65, 0.45);
  }

  .dash__titlebar-text {
    font-size: 0.6875rem;
    color: var(--text-secondary);
    letter-spacing: 0.02em;
  }

  .dash__body {
    display: grid;
    grid-template-columns: 11.5rem 1fr;
    min-height: 17.5rem;
  }

  @media (max-width: 640px) {
    .dash__body {
      grid-template-columns: 1fr;
    }
  }

  .dash__sidebar {
    padding: 0.625rem;
    border-right: 1px solid var(--stroke);
    background: var(--bg0);
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  @media (max-width: 640px) {
    .dash__sidebar {
      border-right: none;
      border-bottom: 1px solid var(--stroke);
      flex-flow: row wrap;
      gap: 0.375rem;
    }
  }

  .dash__sidebar-head {
    width: 100%;
    font-size: 0.625rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent-hover);
    padding: 0.25rem 0.375rem;
    margin-bottom: 0.25rem;
  }

  @media (max-width: 640px) {
    .dash__sidebar-head {
      width: 100%;
      margin-bottom: 0;
    }
  }

  .sess {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.5rem;
    border: 1px solid transparent;
    border-radius: 2px;
    cursor: default;
  }

  .sess--on {
    background: var(--terminal-dim);
    border-color: var(--stroke);
    box-shadow: inset 3px 0 0 var(--accent);
  }

  .sess__led {
    width: 0.375rem;
    height: 0.375rem;
    border-radius: 50%;
    background: var(--text-secondary);
    opacity: 0.45;
    flex-shrink: 0;
  }

  .sess__led--active {
    background: var(--accent);
    opacity: 1;
    box-shadow: 0 0 6px rgba(0, 255, 65, 0.7);
  }

  .sess__id {
    font-size: 0.6875rem;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sess--on .sess__id {
    color: var(--text);
  }

  .dash__main {
    display: flex;
    flex-direction: column;
    min-width: 0;
    background: var(--bg1);
  }

  .dash__main-top {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    flex-wrap: wrap;
    padding: 0.625rem 0.875rem;
    border-bottom: 1px solid var(--stroke);
  }

  .dash__focus {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--accent-hover);
  }

  .dash__pill {
    font-size: 0.5625rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent);
    border: 1px solid rgba(0, 255, 65, 0.35);
    padding: 0.125rem 0.5rem;
    border-radius: 999px;
    background: rgba(0, 255, 65, 0.08);
  }

  .dash__timeline {
    padding: 0.375rem 0;
    flex: 1;
  }

  .ev {
    display: grid;
    grid-template-columns: 4.25rem auto 1fr;
    gap: 0.625rem;
    align-items: center;
    padding: 0.375rem 0.875rem;
    border-bottom: 1px solid rgba(48, 54, 61, 0.6);
  }

  .ev:last-child {
    border-bottom: none;
  }

  .ev:hover {
    background: rgba(0, 243, 255, 0.04);
  }

  .ev__ts {
    font-size: 0.6875rem;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
  }

  .ev__badge {
    font-size: 0.5625rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 0.125rem 0.4375rem;
    border-radius: 2px;
    border: 1px solid var(--stroke);
    width: max-content;
  }

  .ev__badge--green {
    color: var(--accent);
    border-color: rgba(0, 255, 65, 0.4);
    background: rgba(0, 255, 65, 0.06);
  }

  .ev__badge--cyan {
    color: var(--accent-hover);
    border-color: rgba(0, 243, 255, 0.35);
    background: rgba(0, 243, 255, 0.06);
  }

  .ev__badge--dim {
    color: var(--text-secondary);
    background: var(--terminal-bg);
  }

  .ev__txt {
    font-size: 0.75rem;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .pviz__terminal {
    min-width: 0;
  }

  :global(.pviz-terminal-block.terminal) {
    background: var(--terminal-bg);
  }

  /* JSON inside TerminalBlock ({@html}) — global class names */
  :global(.pviz-json-key) {
    color: var(--accent);
  }

  :global(.pviz-json-str) {
    color: var(--accent-hover);
  }

  :global(.pviz-json-punct) {
    color: var(--text-secondary);
  }

  :global(.pviz-json-num) {
    color: var(--accent-hover);
  }
</style>
