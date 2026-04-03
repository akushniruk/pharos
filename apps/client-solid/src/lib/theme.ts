import { createSignal, createEffect } from 'solid-js';

export type Theme = 'dark' | 'light';
export const [theme, setTheme] = createSignal<Theme>('dark');

export function toggleTheme() {
  setTheme(t => t === 'dark' ? 'light' : 'dark');
}

export function initTheme() {
  const saved = localStorage.getItem('pharos-theme') as Theme | null;
  if (saved === 'light' || saved === 'dark') setTheme(saved);
  createEffect(() => {
    const t = theme();
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('pharos-theme', t);
  });
}
