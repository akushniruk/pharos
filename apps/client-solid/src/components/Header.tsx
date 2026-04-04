import { Icon } from 'solid-heroicons';
import { sun, moon } from 'solid-heroicons/solid';
import { theme, toggleTheme } from '../lib/theme';
import PharosMark from './PharosMark';

interface HeaderProps {
  isDocsRoute?: boolean;
  onNavigateHome?: () => void;
  onNavigateDocs?: () => void;
}

export default function Header(props: HeaderProps) {
  const navButtonStyle = (active: boolean) => [
    'background:none;border:1px solid var(--border);border-radius:6px;',
    'padding:4px 10px;cursor:pointer;font-size:12px;font-weight:600;',
    'color:var(--text-secondary);display:flex;align-items:center;gap:6px;',
    'transition:border-color 0.15s,color 0.15s,background 0.15s;flex-shrink:0;',
    active ? 'border-color:var(--accent);color:var(--text-primary);background:var(--bg-card);' : '',
  ].join('');

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
          <span style="font-size:13px;font-weight:700;color:var(--text-primary);letter-spacing:0.01em;">
            Pharos
          </span>
        </div>
      </button>

      <div style="flex:1;" />
      <button
        type="button"
        onClick={() => props.onNavigateHome?.()}
        title="Go to root overview"
        style={navButtonStyle(!props.isDocsRoute)}
      >
        Home
      </button>
      <button
        type="button"
        onClick={() => props.onNavigateDocs?.()}
        title="Open guide portal"
        style={navButtonStyle(Boolean(props.isDocsRoute))}
      >
        Guide
      </button>

      {/* Right: Theme toggle */}
      <button
        onClick={toggleTheme}
        title={theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        style={[
          'background:none;border:1px solid var(--border);border-radius:6px;',
          'padding:4px 8px;cursor:pointer;font-size:14px;',
          'color:var(--text-secondary);display:flex;align-items:center;',
          'transition:border-color 0.15s,color 0.15s;flex-shrink:0;',
        ].join('')}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-hover)';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
        }}
      >
        <Icon path={theme() === 'dark' ? sun : moon} style="width:16px;height:16px" />
      </button>
    </header>
  );
}
