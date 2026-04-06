<script lang="ts">
  type NavKey = 'features' | 'why' | 'install' | 'docs'

  let {
    gitPullUrl = 'https://github.com/akushniruk/pharos',
    initSessionHref = '#cta-heading',
  }: {
    gitPullUrl?: string
    initSessionHref?: string
  } = $props()

  let activeNav = $state<NavKey>('features')

  const navItems: { key: NavKey; label: string; href: string }[] = [
    { key: 'features', label: 'FEATURES', href: '#features-heading' },
    { key: 'why', label: 'WHY_PHAROS', href: '#why-pharos-heading' },
    { key: 'install', label: 'INSTALL', href: '#deploy-heading' },
    { key: 'docs', label: 'DOCS', href: 'https://github.com/akushniruk/pharos#readme' },
  ]

  function setActive(key: NavKey) {
    activeNav = key
  }
</script>

<header class="header">
  <div class="header__inner">
    <a class="brand" href="/" aria-label="Pharos home">
      <span class="brand__icon" aria-hidden="true">
        <img class="brand__svg" src="/pharos-mark.svg" alt="" />
      </span>
      <span class="brand__text">PHAROS</span>
    </a>

    <nav class="nav" aria-label="Primary">
      <ul class="nav__list">
        {#each navItems as item (item.key)}
          <li>
            <a
              class="nav__link"
              class:nav__link--active={activeNav === item.key}
              href={item.href}
              target={item.href.startsWith('http') ? '_blank' : undefined}
              rel={item.href.startsWith('http') ? 'noopener noreferrer' : undefined}
              onclick={() => setActive(item.key)}
            >
              {item.label}
            </a>
          </li>
        {/each}
      </ul>
    </nav>

    <div class="actions">
      <a
        class="actions__git"
        href={gitPullUrl}
        rel="noopener noreferrer"
        target="_blank"
      >
        GIT_PULL
      </a>
      <a class="actions__cta" href="https://github.com/akushniruk/pharos/releases" target="_blank" rel="noopener noreferrer">RELEASES</a>
    </div>
  </div>
</header>

<style>
  .header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 50;
    width: 100%;
    border-bottom: 1px solid var(--stroke);
    background: color-mix(in srgb, var(--bg0) 80%, transparent);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    font-family: var(--font-mono);
  }

  .header__inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    max-width: var(--max);
    margin: 0 auto;
    padding: var(--space-sm) var(--space-lg);
    min-height: 3rem;
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: var(--space-sm);
    text-decoration: none;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 600;
    font-size: 0.8125rem;
    flex-shrink: 0;
  }

  .brand__icon {
    display: flex;
    color: var(--accent);
  }

  .brand__svg {
    width: 1.5rem;
    height: auto;
    display: block;
  }

  .brand__text {
    text-shadow: 0 0 8px rgba(0, 255, 65, 0.6);
  }

  .brand:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
    border-radius: var(--radius-sm);
  }

  .nav {
    flex: 1;
    display: none;
    justify-content: center;
    min-width: 0;
  }

  .nav__list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: var(--space-xs) var(--space-lg);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .nav__link {
    display: inline-block;
    padding: var(--space-xs) 0;
    text-decoration: none;
    text-transform: uppercase;
    font-size: 0.75rem;
    font-weight: 500;
    letter-spacing: 0.12em;
    color: var(--text-secondary);
    border-bottom: 1px solid transparent;
    border-radius: var(--radius-sm);
    transition:
      color 0.15s ease,
      border-color 0.15s ease,
      text-shadow 0.15s ease;
  }

  .nav__link:hover {
    color: var(--accent-hover);
    text-shadow: 0 0 10px color-mix(in srgb, var(--accent-hover) 45%, transparent);
  }

  .nav__link--active {
    color: var(--accent);
    text-shadow: 0 0 8px rgba(0, 255, 65, 0.45);
    border-bottom-color: color-mix(in srgb, var(--accent) 55%, transparent);
  }

  .nav__link:focus-visible {
    outline: 2px solid var(--accent-hover);
    outline-offset: 2px;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    flex-shrink: 0;
  }

  .actions__git {
    display: none;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    text-transform: uppercase;
    font-size: 0.6875rem;
    font-weight: 500;
    letter-spacing: 0.14em;
    color: var(--text-secondary);
    padding: var(--space-xs) var(--space-sm);
    border: 1px solid var(--stroke);
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--bg1) 70%, transparent);
    transition:
      color 0.15s ease,
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  .actions__git:hover {
    color: var(--accent-hover);
    border-color: color-mix(in srgb, var(--accent-hover) 40%, var(--stroke));
    box-shadow: var(--shadow-glow);
  }

  .actions__git:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .actions__cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-xs) var(--space-md);
    text-decoration: none;
    text-transform: uppercase;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--accent-foreground);
    background: var(--accent);
    border: 1px solid var(--accent);
    border-radius: var(--radius-sm);
    box-shadow: 0 0 12px color-mix(in srgb, var(--accent) 35%, transparent);
    transition:
      background-color 0.15s ease,
      border-color 0.15s ease,
      color 0.15s ease,
      box-shadow 0.15s ease;
  }

  .actions__cta:hover {
    background: var(--accent-hover);
    border-color: var(--accent-hover);
    color: var(--accent-foreground);
    box-shadow: 0 0 16px color-mix(in srgb, var(--accent-hover) 40%, transparent);
  }

  .actions__cta:focus-visible {
    outline: 2px solid var(--accent-hover);
    outline-offset: 2px;
  }

  @media (min-width: 640px) {
    .nav {
      display: flex;
    }

    .actions__git {
      display: inline-flex;
    }
  }
</style>
