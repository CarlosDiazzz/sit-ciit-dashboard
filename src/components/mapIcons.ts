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
}

const COLOR_ALERTA: Record<EventSeverity, string> = {
  info: '#55bde9',
  warning: '#f39a48',
  critical: '#d55f5c',
};

export function iconoUnidad({ rumbo, callada, alerta, etiqueta }: IconoUnidadOpts): DivIcon {
  const relleno = callada ? '#6e7681' : '#49c79c';
  const borde = '#0b0e0d';
  // Sin rumbo conocido el icono se deja al norte en vez de girar a un
  // valor inventado; la unidad está ahí, solo no se sabe hacia dónde va.
  const giro = rumbo ?? 0;
  const halo = alerta ? `unit-marker--alert" style="--halo:${COLOR_ALERTA[alerta]}` : '';

  return divIcon({
    className: '',
    html: `
      <div class="unit-marker ${halo}">
        <div class="unit-marker__icon" style="transform: rotate(${giro}deg)">
          ${svgTren(relleno, borde)}
        </div>
        <span class="unit-marker__label">${etiqueta}</span>
      </div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

/** Marca de evento: un anillo que late si es crítico. */
export function iconoEvento(severidad: EventSeverity, critico: boolean): DivIcon {
  const color = COLOR_ALERTA[severidad];
  return divIcon({
    className: '',
    html: `<span class="event-marker${critico ? ' event-marker--pulse' : ''}" style="--ev:${color}"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}
