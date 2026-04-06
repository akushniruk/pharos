<script lang="ts">
  import type { Snippet } from 'svelte'

  let {
    children,
    delay = 0,
    threshold = 0.15,
    class: className = '',
  }: {
    children: Snippet
    delay?: number
    threshold?: number
    class?: string
  } = $props()

  let el: HTMLDivElement | undefined = $state()
  let visible = $state(false)

  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  $effect(() => {
    if (!el || prefersReducedMotion) {
      visible = true
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          visible = true
          observer.disconnect()
        }
      },
      { threshold },
    )

    observer.observe(el)

    return () => observer.disconnect()
  })
</script>

<div
  bind:this={el}
  class={['scroll-reveal', visible && 'scroll-reveal--visible', className].filter(Boolean).join(' ')}
  style:transition-delay="{delay}ms"
>
  {@render children()}
</div>

<style>
  .scroll-reveal {
    opacity: 0;
    transform: translateY(24px);
    transition:
      opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1),
      transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .scroll-reveal--visible {
    opacity: 1;
    transform: translateY(0);
  }

  @media (prefers-reduced-motion: reduce) {
    .scroll-reveal {
      opacity: 1;
      transform: none;
      transition: none;
    }
  }
</style>
