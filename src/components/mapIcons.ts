/* Iconos del mapa como divIcon de Leaflet.
 *
 * Se construyen con SVG inline en vez de imágenes: heredan los tokens
 * del tema, se rotan con CSS según el rumbo y no añaden peticiones.
 */

import { divIcon, type DivIcon } from 'leaflet';

import type { EventSeverity } from '../contract/contract';

/** Convoy visto desde arriba, apuntando al norte (0°). El marcador se
 *  rota luego según el rumbo real de la unidad.
 *
 *  Se dibuja la locomotora **con sus vagones enganchados**, y no una
 *  locomotora sola, porque eso es lo que distingue a un tren de un
 *  coche: vista desde arriba, una caja con cabina y ruedas a los lados
 *  es un automóvil. Lo que lee como "tren" es el tren en sí — varios
 *  cuerpos en fila unidos por enganches, más largo que ancho.
 *
 *  Por eso el icono es alto y estrecho (18×44) en vez de cuadrado: la
 *  proporción hace la mitad del trabajo antes de que se distinga un
 *  solo detalle. */
function svgTren(relleno: string, borde: string, id: string): string {
  // Cada instancia necesita ids propios: dos <defs> con el mismo id en
  // el documento hacen que todos los trenes hereden el degradado del
  // primero, y los respaldos saldrían del color del primario.
  const g = `t${id}`;

  // Los vagones van en tono apagado: la locomotora es la que lleva el
  // nodo y la que debe destacar, el resto es silueta.
  const vagon = `${borde}`;

  return `
    <svg viewBox="0 0 18 44" width="22" height="54" aria-hidden="true">
      <defs>
        <linearGradient id="${g}" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="${borde}" stop-opacity="0.38"/>
          <stop offset="40%" stop-color="${relleno}"/>
          <stop offset="60%" stop-color="${relleno}"/>
          <stop offset="100%" stop-color="${borde}" stop-opacity="0.38"/>
        </linearGradient>
      </defs>

      <!-- El convoy va de 1.4 a 37.8, cuyo centro (19.6) no es el del
           lienzo (22). Se desplaza para que el centro del dibujo caiga
           en el eje de giro: si no, el conjunto se descentra al rotar. -->
      <g transform="translate(0 2.4)">

      <!-- Enganches: las barras que unen los cuerpos. Sin ellas los
           vagones parecen cajas sueltas siguiendo a la máquina. -->
      <g stroke="${borde}" stroke-width="1.6" stroke-linecap="round" opacity="0.9">
        <path d="M9 18.6 L9 20.4"/>
        <path d="M9 28.4 L9 30.2"/>
      </g>

      <!-- Vagones de carga, decrecientes: el que va más atrás se lee
           como perspectiva y evita que el convoy parezca un bloque. -->
      <g fill="${vagon}" stroke="${borde}" stroke-width="1.2" stroke-linejoin="round">
        <rect x="3.6" y="20.2" width="10.8" height="8.4" rx="1.6" opacity="0.72"/>
        <rect x="4.2" y="30" width="9.6" height="7.8" rx="1.6" opacity="0.52"/>
      </g>

      <!-- Travesaños de los vagones: carga sujeta, no cajas lisas. -->
      <g stroke="${relleno}" stroke-width="0.85" opacity="0.5" stroke-linecap="round">
        <path d="M5.4 23 L12.6 23"/>
        <path d="M5.4 25.8 L12.6 25.8"/>
        <path d="M5.8 33.4 L12.2 33.4"/>
      </g>

      <!-- Locomotora: trompa achaflanada al frente, cuerpo hasta el
           primer enganche. -->
      <path
        d="M9 1.4 L14.4 6.6 L14.4 15.6 Q14.4 18.6 11.4 18.6
           L6.6 18.6 Q3.6 18.6 3.6 15.6 L3.6 6.6 Z"
        fill="url(#${g})" stroke="${borde}" stroke-width="1.4"
        stroke-linejoin="round"/>

      <!-- Cabina hacia el frente: orienta el icono aunque esté quieto. -->
      <rect x="5.2" y="8" width="7.6" height="5.4" rx="1.3"
            fill="${borde}" opacity="0.3"/>
      <path d="M6.2 9 L11.8 9 L11.1 11.8 L6.9 11.8 Z"
            fill="#e8f2fb" opacity="0.9"/>

      <!-- Faro delantero. -->
      <circle cx="9" cy="4.5" r="1.4" fill="#ffe9a8" stroke="${borde}"
              stroke-width="0.8"/>

      </g>
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
  // Id estable por combinación de estado, no aleatorio: el icono está
  // cacheado, así que el mismo estado debe producir el mismo HTML.
  const idGradiente = `${role}-${callada ? 'off' : 'on'}`;

  return divIcon({
    className: '',
    html: `
      <div class="unit-marker ${role === 'backup' ? 'unit-marker--backup ' : ''}${halo}">
        <div class="unit-marker__icon" style="transform: rotate(${giro}deg)">
          ${svgTren(relleno, borde, idGradiente)}
        </div>
        <span class="unit-marker__label">
          ${etiqueta}<b class="unit-marker__role">${role === 'primary' ? 'P' : 'B'}</b>
        </span>
        ${esFuente ? '<span class="unit-marker__source" title="Fuente activa"></span>' : ''}
      </div>`,
    iconSize: [22, 54],
    // El ancla coincide con el eje de giro del CSS (centro del convoy).
    // Los dos tienen que moverse juntos: Leaflet clava este punto en la
    // coordenada y el CSS gira alrededor del suyo, así que si difieren
    // el convoy se desplaza al rotar.
    iconAnchor: [11, 27],
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

/** Silueta de tren igual que iconoUnidad pero punteada y semitransparente
 *  — se lee como "esto es un cálculo, no una posición real medida". */
function svgTrenEstimado(color: string): string {
  return `
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path
        d="M12 1.5 L18 7 L18 19 Q18 22 15 22 L9 22 Q6 22 6 19 L6 7 Z"
        fill="none" stroke="${color}" stroke-width="1.8" stroke-dasharray="3,2" stroke-linejoin="round"/>
    </svg>`;
}

const cacheEstimado = new Map<string, DivIcon>();

/** Posición estimada de un nodo sin señal, proyectada sobre la ruta real
 *  a partir de su última velocidad real conocida — nunca se confunde
 *  visualmente con iconoUnidad (posición medida) por ser punteado y
 *  semitransparente. */
export function iconoEstimado(rumbo: number | null): DivIcon {
  const clave = rumbo === null ? 'x' : Math.round(rumbo / 5) * 5;
  const guardado = cacheEstimado.get(clave.toString());
  if (guardado) return guardado;

  const color = '#6e7681';
  const giro = rumbo ?? 0;
  const creado = divIcon({
    className: '',
    html: `<div class="estimated-marker" style="transform: rotate(${giro}deg)">${svgTrenEstimado(color)}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
  cacheEstimado.set(clave.toString(), creado);
  return creado;
}

/** Antena real (OpenCelliD) — un punto simple, no compite visualmente
 *  con nada que reporte un evento o una unidad real. La posición de la
 *  antena siempre es real; lo que puede ser supuesto es su rango (se
 *  marca aparte, en el texto del ETA, no en este ícono). */
let cacheAntena: DivIcon | null = null;

export function iconoAntena(): DivIcon {
  if (cacheAntena) return cacheAntena;
  cacheAntena = divIcon({
    className: '',
    html: `<span class="antenna-marker"></span>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });
  return cacheAntena;
}
