<script lang="ts">
  const points = [
    {
      title: 'Auditability first',
      body: 'Actions show up where reviewers already work—scan, share, and reproduce runs instead of reverse-engineering chat.',
    },
    {
      title: 'Observable by default',
      body: '“What ran, in what order, under what rules” is modeled as events—not an afterthought once something breaks.',
    },
    {
      title: 'Local-first clarity',
      body: 'Truth starts on the machine where the agent ran: your files, your retention, your scope—before any cloud story.',
    },
    {
      title: 'Control as scale',
      body: 'Guardrails are how more people get to use agents safely; they are not busywork bolted on at the end.',
    },
    {
      title: 'Clarity, then velocity',
      body: 'Understand what is running, govern with confidence, ship faster with proof—same order every time.',
    },
  ] as const
</script>

<section class="section" aria-labelledby="proof-heading">
  <div class="section__inner">
    <h2 id="proof-heading">Why observability comes first</h2>
    <p class="sub">
      Lead with <strong>trust and evidence</strong>; treat speed as the outcome once behavior is
      legible—not something you buy by hiding the trail.
    </p>
    <ul class="grid">
      {#each points as p}
        <li class="card">
          <h3>{p.title}</h3>
          <p>{p.body}</p>
        </li>
      {/each}
    </ul>
  </div>
</section>

<style>
  .section {
    padding: var(--space-2xl) var(--space-lg) var(--space-3xl);
    background: linear-gradient(180deg, var(--bg1) 0%, var(--bg0) 100%);
  }

  .section__inner {
    max-width: var(--max);
    margin: 0 auto;
  }

  h2 {
    margin: 0 0 var(--space-sm);
    font-size: clamp(1.375rem, 2.8vw, 1.875rem);
    font-weight: 700;
    letter-spacing: -0.025em;
    line-height: 1.2;
    color: var(--text);
  }

  .sub {
    margin: 0 0 var(--space-xl);
    max-width: 36rem;
    color: var(--text-secondary);
    font-size: 1rem;
    line-height: 1.58;
  }

  .sub strong {
    color: var(--text);
    font-weight: 600;
  }

  .grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-md);
    grid-template-columns: repeat(auto-fill, minmax(272px, 1fr));
  }

  .card {
    margin: 0;
    padding: var(--space-lg);
    border-radius: var(--radius);
    border: 1px solid var(--stroke-strong);
    background: var(--surface);
    box-shadow: var(--shadow-sm);
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease,
      transform 0.2s ease;
  }

  .card:hover {
    border-color: color-mix(in srgb, var(--accent) 35%, var(--stroke-strong));
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
  }

  @media (prefers-reduced-motion: reduce) {
    .card {
      transition: none;
    }

    .card:hover {
      transform: none;
    }
  }

  .card h3 {
    margin: 0 0 var(--space-sm);
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: -0.015em;
    color: var(--text);
  }

  .card p {
    margin: 0;
    font-size: 0.9375rem;
    line-height: 1.58;
    color: var(--muted);
  }
</style>
