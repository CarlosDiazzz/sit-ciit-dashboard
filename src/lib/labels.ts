/* Traducción de los valores del contrato a texto en español.
 *
 * Viven fuera de los componentes para no romper el fast refresh de Vite
 * (un archivo que exporta componentes no debe exportar también funciones).
 */

import type { AnyEventKind } from '../api/types';

const EVENT_LABEL: Record<AnyEventKind, string> = {
  impact: 'Impacto',
  door_open: 'Puerta abierta',
  door_closed: 'Puerta cerrada',
  rollover: 'Volcadura',
  threshold_exceeded: 'Umbral excedido',
  source_failover: 'Cambio de fuente',
  sensor_disagreement: 'Discrepancia de sensores',
  // Dinámica de marcha (contrato v1.2.0): miden las fuerzas del
  // movimiento del tren, que son las que dañan la carga.
  hard_brake: 'Frenado brusco',
  curve_overspeed: 'Exceso en curva',
  dynamic_impact: 'Golpe dinámico',
  track_irregularity: 'Irregularidad de vía',
};

/** Unidad de `value` según el evento: los cuatro de dinámica reusan ese
 *  campo con significados distintos (ver contract.ts). */
const EVENT_UNIT: Partial<Record<AnyEventKind, string>> = {
  impact: 'g',
  hard_brake: 'g',
  curve_overspeed: 'g',
  dynamic_impact: 'g',
  track_irregularity: 'g',
};

export function eventValueUnit(kind: AnyEventKind): string {
  return EVENT_UNIT[kind] ?? '';
}

export function eventKindLabel(kind: AnyEventKind): string {
  return EVENT_LABEL[kind] ?? kind;
}
