<script lang="ts">
  const repoUrl = 'https://github.com/akushniruk/pharos'
</script>

<section class="hero" aria-labelledby="hero-title">
  <div class="hero__glow" aria-hidden="true"></div>
  <div class="hero__inner">
    <p class="eyebrow">Local observability · Open source</p>
    <div class="brand">
      <img src="/pharos-mark.svg" width="48" height="48" alt="" class="mark" />
      <h1 id="hero-title">Pharos</h1>
    </div>
    <p class="lede">
      A <strong>local observability layer</strong> for coding agents: the daemon tails session transcripts on
      your machine, normalizes them into events, and the dashboard shows what ran—so security and platform
      teams get <strong>evidence</strong>, not screenshots of a chat thread.
    </p>
    <p class="promise">
      <strong>See what your agent did, govern it, and prove it.</strong> Velocity comes after the lights are
      on.
    </p>
    <div class="actions">
      <a class="btn btn--primary" href={repoUrl}>View on GitHub</a>
      <a class="btn btn--ghost" href={`${repoUrl}#readme`}>Read the README</a>
    </div>
  </div>
</section>

<style>
  .hero {
    position: relative;
    padding: var(--space-3xl) var(--space-lg) var(--space-2xl);
    border-bottom: 1px solid var(--stroke);
    overflow: clip;
  }

  .hero__glow {
    pointer-events: none;
    position: absolute;
    inset: -40% -20% auto;
    height: min(520px, 85vw);
    background: radial-gradient(ellipse 55% 60% at 50% 0%, var(--accent-glow), transparent 72%);
    opacity: 0.9;
  }

  .hero__inner {
    position: relative;
    max-width: var(--max);
    margin: 0 auto;
  }

  .eyebrow {
    margin: 0 0 var(--space-md);
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--accent);
    font-family: var(--font-mono);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    margin-bottom: var(--space-lg);
  }

  .mark {
    flex-shrink: 0;
    filter: drop-shadow(0 4px 20px var(--accent-glow));
  }

  h1 {
    margin: 0;
    font-size: clamp(2.75rem, 6.5vw, 3.75rem);
    font-weight: 700;
    letter-spacing: -0.035em;
    line-height: 1.05;
    color: var(--text);
  }

  .lede {
    margin: 0 0 var(--space-md);
    max-width: 38rem;
    color: var(--text-secondary);
    font-size: clamp(1.0625rem, 2vw, 1.1875rem);
    line-height: 1.62;
  }

  .lede strong {
    color: var(--text);
    font-weight: 600;
  }

  .promise {
    margin: 0 0 var(--space-xl);
    padding: var(--space-lg) var(--space-lg);
    max-width: 38rem;
    border-radius: var(--radius);
    border: 1px solid var(--stroke-strong);
    background: linear-gradient(145deg, var(--accent-dim), var(--surface) 55%, transparent);
    box-shadow: var(--shadow-sm);
    font-size: 1rem;
    line-height: 1.55;
    color: var(--text-secondary);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 2.75rem;
    padding: 0 var(--space-lg);
    border-radius: 999px;
    font-weight: 600;
    font-size: 0.9375rem;
    text-decoration: none;
    border: 1px solid transparent;
    transition:
      background 0.18s ease,
      border-color 0.18s ease,
      color 0.18s ease,
      box-shadow 0.18s ease,
      transform 0.18s ease;
  }

  .btn--primary {
    background: var(--accent);
    color: var(--accent-foreground);
    border-color: color-mix(in srgb, var(--accent) 88%, black);
    box-shadow: 0 1px 0 color-mix(in srgb, white 22%, transparent) inset;
  }

  .btn--primary:hover {
    background: var(--accent-hover);
    color: var(--accent-foreground);
    transform: translateY(-1px);
    box-shadow:
      0 1px 0 color-mix(in srgb, white 28%, transparent) inset,
      var(--shadow-md);
  }

  .btn--ghost {
    background: var(--surface);
    color: var(--text);
    border-color: var(--stroke-strong);
  }

  .btn--ghost:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: color-mix(in srgb, var(--surface) 85%, var(--accent-dim));
  }
</style>
