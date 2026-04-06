<section class="strip" aria-labelledby="problem-heading">
  <div class="strip__inner">
    <h2 id="problem-heading">The problem</h2>
    <div class="cols">
      <div class="col">
        <p class="label">Without a local observability layer</p>
        <p>
          Work disappears into chat scrollback and one-off logs. When nobody can answer “what ran, where,
          and under what assumptions?”, <strong class="warn">trust breaks first</strong>—and agent rollouts
          stall before they scale.
        </p>
      </div>
      <div class="col col--accent">
        <p class="label">With Pharos</p>
        <p>
          Sessions stay <strong>addressable</strong>: skim, search, and trace runs from structured events—not
          from memory. That legibility is what lets security reviewers, engineering leads, and daily
          practitioners stay aligned.
        </p>
      </div>
    </div>
  </div>
</section>

<style>
  .strip {
    padding: var(--space-2xl) var(--space-lg);
    border-block: 1px solid var(--stroke);
    background: linear-gradient(180deg, transparent, var(--surface) 100%);
  }

  .strip__inner {
    max-width: var(--max);
    margin: 0 auto;
  }

  h2 {
    margin: 0 0 var(--space-lg);
    font-size: 0.6875rem;
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.11em;
    font-family: var(--font-mono);
  }

  .cols {
    display: grid;
    gap: var(--space-md);
    grid-template-columns: 1fr;
  }

  @media (min-width: 720px) {
    .cols {
      grid-template-columns: 1fr 1fr;
      gap: var(--space-lg);
    }
  }

  .col {
    padding: var(--space-lg) var(--space-lg);
    border-radius: var(--radius);
    border: 1px solid var(--stroke-strong);
    background: var(--surface);
    box-shadow: var(--shadow-sm);
  }

  .col--accent {
    border-color: color-mix(in srgb, var(--accent) 42%, var(--stroke-strong));
    background: linear-gradient(160deg, var(--accent-dim), var(--surface) 70%);
    box-shadow:
      var(--shadow-sm),
      0 0 0 1px color-mix(in srgb, var(--accent) 12%, transparent) inset;
  }

  .label {
    margin: 0 0 var(--space-sm);
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--accent);
  }

  .col--accent .label {
    color: var(--accent);
  }

  .col p:last-child {
    margin: 0;
    color: var(--text-secondary);
    font-size: 0.9375rem;
    line-height: 1.62;
  }

  .col strong {
    color: var(--text);
    font-weight: 600;
  }

  .warn {
    color: var(--warn);
  }
</style>
