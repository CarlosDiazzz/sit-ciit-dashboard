/* Iconos del mapa como divIcon de Leaflet.
 *
 * Se construyen con SVG inline en vez de imágenes: heredan los tokens
 * del tema, se rotan con CSS según el rumbo y no añaden peticiones.
 */

import { divIcon, type DivIcon } from 'leaflet';

import type { EventSeverity } from '../contract/contract';

/** Silueta de locomotora vista desde arriba, apuntando al norte (0°).
 *  El marcador se rota luego según el rumbo real de la unidad. */
function svgTren(relleno: string, borde: string): string {
  return `
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <path
        d="M12 1.5 L18 7 L18 19 Q18 22 15 22 L9 22 Q6 22 6 19 L6 7 Z"
        fill="${relleno}" stroke="${borde}" stroke-width="1.6" stroke-linejoin="round"/>
      <rect x="8.6" y="8.4" width="6.8" height="4.6" rx="1" fill="${borde}" opacity="0.5"/>
      <circle cx="12" cy="17.6" r="1.5" fill="${borde}" opacity="0.7"/>
    </svg>`;
}

export interface IconoUnidadOpts {
  /** Rumbo en grados, 0 = norte. null cuando aún no se puede calcular. */
  rumbo: number | null;
  /** Nodo sin datos recientes: se dibuja apagado. */
  callada: boolean;
  /** Severidad del último evento de la unidad, para el halo. */
  alerta: EventSeverity | null;
  etiqueta: string;
  /** Primary y backup van en el mismo camión: sin distinguirlos, dos
   *  marcadores idénticos se superponen y no se sabe cuál es cuál. */
  role: 'primary' | 'backup';
  /** El nodo que la unidad está usando ahora como fuente de datos. */
  esFuente: boolean;
}

const COLOR_ALERTA: Record<EventSeverity, string> = {
  info: '#55bde9',
  warning: '#f39a48',
  critical: '#d55f5c',
};

/** Iconos ya construidos, por combinacion de estado.
 *
 * Un divIcon lleva su HTML dentro, asi que crearlo en cada cuadro obliga
 * a Leaflet a remontar el marcador entero. Lo que cambia siempre es la
 * posicion, que Leaflet mueve sin tocar el icono; el icono en si solo
 * depende de rumbo, estado y rol, que cambian poco. */
const cacheUnidad = new Map<string, DivIcon>();

/** El rumbo se redondea a 5 grados: un giro menor no se distingue en un
 *  icono de 26 px y forzaria reconstruirlo por nada. */
function claveUnidad(o: IconoUnidadOpts): string {
  const r = o.rumbo === null ? 'x' : Math.round(o.rumbo / 5) * 5;
  return `${r}|${o.callada}|${o.alerta ?? '-'}|${o.etiqueta}|${o.role}|${o.esFuente}`;
}

export function iconoUnidad(opts: IconoUnidadOpts): DivIcon {
  const clave = claveUnidad(opts);
  const guardado = cacheUnidad.get(clave);
  if (guardado) return guardado;
  const creado = construirIconoUnidad(opts);
  // Tope defensivo: con muchas unidades y rumbos variados el mapa no
  // debe crecer sin limite.
  if (cacheUnidad.size > 400) cacheUnidad.clear();
  cacheUnidad.set(clave, creado);
  return creado;
}

function construirIconoUnidad({
  rumbo,
  callada,
  alerta,
  etiqueta,
  role,
  esFuente,
}: IconoUnidadOpts): DivIcon {
  // El respaldo va en tono frío y algo más pequeño: se ve que está ahí
  // sin competir con el nodo que realmente está reportando.
  const relleno = callada ? '#6e7681' : role === 'primary' ? '#49c79c' : '#55bde9';
  const borde = '#0b0e0d';
  // Sin rumbo conocido el icono se deja al norte en vez de girar a un
  // valor inventado; la unidad está ahí, solo no se sabe hacia dónde va.
  const giro = rumbo ?? 0;
  const halo = alerta ? `unit-marker--alert" style="--halo:${COLOR_ALERTA[alerta]}` : '';

  return divIcon({
    className: '',
    html: `
      <div class="unit-marker ${role === 'backup' ? 'unit-marker--backup ' : ''}${halo}">
        <div class="unit-marker__icon" style="transform: rotate(${giro}deg)">
          ${svgTren(relleno, borde)}
        </div>
        <span class="unit-marker__label">
          ${etiqueta}<b class="unit-marker__role">${role === 'primary' ? 'P' : 'B'}</b>
        </span>
        ${esFuente ? '<span class="unit-marker__source" title="Fuente activa"></span>' : ''}
      </div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

/** Antena con una línea encima: se lee como "sin señal" a primera
 *  vista, para no confundirse con un impacto o una puerta (que usan el
 *  mismo punto pulsante de iconoEvento). */
function svgSenalPerdida(color: string): string {
  return `
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M12 20 L12 11" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
      <path d="M8 11 Q12 7 16 11" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.55"/>
      <path d="M5 8 Q12 1 19 8" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.3"/>
      <circle cx="12" cy="21" r="1.6" fill="${color}"/>
      <path d="M3 3 L21 21" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>
    </svg>`;
}

const cacheSenalPerdida = new Map<string, DivIcon>();

/** Marca de "se quedó sin señal aquí" — dónde y, con el popup, cuándo.
 *  A diferencia de iconoEvento no pulsa: no es una alerta que necesite
 *  atención inmediata, es un hecho ya pasado. */
export function iconoSenalPerdida(severidad: EventSeverity = 'warning'): DivIcon {
  const clave = severidad;
  const guardado = cacheSenalPerdida.get(clave);
  if (guardado) return guardado;

  const color = COLOR_ALERTA[severidad];
  const creado = divIcon({
    className: '',
    html: `<span class="signal-lost-marker" style="--ev:${color}">${svgSenalPerdida(color)}</span>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
  cacheSenalPerdida.set(clave, creado);
  return creado;
}

/** Marca de evento: un anillo que late si es crítico. */
const cacheEvento = new Map<string, DivIcon>();

export function iconoEvento(severidad: EventSeverity, critico: boolean): DivIcon {
  const clave = `${severidad}|${critico}`;
  const guardado = cacheEvento.get(clave);
  if (guardado) return guardado;

  const color = COLOR_ALERTA[severidad];
  const creado = divIcon({
    className: '',
    html: `<span class="event-marker${critico ? ' event-marker--pulse' : ''}" style="--ev:${color}"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
  cacheEvento.set(clave, creado);
  return creado;
}
