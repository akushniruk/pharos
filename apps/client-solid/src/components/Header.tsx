import { Icon } from 'solid-heroicons';
import { sun, moon, questionMarkCircle } from 'solid-heroicons/solid';
import { helpVisible, toggleHelpVisible } from '../lib/store';
import { theme, toggleTheme } from '../lib/theme';
import PharosMark from './PharosMark';

export default function Header() {
  return (
    <header class="app-header">
      {/* Left: Brand */}
      <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;min-width:0;">
        <PharosMark size={18} class="pharos-mark" />
        <div style="display:flex;flex-direction:column;gap:1px;min-width:0;">
          <span style="font-size:13px;font-weight:700;color:var(--text-primary);letter-spacing:0.01em;">
            Pharos
          </span>
        </div>
      </div>

      <div style="flex:1;" />

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
      <button
        onClick={toggleHelpVisible}
        title={helpVisible() ? 'Hide the guide' : 'Show the guide'}
        aria-pressed={helpVisible()}
        style={[
          'background:none;border:1px solid var(--border);border-radius:6px;',
          'padding:4px 8px;cursor:pointer;font-size:12px;font-weight:600;',
          'color:var(--text-secondary);display:flex;align-items:center;gap:6px;',
          'transition:border-color 0.15s,color 0.15s,background 0.15s;flex-shrink:0;',
          helpVisible() ? 'border-color:var(--accent);color:var(--text-primary);background:var(--bg-card);' : '',
        ].join('')}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-hover)';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
        }}
        onMouseLeave={(e) => {
          const target = e.currentTarget as HTMLButtonElement;
          target.style.borderColor = helpVisible() ? 'var(--accent)' : 'var(--border)';
          target.style.color = helpVisible() ? 'var(--text-primary)' : 'var(--text-secondary)';
        }}
      >
        <Icon path={questionMarkCircle} style="width:14px;height:14px" />
        <span>Guide</span>
      </button>
    </header>
  );
}
