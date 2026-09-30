import type { AnyEventKind, EventRecord } from '../api/types';

const severityOrder = { critical: 0, warning: 1, info: 2 };
export function prioritizeEvents(events: EventRecord[]): EventRecord[] {
  return [...events].sort((a, b) => Number(Boolean(a.acknowledgedAt)) - Number(Boolean(b.acknowledgedAt))
    || severityOrder[a.severity] - severityOrder[b.severity]
    || new Date(b.ts).getTime() - new Date(a.ts).getTime());
}

export const eventGuidance: Record<AnyEventKind, string> = {
  hard_brake: 'Revisa la desaceleración registrada y verifica con el operador el contexto del frenado y el estado de la carga.',
  curve_overspeed: 'Contrasta la aceleración lateral con la ubicación y solicita revisión del contexto de la curva.',
  dynamic_impact: 'Revisa el pico de fuerza y verifica con el operador posibles desplazamientos de la carga.',
  track_irregularity: 'Revisa la vibración registrada y su ubicación antes de reportar una posible irregularidad de vía.',
  impact: 'Contrasta el pico con la aceleración de la unidad y solicita al operador verificar el estado de la carga.',
  door_open: 'Verifica con el operador si la apertura corresponde a una maniobra autorizada.',
  door_closed: 'Contrasta el cierre con el evento de apertura y el contexto de la maniobra.',
  rollover: 'Solicita verificación inmediata al operador. Contrasta la rotación con la aceleración, la orientación y la posición de la unidad; aplica el protocolo de tu organización ante una sospecha de volcadura o descarrilamiento.',
  threshold_exceeded: 'Revisa la lectura y el umbral configurado antes de decidir un ajuste.',
  source_failover: 'Revisa la conectividad del nodo principal y verifica las lecturas de la fuente de respaldo.',
  sensor_disagreement: 'Compara ambos nodos y comprueba su instalación antes de confiar en una sola lectura.',
  weather_risk: 'Contrasta el clima reportado, la ubicación y la regla de riesgo aplicable antes de definir medidas para la carga.',
  signal_recovered: 'Verifica la recepción de nuevas muestras y la sincronización de la cola pendiente.',
  signal_lost: 'Verifica con el operador la última posición registrada y confirma si el nodo sigue en tránsito o requiere revisión.',
};
