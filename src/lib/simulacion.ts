/* Simulación del corredor para la demo.
 *
 * Existe porque hay cosas que no se pueden enseñar con dos celulares en
 * una sala: varios trenes recorriendo la Línea Z, alertas apareciendo a
 * lo largo de 300 km, y defectos de vía que solo se confirman cuando
 * pasan unidades distintas por el mismo punto.
 *
 * Es deliberadamente visible: se activa con un botón, la interfaz avisa
 * mientras está encendida y nada de esto toca el backend ni la base.
 * Los datos simulados viven solo en memoria del navegador y desaparecen
 * al apagarlo o recargar.
 *
 * No sustituye a la telemetría real: cuando hay un nodo publicando, sus
 * datos siguen llegando por Socket.IO y se pintan igual.
 */

import type { AnyEventKind, TrackDefect } from '../api/types';
import type { EventSeverity } from '../contract/contract';

export interface TrenSimulado {
  nodeId: string;
  unitId: string;
  /** Posición a lo largo de la ruta, de 0 a 1. */
  avance: number;
  /** Fracción de ruta por segundo. Un tren de carga va a ~60 km/h y la
   *  Línea Z mide ~300 km, así que cruzarla entera lleva unas 5 h: se
   *  acelera para que en la demo se vea moverse. */
  velocidad: number;
  lat: number;
  lon: number;
  rumbo: number | null;
  /** km/h que se muestran, coherentes con la velocidad de avance. */
  speedKmh: number;
  sentido: 1 | -1;
}

export interface AlertaSimulada {
  id: string;
  kind: AnyEventKind;
  severity: EventSeverity;
  value: number;
  lat: number;
  lon: number;
  ts: number;
  nodeId: string;
}

/** Puntos del corredor donde la simulación dispara alertas, como
 *  fracción de la ruta. No son aleatorios: representan lo que un
 *  corredor real tiene — juntas de riel, una curva cerrada, un tramo en
 *  mal estado. */
const PUNTOS_CALIENTES: {
  avance: number;
  kind: AnyEventKind;
  severity: EventSeverity;
  valor: number;
  etiqueta: string;
}[] = [
  { avance: 0.18, kind: 'track_irregularity', severity: 'warning', valor: 0.34, etiqueta: 'Tramo con asentamiento' },
  { avance: 0.37, kind: 'curve_overspeed', severity: 'warning', valor: 0.19, etiqueta: 'Curva de Medias Aguas' },
  { avance: 0.52, kind: 'track_irregularity', severity: 'info', valor: 0.21, etiqueta: 'Junta de riel' },
  { avance: 0.71, kind: 'hard_brake', severity: 'critical', valor: 0.31, etiqueta: 'Frenado en aproximación' },
  { avance: 0.86, kind: 'dynamic_impact', severity: 'warning', valor: 1.9, etiqueta: 'Golpe vertical' },
];

/** Margen para considerar que un tren pasó por un punto caliente. */
const MARGEN_DISPARO = 0.006;

export interface EstadoSimulacion {
  trenes: TrenSimulado[];
  alertas: AlertaSimulada[];
  defectos: TrackDefect[];
  /** Puntos ya disparados por cada tren, para no repetir la alerta
   *  mientras sigue dentro del margen. */
  disparados: Set<string>;
}

/** Posición sobre la ruta para un avance dado, interpolando entre los
 *  vértices del trazado real. Así los trenes van por la vía y no en
 *  línea recta entre extremos. */
export function puntoEnRuta(
  ruta: [number, number][],
  avance: number,
): { lat: number; lon: number; rumbo: number | null } {
  if (ruta.length === 0) return { lat: 0, lon: 0, rumbo: null };
  if (ruta.length === 1) return { lat: ruta[0]![0], lon: ruta[0]![1], rumbo: null };

  const t = Math.min(0.999999, Math.max(0, avance));
  const pos = t * (ruta.length - 1);
  const i = Math.floor(pos);
  const frac = pos - i;

  const a = ruta[i]!;
  const b = ruta[Math.min(i + 1, ruta.length - 1)]!;

  const lat = a[0] + (b[0] - a[0]) * frac;
  const lon = a[1] + (b[1] - a[1]) * frac;

  // Rumbo desde el segmento actual: el icono del tren apunta hacia
  // donde avanza, igual que con un nodo real.
  const dLat = b[0] - a[0];
  const dLon = (b[1] - a[1]) * Math.cos((a[0] * Math.PI) / 180);
  const rumbo =
    dLat === 0 && dLon === 0 ? null : (Math.atan2(dLon, dLat) * 180) / Math.PI;

  return { lat, lon, rumbo };
}

/** Arranca la simulación con tres trenes repartidos por el corredor,
 *  dos en un sentido y uno en el contrario. */
export function iniciarSimulacion(ruta: [number, number][]): EstadoSimulacion {
  const config: { nodeId: string; unitId: string; avance: number; sentido: 1 | -1; kmh: number }[] = [
    { nodeId: 'sim-carga-01', unitId: 'SIM · Carga 01', avance: 0.08, sentido: 1, kmh: 62 },
    { nodeId: 'sim-carga-02', unitId: 'SIM · Carga 02', avance: 0.44, sentido: 1, kmh: 48 },
    { nodeId: 'sim-carga-03', unitId: 'SIM · Carga 03', avance: 0.78, sentido: -1, kmh: 55 },
  ];

  return {
    trenes: config.map((c) => {
      const p = puntoEnRuta(ruta, c.avance);
      return {
        nodeId: c.nodeId,
        unitId: c.unitId,
        avance: c.avance,
        // Velocidad de avance escalada: la ruta completa en ~4 min de
        // demo en vez de las 5 h que tardaría de verdad.
        velocidad: (c.kmh / 60) * 0.00009,
        lat: p.lat,
        lon: p.lon,
        rumbo: c.sentido === 1 ? p.rumbo : p.rumbo === null ? null : p.rumbo + 180,
        speedKmh: c.kmh,
        sentido: c.sentido,
      };
    }),
    alertas: [],
    defectos: [],
    disparados: new Set(),
  };
}

