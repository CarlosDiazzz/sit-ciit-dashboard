/* Formato de fechas y magnitudes, en un solo lugar para que todas las
 * vistas muestren lo mismo de la misma forma. */

const DATE_TIME = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const TIME = new Intl.DateTimeFormat('es-MX', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : DATE_TIME.format(d);
}

export function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : TIME.format(d);
}

/** "hace 3 s" / "hace 5 min". Para el último heartbeat, donde importa la
 *  antigüedad y no la hora exacta. */
export function formatAgo(iso: string | null): string {
  if (!iso) return 'nunca';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return '—';
  if (ms < 1000) return 'ahora';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `hace ${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

export function formatNumber(n: number | null, digits = 2): string {
  return n === null || !Number.isFinite(n) ? '—' : n.toFixed(digits);
}

/** Velocidad en m/s a km/h, que es como se lee una unidad en carretera. */
export function formatSpeed(speedMs: number | null): string {
  if (speedMs === null || !Number.isFinite(speedMs)) return '—';
  return `${(speedMs * 3.6).toFixed(1)} km/h`;
}
