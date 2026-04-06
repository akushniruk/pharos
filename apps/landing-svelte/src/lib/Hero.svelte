<script lang="ts">
  const repoUrl = 'https://github.com/akushniruk/pharos'
</script>

<section class="hero" aria-labelledby="hero-title">
  <div class="hero__inner">
    <p class="eyebrow">Local-first · Open source</p>
    <div class="brand">
      <img src="/pharos-mark.svg" width="48" height="48" alt="" class="mark" />
      <h1 id="hero-title">Pharos</h1>
    </div>
    <p class="lede">
      Pharos makes <strong>AI coding agents observable and governable</strong> on your machine: see what ran,
      under what rules, and prove it — so security and platform teams can say <strong>yes</strong> to agents
      without trading away clarity. Speed follows once the lights are on.
    </p>
    <p class="promise">
      See what your coding agent does, govern it, and prove it — then ship faster because the system is
      inspectable.
    </p>
    <div class="actions">
      <a class="btn btn--primary" href={repoUrl}>View on GitHub</a>
      <a class="btn btn--ghost" href={`${repoUrl}#readme`}>Read the README</a>
    </div>
  </div>
</section>

<style>
  .hero {
    padding: 4rem 1.5rem 3rem;
    border-bottom: 1px solid var(--stroke);
  }

  .hero__inner {
    max-width: var(--max);
    margin: 0 auto;
  }

  .eyebrow {
    margin: 0 0 1rem;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
    font-family: var(--font-mono);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.25rem;
  }

  .mark {
    filter: drop-shadow(0 0 12px rgba(94, 234, 212, 0.35));
  }

  h1 {
    margin: 0;
    font-size: clamp(2.5rem, 6vw, 3.5rem);
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1.1;
  }

  .lede {
    margin: 0 0 1rem;
    max-width: 42rem;
    color: var(--muted);
    font-size: 1.125rem;
  }

  .lede strong {
    color: var(--text);
    font-weight: 600;
  }

  .promise {
    margin: 0 0 2rem;
    padding: 1rem 1.25rem;
    max-width: 42rem;
    border-radius: var(--radius);
    border: 1px solid var(--stroke);
    background: linear-gradient(135deg, var(--accent-dim), transparent 60%);
    font-size: 1.05rem;
    color: var(--text);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.65rem 1.25rem;
    border-radius: 999px;
    font-weight: 600;
    font-size: 0.95rem;
    text-decoration: none;
    border: 1px solid transparent;
    transition:
      background 0.15s,
      border-color 0.15s,
      color 0.15s;
  }

  .btn--primary {
    background: var(--accent);
    color: #042f2e;
    border-color: var(--accent);
  }

  .btn--primary:hover {
    background: #99f6e4;
    color: #042f2e;
  }

  .btn--ghost {
    background: transparent;
    color: var(--text);
    border-color: var(--stroke);
  }

  .btn--ghost:hover {
    border-color: var(--muted);
    color: var(--accent);
  }
</style>
