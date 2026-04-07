import { Icon } from 'solid-heroicons';
import { sun, moon, academicCap } from 'solid-heroicons/solid';
import { theme, toggleTheme } from '../lib/theme';

import PharosMark from './PharosMark';

const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

interface HeaderProps {
  isDocsRoute?: boolean;
  onNavigateHome?: () => void;
  onNavigateDocs?: () => void;
}

export default function Header(props: HeaderProps) {
  return (
    <header class="app-header">
      {/* Left: Brand */}
      <button
        type="button"
        onClick={() => props.onNavigateHome?.()}
        title="Go to home dashboard"
        class="app-header-brand"
      >
        <span class="brand__icon" aria-hidden="true">
          <PharosMark size={22} class="brand__svg" />
        </span>
        <span class="app-header-brand-text">
          PHAROS{isDesktop && <span class="brand__suffix">.DESKTOP</span>}
        </span>
      </button>

      <div class="flex-1" />

      {/* Right: Docs + theme (monochrome icon buttons) */}
      <div class="app-header-actions">
        <button
          type="button"
          class="header-action-btn"
          classList={{ 'is-active': Boolean(props.isDocsRoute) }}
          onClick={() => props.onNavigateDocs?.()}
          title="Documentation"
          aria-label="Open documentation"
          aria-current={props.isDocsRoute ? 'page' : undefined}
        >
          <Icon path={academicCap} class="header-action-icon" />
        </button>
        <button
          type="button"
          class="header-action-btn"
          onClick={toggleTheme}
          title={theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <Icon path={theme() === 'dark' ? sun : moon} class="header-action-icon" />
        </button>
      </div>
    </header>
  );
}
