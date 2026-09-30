import { useEffect, useState } from 'react';

export type ColorMode = 'light' | 'dark';

const STORAGE_KEY = 'zenda.color-mode';
const CHANGE_EVENT = 'zenda:color-mode';

function initialMode(): ColorMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // El tablero sigue funcionando aunque el navegador bloquee storage.
  }
  return 'light';
}

export function useColorMode() {
  const [mode, setMode] = useState<ColorMode>(initialMode);

  useEffect(() => {
    document.documentElement.dataset.colorMode = mode;
    document.documentElement.style.colorScheme = mode;
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // La preferencia queda activa durante la sesión actual.
    }
  }, [mode]);

  useEffect(() => {
    const syncMode = (event: Event) => {
      const next = (event as CustomEvent<ColorMode>).detail;
      if (next === 'light' || next === 'dark') setMode(next);
    };
    window.addEventListener(CHANGE_EVENT, syncMode);
    return () => window.removeEventListener(CHANGE_EVENT, syncMode);
  }, []);

  return {
    mode,
    toggle: () => {
      const next = mode === 'light' ? 'dark' : 'light';
      setMode(next);
      window.dispatchEvent(new CustomEvent<ColorMode>(CHANGE_EVENT, { detail: next }));
    },
  };
}
