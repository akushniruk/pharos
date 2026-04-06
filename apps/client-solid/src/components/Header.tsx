import { Icon } from 'solid-heroicons';
import { sun, moon, academicCap } from 'solid-heroicons/solid';
import { theme, toggleTheme } from '../lib/theme';
import PharosMark from './PharosMark';

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
        style="display:flex;align-items:center;gap:10px;flex-shrink:0;min-width:0;background:none;border:none;padding:0;cursor:pointer;"
      >
        <PharosMark size={18} class="pharos-mark" />
        <div style="display:flex;flex-direction:column;gap:1px;min-width:0;">
          <span style={`font-size:var(--text-base);font-weight:700;color:var(--text-primary);letter-spacing:0.01em;`}>
            Pharos
          </span>
        </div>
      </button>

      <div style="flex:1;" />

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
