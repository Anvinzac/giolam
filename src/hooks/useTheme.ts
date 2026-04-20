import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'giolam.theme';

function readStored(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === 'light' ? 'light' : 'dark';
}

/**
 * App-wide theme hook. Persists choice to localStorage and syncs the
 * `html.light` class that the global stylesheet keys off.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readStored);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') root.classList.add('light');
    else root.classList.remove('light');
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore quota / privacy-mode errors
    }
  }, [theme]);

  return {
    theme,
    isLight: theme === 'light',
    toggle: () => setTheme(t => (t === 'light' ? 'dark' : 'light')),
    setTheme,
  };
}
