import { useSyncExternalStore } from 'react';

export interface Preferences {
  language: 'es' | 'en';
  highContrast: boolean;
  largeText: boolean;
  reducedMotion: boolean;
}
const key = 'zentra.accessibility';
export const defaults: Preferences = { language: 'es', highContrast: false, largeText: false, reducedMotion: false };
function read(): Preferences {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '{}');
    return { language: value.language === 'en' ? 'en' : 'es', highContrast: value.highContrast === true, largeText: value.largeText === true, reducedMotion: value.reducedMotion === true };
  } catch { return { ...defaults }; }
}
let preferences = read();
const listeners = new Set<() => void>();
export const getPreferences = () => preferences;
function apply() {
  const root = document.documentElement;
  root.lang = preferences.language;
  root.dataset.highContrast = String(preferences.highContrast);
  root.dataset.largeText = String(preferences.largeText);
  root.dataset.reducedMotion = String(preferences.reducedMotion);
}
export function setPreferences(change: Partial<Preferences>) {
  preferences = { ...preferences, ...change };
  try { localStorage.setItem(key, JSON.stringify(preferences)); } catch { /* Session preferences still work. */ }
  apply();
  listeners.forEach(listener => listener());
}
export function usePreferences() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, getPreferences);
}
apply();
window.addEventListener('storage', event => {
  if (event.key === key || event.key === null) {
    preferences = read(); apply(); listeners.forEach(listener => listener());
  }
});
