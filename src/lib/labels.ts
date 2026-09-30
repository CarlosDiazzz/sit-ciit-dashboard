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
  rollover: 'Posible volcadura',
  threshold_exceeded: 'Umbral excedido',
  source_failover: 'Cambio de fuente',
  sensor_disagreement: 'Discrepancia de sensores',
};

export function eventKindLabel(kind: AnyEventKind): string {
  return EVENT_LABEL[kind] ?? kind;
}