let contadorAlertas = 0;

/**
 * Avanza la simulación un paso.
 *
 * Devuelve un estado nuevo: los trenes se mueven, disparan alertas al
 * pasar por los puntos calientes, y un punto se convierte en defecto
 * confirmado cuando lo han cruzado unidades distintas — la misma regla
 * que aplica el backend con datos reales.
 */
export function avanzarSimulacion(
  estado: EstadoSimulacion,
  ruta: [number, number][],
  dtSegundos: number,
): EstadoSimulacion {
  if (ruta.length < 2) return estado;

  const alertasNuevas: AlertaSimulada[] = [];
  const disparados = new Set(estado.disparados);

  const trenes = estado.trenes.map((tr) => {
    let avance = tr.avance + tr.velocidad * dtSegundos * tr.sentido * 60;

    // Al llegar a un extremo, el tren da la vuelta: la demo no se queda
    // sin trenes a los cuatro minutos.
    let sentido = tr.sentido;
    if (avance >= 1) {
      avance = 1;
      sentido = -1;
    } else if (avance <= 0) {
      avance = 0;
      sentido = 1;
    }

    const p = puntoEnRuta(ruta, avance);

    for (const punto of PUNTOS_CALIENTES) {
      const clave = `${tr.nodeId}|${punto.avance}|${sentido}`;
      const cerca = Math.abs(avance - punto.avance) < MARGEN_DISPARO;

      if (cerca && !disparados.has(clave)) {
        disparados.add(clave);
        contadorAlertas += 1;
        const pp = puntoEnRuta(ruta, punto.avance);
        alertasNuevas.push({
          id: `sim-${contadorAlertas}`,
          kind: punto.kind,
          severity: punto.severity,
          // Pequeña variación entre trenes: dos unidades no miden
          // exactamente lo mismo sobre el mismo defecto.
          value: punto.valor * (0.88 + Math.random() * 0.24),
          lat: pp.lat,
          lon: pp.lon,
          ts: Date.now(),
          nodeId: tr.nodeId,
        });
      }

      // Al alejarse se libera para que el siguiente paso vuelva a
      // disparar: es otra pasada.
      if (!cerca && Math.abs(avance - punto.avance) > MARGEN_DISPARO * 4) {
        disparados.delete(clave);
      }
    }

    return {
      ...tr,
      avance,
      sentido,
      lat: p.lat,
      lon: p.lon,
      rumbo: sentido === 1 ? p.rumbo : p.rumbo === null ? null : p.rumbo + 180,
    };
  });

  const alertas = [...alertasNuevas, ...estado.alertas].slice(0, 60);

  return {
    trenes,
    alertas,
    defectos: recalcularDefectos(alertas, ruta),
    disparados,
  };
}

/** Agrupa las alertas simuladas por punto caliente y les asigna nivel
 *  de confianza con el mismo criterio del backend: lo que confirma un
 *  defecto es que lo vean unidades distintas, no cuántas veces se vea. */
function recalcularDefectos(
  alertas: AlertaSimulada[],
  ruta: [number, number][],
): TrackDefect[] {
  return PUNTOS_CALIENTES.map((punto): TrackDefect | null => {
    const p = puntoEnRuta(ruta, punto.avance);
    const suyas = alertas.filter(
      (a) => a.kind === punto.kind && Math.abs(a.lat - p.lat) < 0.01 && Math.abs(a.lon - p.lon) < 0.01,
    );
    if (suyas.length === 0) return null;

    const unidades = new Set(suyas.map((a) => a.nodeId)).size;
    const valores = suyas.map((a) => a.value);
    const tiempos = suyas.map((a) => a.ts);

    const confianza =
      unidades >= 3 ? 'confirmado' : unidades === 2 ? 'probable' : 'indicio';
    const motivo =
      unidades >= 3
        ? `${unidades} unidades distintas detectaron lo mismo en este punto.`
        : unidades === 2
          ? 'Dos unidades distintas lo detectaron; falta una tercera para confirmarlo.'
          : 'Una sola detección: puede ser de la vía o del vehículo.';

    return {
      lat: p.lat,
      lon: p.lon,
      radiusM: 40,
      kind: punto.kind,
      confidence: confianza,
      reason: motivo,
      distinctUnits: unidades,
      distinctNodes: unidades,
      passes: suyas.length,
      detections: suyas.length,
      averageValue: valores.reduce((a, b) => a + b, 0) / valores.length,
      firstSeen: new Date(Math.min(...tiempos)).toISOString(),
      lastSeen: new Date(Math.max(...tiempos)).toISOString(),
      eventIds: suyas.map((a) => a.id),
    };
  }).filter((d): d is TrackDefect => d !== null);
}

/** Nombre del punto caliente más cercano, para la ficha de la alerta. */
export function etiquetaPunto(avance: number): string | null {
  const p = PUNTOS_CALIENTES.find((x) => Math.abs(x.avance - avance) < 0.02);
  return p?.etiqueta ?? null;
}
