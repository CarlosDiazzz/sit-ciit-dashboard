import english from './en.json';
import { getPreferences } from './preferences';
const messages: Record<string, string> = english;
const caseInsensitive = new Map(Object.entries(messages).map(([key, value]) => [key.toLocaleLowerCase('es'), value]));
const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
const patterns = Object.entries(messages).filter(([key]) => /\{\d+\}/.test(key)).map(([key, value]) => ({
  expression: new RegExp('^' + key.split(/(\{\d+\})/).map(part => /^\{\d+\}$/.test(part) ? '(.*?)' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('') + '$'), value,
}));
/** Translate display text only; IDs, form values and API payloads stay untouched. */
export function t<T>(value: T): T {
  if (getPreferences().language !== 'en' || typeof value !== 'string') return value;
  const key = normalize(value);
  let translated = messages[key] ?? caseInsensitive.get(key.toLocaleLowerCase('es'));
  if (translated && /^[a-záéíóúñ]/.test(key)) translated = translated[0].toLowerCase() + translated.slice(1);
  if (!translated) {
    for (const pattern of patterns) {
      const match = key.match(pattern.expression);
      if (match) { translated = pattern.value.replace(/\{(\d+)\}/g, (_, i: string) => String(t(match[Number(i) + 1]))); break; }
    }
  }
  if (!translated) return value;
  return (value.match(/^\s*/)?.[0] + translated + value.match(/\s*$/)?.[0]) as T;
}
export const locale = () => getPreferences().language === 'en' ? 'en-US' : 'es-MX';
