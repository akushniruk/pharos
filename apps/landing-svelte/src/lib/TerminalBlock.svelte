<script lang="ts">
  let {
    title = 'Terminal',
    lines = [] as string[],
    animate = false,
    animationDelay = 0,
    class: className = '',
  }: {
    title?: string
    lines?: string[]
    animate?: boolean
    animationDelay?: number
    class?: string
  } = $props()

  let el: HTMLDivElement | undefined = $state()
  let visibleCount = $derived(animate ? 0 : lines.length)
  let revealed = $state(false)

  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  let animCount = $state(0)
  let displayCount = $derived(revealed ? animCount : visibleCount)

  $effect(() => {
    if (!animate || prefersReducedMotion || !el) {
      revealed = true
      animCount = lines.length
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect()
          revealed = true
          let i = 0
          const interval = setInterval(() => {
            i++
            animCount = i
            if (i >= lines.length) clearInterval(interval)
          }, 600)
        }
      },
      { threshold: 0.3 },
    )

    observer.observe(el)
    return () => observer.disconnect()
  })
</script>

<div bind:this={el} class={['terminal', className].filter(Boolean).join(' ')} style:animation-delay="{animationDelay}ms">
  <div class="terminal__chrome">
    <span class="terminal__title">{title}</span>
    <div class="terminal__indicators">
      <span class="terminal__hex">0x0F</span>
      <span class="terminal__dot terminal__dot--dim"></span>
      <span class="terminal__dot terminal__dot--active"></span>
    </div>
  </div>
  <div class="terminal__body">
    {#each lines.slice(0, displayCount) as line, i}
      <div class="terminal__line" class:terminal__line--new={animate && i === displayCount - 1}>
        {@html line}
      </div>
    {/each}
    {#if animate && displayCount < lines.length}
      <div class="terminal__cursor">
        <span class="terminal__blink">_</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .terminal {
    border: 1px solid var(--accent);
    box-shadow: 0 0 10px rgba(0, 255, 65, 0.1), 0 8px 32px rgba(0, 0, 0, 0.5);
    background: #000;
    overflow: hidden;
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    line-height: 1.7;
  }

  .terminal__chrome {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-bottom: 1px solid var(--bg2);
  }

  .terminal__title {
    font-size: 0.75rem;
    color: var(--accent);
    letter-spacing: -0.03em;
    font-weight: 500;
  }

  .terminal__indicators {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .terminal__hex {
    font-size: 0.625rem;
    color: var(--bg2);
    letter-spacing: 0.02em;
  }

  .terminal__dot {
    width: 10px;
    height: 10px;
  }

  .terminal__dot--dim {
    background: rgba(0, 255, 65, 0.2);
  }

  .terminal__dot--active {
    background: var(--accent);
  }

  .terminal__body {
    padding: 16px 18px;
    overflow-x: auto;
  }

  .terminal__line {
    white-space: pre;
    color: var(--text-secondary);
  }

  .terminal__line--new {
    animation: line-fade 0.4s ease-out;
  }

  .terminal__cursor {
    display: inline;
  }

  .terminal__blink {
    color: var(--accent);
    animation: blink 1s step-end infinite;
  }

  @keyframes line-fade {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes blink {
    50% {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .terminal__line--new {
      animation: none;
    }

    .terminal__blink {
      animation: none;
    }
  }
</style>
