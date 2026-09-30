/* Orientación concreta para revisar un evento.
 *
 * `eventGuidance` da una frase por tipo, siempre la misma: para un
 * frenado dice "revisa la desaceleración registrada" sin decir que
 * fueron 0.32 g ni cuánto superó el umbral. Aquí se añade esa parte,
 * que es la que ahorra al operador ir a buscarla.
 *
 * Sigue siendo orientación humana: describe lo medido y qué contrastar,
 * nunca afirma qué ocurrió ni decide por nadie.
 */

import type { EventRecord } from '../api/types';
import { eventValueUnit } from './labels';

/** Cuánto superó el umbral, en veces. Null cuando falta alguno de los
 *  dos o el umbral es cero. */
function exceso(ev: EventRecord): number | null {
  if (ev.value === null || ev.threshold === null || ev.threshold === 0) return null;
  return ev.value / ev.threshold;
}

/**
 * Una frase con las cifras del evento, o null si no hay nada medido que
 * añadir (los eventos que genera el backend no traen valor).
 */
export function medicionResumida(ev: EventRecord): string | null {
  if (ev.value === null) return null;

  const unidad = eventValueUnit(ev.kind);
  const medido = `${ev.value.toFixed(2)}${unidad ? ` ${unidad}` : ''}`;

  const veces = exceso(ev);
  if (veces === null) return `Se midieron ${medido}.`;

  const umbral = `${ev.threshold!.toFixed(2)}${unidad ? ` ${unidad}` : ''}`;
  // Por debajo de 1.2× el evento roza el umbral y conviene decirlo: es
  // el caso donde una falsa alarma es más probable.
  if (veces < 1.2) {
    return `Se midieron ${medido}, apenas por encima del umbral de ${umbral}.`;
  }
  return `Se midieron ${medido}, ${veces.toFixed(1)}× el umbral de ${umbral}.`;
}

/** Dónde ocurrió, cuando el evento trae posición. */
export function ubicacionResumida(ev: EventRecord): string | null {
  if (ev.gpsLat === null || ev.gpsLon === null) return null;
  return `Ocurrió en ${ev.gpsLat.toFixed(4)}, ${ev.gpsLon.toFixed(4)}.`;
}

/** El retraso entre que ocurrió y llegó delata un tramo sin cobertura:
 *  el mensaje esperó en la cola del nodo. */
export function retrasoResumido(ev: EventRecord): string | null {
  const ms = new Date(ev.receivedAt).getTime() - new Date(ev.ts).getTime();
  if (!Number.isFinite(ms) || ms < 10_000) return null;
  const min = Math.round(ms / 60_000);
  return min < 1
    ? `Llegó ${Math.round(ms / 1000)} s después de ocurrir: el nodo estuvo sin señal.`
    : `Llegó ${min} min después de ocurrir: el nodo estuvo sin señal.`;
}
