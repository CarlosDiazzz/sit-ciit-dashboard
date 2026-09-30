import { useSyncExternalStore } from 'react';
import { usePreferences } from './preferences';
const media = window.matchMedia('(prefers-reduced-motion: reduce)');
const subscribe = (callback: () => void) => { media.addEventListener('change', callback); return () => media.removeEventListener('change', callback); };
export function useReducedMotion() {
  const { reducedMotion } = usePreferences();
  const system = useSyncExternalStore(subscribe, () => media.matches);
  return reducedMotion || system;
}
