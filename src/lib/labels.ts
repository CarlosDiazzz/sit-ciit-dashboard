/* Traducción de los valores del contrato a texto en español.
 *
 * Viven fuera de los componentes para no romper el fast refresh de Vite
 * (un archivo que exporta componentes no debe exportar también funciones).
 */

import type { AnyEventKind, CargoCategory, Condition, UserRole, WeatherVariable } from '../api/types';

const EVENT_LABEL: Record<AnyEventKind, string> = {
  impact: 'Impacto',
  door_open: 'Puerta abierta',
  door_closed: 'Puerta cerrada',
  rollover: 'Posible volcadura',
  threshold_exceeded: 'Umbral excedido',
  source_failover: 'Cambio de fuente',
  sensor_disagreement: 'Discrepancia de sensores',
  weather_risk: 'Riesgo climático',
  signal_lost: 'Señal perdida',
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

const CARGO_CATEGORY_LABEL: Record<CargoCategory, string> = {
  agricola: 'Agrícola',
  construccion: 'Construcción',
  quimico: 'Químicos',
  sin_carga: 'Sin carga',
};

export function cargoCategoryLabel(category: CargoCategory): string {
  return CARGO_CATEGORY_LABEL[category] ?? category;
}

const USER_ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Administrador',
  technician: 'Técnico',
  auditor: 'Auditor',
  control_center: 'Centro de control',
  operator: 'Operador',
  cliente: 'Cliente',
};

export function userRoleLabel(role: UserRole): string {
  return USER_ROLE_LABEL[role] ?? role;
}

const VARIABLE_META: Record<WeatherVariable, { label: string; unit: string }> = {
  tempC: { label: 'Temperatura', unit: '°C' },
  humidityPct: { label: 'Humedad relativa', unit: '%' },
  precipMm: { label: 'Precipitación', unit: 'mm' },
};

const OP_SYMBOL: Record<Condition['op'], string> = {
  '>=': '≥',
  '<=': '≤',
  '>': '>',
  '<': '<',
};

/** Texto humano de las condiciones de una regla — "bajo qué valor" se
 *  evalúa, no solo el mensaje. Agrupa por variable: si hay un límite
 *  inferior y uno superior de la misma variable, los junta en un rango. */
export function formatConditions(conditions: Condition[]): string[] {
  const byVariable = new Map<WeatherVariable, Condition[]>();
  for (const c of conditions) {
    const list = byVariable.get(c.variable);
    if (list) list.push(c);
    else byVariable.set(c.variable, [c]);
  }

  return Array.from(byVariable.entries()).map(([variable, conds]) => {
    const meta = VARIABLE_META[variable];
    const lower = conds.find((c) => c.op === '>=' || c.op === '>');
    const upper = conds.find((c) => c.op === '<=' || c.op === '<');

    if (lower && upper) {
      return `${meta.label} entre ${lower.value}${meta.unit} y ${upper.value}${meta.unit}`;
    }
    const c = conds[0]!;
    return `${meta.label} ${OP_SYMBOL[c.op]} ${c.value}${meta.unit}`;
  });
}
