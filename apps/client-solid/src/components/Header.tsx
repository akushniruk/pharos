import { createMemo } from 'solid-js';
import { Icon } from 'solid-heroicons';
import { sun, moon } from 'solid-heroicons/solid';
import { filteredEvents } from '../lib/store';
import { createMetrics } from '../lib/metrics';
import { theme, toggleTheme } from '../lib/theme';
import PharosMark from './PharosMark';

export default function Header() {
  const metrics = createMetrics(filteredEvents);
  const { agentCount, primaryModel, toolSuccessRate, eventsPerMinute, sessionDuration, healthStatus } = metrics;

  const healthColor = createMemo(() => {
    const s = healthStatus();
    if (s === 'green') return 'var(--green)';
    if (s === 'yellow') return 'var(--yellow)';
    return 'var(--red)';
  });

  const successRateColor = createMemo(() => {
    const rate = toolSuccessRate();
    if (rate > 90) return 'var(--green)';
    if (rate > 75) return 'var(--yellow)';
    return 'var(--red)';
  });

  const statStyle = 'font-size:11px;font-weight:500;color:var(--text-secondary);';
  const sepStyle = 'font-size:11px;color:var(--text-dim);margin:0 6px;';

  return (
    <header class="app-header">
      {/* Left: Brand */}
      <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;min-width:0;">
        <div class="pharos-mark-shell">
          <PharosMark size={18} class="pharos-mark" />
        </div>
        <div style="display:flex;flex-direction:column;gap:1px;min-width:0;">
          <span style="font-size:13px;font-weight:700;color:var(--text-primary);letter-spacing:0.01em;">
            Pharos
          </span>
          <span style="font-size:9px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.08em;">
            Agent Monitor
          </span>
        </div>
      </div>

      {/* Center: Live metrics strip */}
      <div style="display:flex;align-items:center;gap:0;flex:1;justify-content:center;overflow:hidden;">
        {/* Health dot */}
        <span style={`width:6px;height:6px;border-radius:50%;background:${healthColor()};display:inline-block;margin-right:8px;flex-shrink:0;`} />

        {/* Agent count */}
        <span style={statStyle}>{agentCount()} {agentCount() === 1 ? 'agent' : 'agents'}</span>

        <span style={sepStyle}>|</span>

        {/* Primary model */}
        <span style={statStyle + 'font-family:var(--font-mono);font-size:10px;'}>
          {primaryModel() || '—'}
        </span>

        <span style={sepStyle}>|</span>

        {/* Tool success rate */}
        <span style={`font-size:11px;font-weight:500;color:${successRateColor()};`}>
          {toolSuccessRate()}% ok
        </span>

        <span style={sepStyle}>|</span>

        {/* Events per minute */}
        <span style={statStyle}>{eventsPerMinute()} evt/min</span>

        <span style={sepStyle}>|</span>

        {/* Session duration */}
        <span style={statStyle + 'font-family:var(--font-mono);font-size:10px;'}>
          {sessionDuration()}
        </span>
      </div>

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
