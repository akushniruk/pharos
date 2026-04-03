import { createSignal } from 'solid-js';
import { Icon } from 'solid-heroicons';
import { magnifyingGlass } from 'solid-heroicons/solid';

export const [searchQuery, setSearchQuery] = createSignal('');

export default function SearchBar() {
  const [invalid, setInvalid] = createSignal(false);

  const onInput = (e: InputEvent) => {
    const val = (e.currentTarget as HTMLInputElement).value;
    try {
      if (val) new RegExp(val);
      setInvalid(false);
    } catch {
      setInvalid(true);
    }
    setSearchQuery(val);
  };

  const borderColor = () =>
    invalid() ? 'var(--red)' : 'var(--border)';

  return (
    <div style="position:relative;display:flex;align-items:center;">
      <Icon path={magnifyingGlass} style="width:14px;height:14px;position:absolute;left:8px;color:var(--text-dim);pointer-events:none;" />
      <input
        type="text"
        placeholder="Search events (regex)..."
        value={searchQuery()}
        onInput={onInput}
        style={[
          'height:32px;background:var(--bg-elevated);border-radius:6px;',
          'font-size:12px;padding:0 8px 0 28px;outline:none;color:var(--text-primary);',
          'font-family:var(--font-sans);width:220px;',
          `border:1px solid ${borderColor()};`,
          'transition:border-color 0.15s;',
        ].join('')}
        onFocus={(e) => {
          if (!invalid()) (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--accent)';
        }}
        onBlur={(e) => {
          (e.currentTarget as HTMLInputElement).style.borderColor = invalid() ? 'var(--red)' : 'var(--border)';
        }}
      />
    </div>
  );
}
