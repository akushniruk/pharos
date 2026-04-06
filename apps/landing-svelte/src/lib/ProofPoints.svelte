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
    padding: 3.5rem 1.5rem;
    background: linear-gradient(180deg, transparent, var(--bg1) 30%, var(--bg1));
  }

  .section__inner {
    max-width: var(--max);
    margin: 0 auto;
  }

  h2 {
    margin: 0 0 0.5rem;
    font-size: clamp(1.5rem, 3vw, 2rem);
    letter-spacing: -0.02em;
  }

  .sub {
    margin: 0 0 2rem;
    max-width: 40rem;
    color: var(--muted);
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
    gap: 1rem;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  }

  .card {
    margin: 0;
    padding: 1.25rem 1.35rem;
    border-radius: var(--radius);
    border: 1px solid var(--stroke);
    background: var(--bg2);
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.04) inset;
  }

  .card h3 {
    margin: 0 0 0.5rem;
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--accent);
  }

  .card p {
    margin: 0;
    font-size: 0.95rem;
    color: var(--muted);
  }
</style>
