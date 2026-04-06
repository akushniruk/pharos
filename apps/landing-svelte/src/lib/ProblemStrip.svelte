<section class="strip" aria-labelledby="problem-heading">
  <div class="strip__inner">
    <h2 id="problem-heading">The problem</h2>
    <div class="cols">
      <div class="col">
        <p class="label">Without a local observability layer</p>
        <p>
          Agent work disappears into chat scrollback and scattered logs. It is hard to answer “what ran,
          where, and under what assumptions?” — so <strong class="warn">trust breaks first</strong> and
          rollouts stall.
        </p>
      </div>
      <div class="col col--accent">
        <p class="label">With Pharos</p>
        <p>
          Sessions and events stay <strong>addressable</strong> — skim, search, and trace what happened.
          Structured events from transcripts make behavior legible for security, leads, and builders alike.
        </p>
      </div>
    </div>
  </div>
</section>

<style>
  .strip {
    padding: 3rem 1.5rem;
    border-block: 1px solid var(--stroke);
  }

  .strip__inner {
    max-width: var(--max);
    margin: 0 auto;
  }

  h2 {
    margin: 0 0 1.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .cols {
    display: grid;
    gap: 1.25rem;
    grid-template-columns: 1fr;
  }

  @media (min-width: 720px) {
    .cols {
      grid-template-columns: 1fr 1fr;
    }
  }

  .col {
    padding: 1.25rem 1.35rem;
    border-radius: var(--radius);
    border: 1px solid var(--stroke);
    background: rgba(0, 0, 0, 0.2);
  }

  .col--accent {
    border-color: rgba(94, 234, 212, 0.35);
    background: var(--accent-dim);
  }

  .label {
    margin: 0 0 0.5rem;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
  }

  .col p:last-child {
    margin: 0;
    color: var(--muted);
    font-size: 0.98rem;
  }

  .col strong {
    color: var(--text);
    font-weight: 600;
  }

  .warn {
    color: var(--warn);
  }
</style>
