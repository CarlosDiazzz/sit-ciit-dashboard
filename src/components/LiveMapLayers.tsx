/* Capas en vivo del mapa: dónde está cada unidad y dónde ocurrió cada
 * evento.
 *
 * Va aparte de Mapa.tsx, que dibuja la geografía fija del corredor
 * (trazado, conexiones, polos industriales): eso cambia de tanto en
 * tanto, esto cambia cada segundo.
 *
 * Todo lo que se pinta aquí viene del backend. Una unidad sin GPS no
 * aparece en el mapa — no se inventa una posición sobre la vía.
 *
 * Sobre el movimiento: el GPS llega cada ~5 s, así que un marcador
 * puesto en la última posición salta de golpe. Aquí se interpola la
 * transición entre dos posiciones REALES, igual que el velocímetro
 * suaviza el número entre dos lecturas. No se inventan posiciones
 * intermedias como mediciones: solo se suaviza cómo se muestra el
 * cambio, y el popup siempre da el último dato recibido de verdad.
 */

import { useCallback, useEffect, useState } from 'react';
import { Marker, Polyline, Popup, Tooltip, useMap } from 'react-leaflet';

import { api } from '../api/client';
import { useSocketEvent } from '../api/socket';
import type { EventBroadcast, TelemetryBroadcast, TelemetryPoint } from '../api/types';
import type { EventSeverity } from '../contract/contract';
import { eventKindLabel, eventValueUnit } from '../lib/labels';
import { formatTime } from '../lib/format';
import { iconoEvento, iconoUnidad } from './mapIcons';
import './liveMap.css';

/** Posiciones guardadas por unidad para el rastro: a 1 Hz, unos dos
 *  minutos de recorrido. */
const RASTRO_MAX = 120;

/** Un evento se desvanece del mapa tras este tiempo: el mapa muestra lo
 *  que está pasando; el historial vive en la vista Eventos. */
const EVENTO_VIGENCIA_MS = 10 * 60 * 1000;

/** Sin datos en este tiempo, la unidad se dibuja apagada: sigue en su
 *  última posición conocida, pero ya no se afirma que esté ahí. */
const SIN_DATOS_MS = 30_000;

/** Duración de la transición entre dos posiciones GPS. Algo por debajo
 *  del intervalo del GPS (~5 s) para que la siguiente llegue casi al
 *  terminar y el movimiento no se vea a tirones. */
const TRANSICION_MS = 4000;

/** Por debajo de esta distancia no se recalcula el rumbo: con ~100 m de
 *  precisión, dos fixes casi iguales darían un giro aleatorio. */
const RUMBO_MIN_M = 12;

/** Primary y backup van en el mismo camión, así que sus marcadores se
 *  tapan. Se separan cuando quedan a menos de esta distancia EN PANTALLA.
 *
 *  La separación se mide en píxeles y no en metros: con el mapa alejado
 *  18 m son medio píxel y no hace falta separar, pero al acercar esos
 *  mismos metros se vuelven cientos de píxeles y el ajuste desplazaría
 *  el marcador media manzana. En píxeles el icono se ve igual de
 *  separado en todos los niveles de zoom. */
const SOLAPE_PX = 34;

/** Cuánto se aparta cada marcador de su posición medida, en píxeles. Es
 *  un ajuste de dibujo: el popup sigue dando la posición real. */
const SEPARACION_PX = 17;

interface Unidad {
  nodeId: string;
  unitId: string;
  role: 'primary' | 'backup';
  /** Posición confirmada más reciente. */
  destino: [number, number];
  /** Desde dónde se está animando. */
  origen: [number, number];
  /** Cuándo empezó la transición actual. */
  desde: number;
  rumbo: number | null;
  speedKmh: number | null;
  recibidoEn: number;
  rastro: [number, number][];
  alerta: EventSeverity | null;
}

interface EventoEnMapa {
  id: string;
  lat: number;
  lon: number;
  kind: EventBroadcast['kind'];
  severity: EventSeverity;
  value: number | null;
  ts: number;
}

/** Distancia aproximada en metros. A escala de un corredor basta con
 *  tratar los grados como plano, corrigiendo la longitud por latitud. */
function metros(a: [number, number], b: [number, number]): number {
  const dLat = (b[0] - a[0]) * 111_320;
  const dLon = (b[1] - a[1]) * 111_320 * Math.cos((a[0] * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLon * dLon);
}

/** Rumbo en grados desde el norte, para orientar el icono. */
function rumboEntre(a: [number, number], b: [number, number]): number {
  const dLat = b[0] - a[0];
  const dLon = (b[1] - a[1]) * Math.cos((a[0] * Math.PI) / 180);
  return (Math.atan2(dLon, dLat) * 180) / Math.PI;
}

/** Arranca y frena, en vez de moverse a velocidad constante y pararse
 *  en seco. */
function suavizar(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/** Dónde se dibuja la unidad ahora mismo, interpolando entre la
 *  posición anterior y la última confirmada. */
function posicionActual(u: Unidad, ahora: number): [number, number] {
  const t = Math.min(1, (ahora - u.desde) / TRANSICION_MS);
  if (t >= 1) return u.destino;
  const k = suavizar(t);
  return [
    u.origen[0] + (u.destino[0] - u.origen[0]) * k,
    u.origen[1] + (u.destino[1] - u.origen[1]) * k,
  ];
}

export default function LiveMapLayers({
  onTelemetria,
}: {
  /** Ultimo mensaje por nodo, para que el panel lateral muestre la
   *  velocidad en vivo sin abrir un segundo socket. */
  onTelemetria?: (t: TelemetryBroadcast) => void;
} = {}) {
  const [unidades, setUnidades] = useState<Record<string, Unidad>>({});
  const [eventos, setEventos] = useState<EventoEnMapa[]>([]);
  // El mapa hace falta para separar los marcadores en pixeles: la
  // conversion depende del zoom, que cambia cuando el usuario amplia.
  const map = useMap();
  /** Nodo que cada unidad usa como fuente, por codigo de unidad. Lo
   *  emite el backend al hacer failover. */
  const [fuentePorUnidad, setFuentePorUnidad] = useState<Record<string, string | null>>({});
  const [ahora, setAhora] = useState(() => Date.now());

  // Un solo bucle de animación para todas las unidades. Si el visitante
  // pide menos movimiento no se anima: el marcador salta a cada
  // posición nueva, que es el comportamiento honesto sin animación.
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reduce) {
      // Sin animación el reloj sigue avanzando, más lento: hace falta
      // para que una unidad que se calla acabe dibujándose apagada.
      const id = setInterval(() => setAhora(Date.now()), 5000);
      return () => clearInterval(id);
    }

    let raf = 0;
    let vivo = true;
    const paso = () => {
      if (!vivo) return;
      setAhora(Date.now());
      raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => {
      vivo = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  // Última posición real conocida al abrir el mapa: sin esto, una unidad
  // que no estuviera publicando justo en este instante no aparecía en
  // absoluto (ni marcador ni si está activa), aunque tuviera GPS real
  // guardado de hace un momento. Se dibuja "callada" si corresponde —
  // el componente ya distingue eso, solo hacía falta sembrar el dato.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      let unidadesReales;
      try {
        unidadesReales = await api.listUnits();
      } catch {
        return; // sin unidades no hay nada que sembrar; se sigue en vivo
      }

      const seed: Record<string, Unidad> = {};

      for (const unidad of unidadesReales) {
        if (cancelled) return;
        let rows: TelemetryPoint[];
        try {
          rows = await api.listTelemetry(unidad.unitCode);
        } catch {
          continue;
        }

        const porNodo = new Map<string, TelemetryPoint[]>();
        for (const row of rows) {
          if (row.gpsLat == null || row.gpsLon == null) continue;
          const lista = porNodo.get(row.nodeCode) ?? [];
          lista.push(row); // rows viene más reciente primero
          porNodo.set(row.nodeCode, lista);
        }

        for (const [nodeCode, nodeRows] of porNodo) {
          const ultimo = nodeRows[0]!;
          const previo = nodeRows[1];
          const destino: [number, number] = [ultimo.gpsLat!, ultimo.gpsLon!];
          const posPrevia: [number, number] | null =
            previo && previo.gpsLat != null && previo.gpsLon != null
              ? [previo.gpsLat, previo.gpsLon]
              : null;

          seed[nodeCode] = {
            nodeId: nodeCode,
            unitId: unidad.unitCode,
            role: ultimo.role,
            destino,
            origen: destino, // sin animación al sembrar: ya está "ahí"
            desde: Date.now(),
            rumbo:
              posPrevia && metros(posPrevia, destino) >= RUMBO_MIN_M
                ? rumboEntre(posPrevia, destino)
                : null,
            speedKmh: ultimo.gpsSpeedMs != null ? ultimo.gpsSpeedMs * 3.6 : null,
            recibidoEn: new Date(ultimo.receivedAt).getTime(),
            // Orden cronológico para el rastro, igual que como se va
            // armando en vivo (más viejo primero).
            rastro: [...nodeRows]
              .reverse()
              .slice(-RASTRO_MAX)
              .map((r): [number, number] => [r.gpsLat!, r.gpsLon!]),
            alerta: null,
          };
        }
      }

      if (!cancelled && Object.keys(seed).length > 0) {
        // ...prev al final: si ya llegó algo real por socket mientras se
        // cargaba la historia, ese dato en vivo gana.
        setUnidades((prev) => ({ ...seed, ...prev }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Al cambiar el zoom hay que recolocar: la separacion se calcula en
  // pixeles y su equivalente en grados depende del nivel. El bucle de
  // animacion ya redibuja cada cuadro, pero sin animacion
  // (prefers-reduced-motion) hace falta este aviso.
  useEffect(() => {
    const recolocar = () => setAhora(Date.now());
    map.on('zoomend', recolocar);
    return () => {
      map.off('zoomend', recolocar);
    };
  }, [map]);

  useSocketEvent(
    'telemetry',
    useCallback((t: TelemetryBroadcast) => {
      // El panel lateral quiere toda la telemetria, tenga GPS o no.
      onTelemetria?.(t);

      const gps = t.gps;
      // Sin GPS no hay nada que ubicar. Es lo normal bajo techo.
      if (!gps) return;
      const nueva: [number, number] = [gps.lat, gps.lon];

      setUnidades((prev) => {
        const anterior = prev[t.nodeId];
        const ahora = Date.now();

        // La animación arranca donde el marcador se ve ahora, no en la
        // última posición confirmada: si llega un fix a mitad de la
        // transición, el icono no salta hacia atrás.
        const origen = anterior ? posicionActual(anterior, ahora) : nueva;
        const avance = anterior ? metros(anterior.destino, nueva) : 0;

        return {
          ...prev,
          [t.nodeId]: {
            nodeId: t.nodeId,
            unitId: t.unitId,
            role: t.role,
            destino: nueva,
            origen,
            desde: ahora,
            rumbo:
              anterior && avance >= RUMBO_MIN_M
                ? rumboEntre(anterior.destino, nueva)
                : (anterior?.rumbo ?? null),
            speedKmh: gps.speedMs != null ? gps.speedMs * 3.6 : null,
            recibidoEn: t.receivedAt,
            rastro: [...(anterior?.rastro ?? []), nueva].slice(-RASTRO_MAX),
            alerta: anterior?.alerta ?? null,
          },
        };
      });
    }, [onTelemetria]),
  );

  useSocketEvent(
    'unit:active-node',
    useCallback((p: { unitId: string; activeNodeId: string | null }) => {
      setFuentePorUnidad((prev) => ({ ...prev, [p.unitId]: p.activeNodeId }));
    }, []),
  );

  useSocketEvent(
    'event',
    useCallback((ev: EventBroadcast) => {
      // Marca la unidad aunque el evento no traiga GPS: que algo le
      // pasó a esa carga es información aparte de dónde pasó.
      const nodeId = ev.nodeId;
      if (nodeId !== null) {
        setUnidades((prev) => {
          const u = prev[nodeId];
          return u ? { ...prev, [nodeId]: { ...u, alerta: ev.severity } } : prev;
        });
      }

      const gps = ev.gps;
      if (!gps) return;
      setEventos((prev) =>
        [
          {
            id: `${ev.nodeId ?? ev.unitId}-${ev.ts}`,
            lat: gps.lat,
            lon: gps.lon,
            kind: ev.kind,
            severity: ev.severity,
            value: ev.value ?? null,
            ts: ev.ts,
          },
          ...prev,
        ].slice(0, 50),
      );
    }, []),
  );

  const lista = Object.values(unidades);
  const eventosVigentes = eventos.filter((e) => ahora - e.ts < EVENTO_VIGENCIA_MS);

  return (
    <>
      {/* Eventos primero: los marcadores de unidad quedan encima. */}
      {eventosVigentes.map((ev) => (
        <Marker
          key={ev.id}
          position={[ev.lat, ev.lon]}
          icon={iconoEvento(ev.severity, ev.severity === 'critical')}
        >
          <Tooltip direction="top" offset={[0, -10]}>
            {eventKindLabel(ev.kind)}
            {ev.value !== null
              ? ` · ${ev.value.toFixed(2)} ${eventValueUnit(ev.kind)}`.trimEnd()
              : ''}
          </Tooltip>
          <Popup>
            <strong>{eventKindLabel(ev.kind)}</strong>
            <br />
            {ev.value !== null
              ? `${ev.value.toFixed(2)} ${eventValueUnit(ev.kind)}`.trimEnd()
              : 'sin valor medido'}
            <br />
            {formatTime(new Date(ev.ts).toISOString())}
          </Popup>
        </Marker>
      ))}

      {lista.map((u) => {
        const medida = posicionActual(u, ahora);
        // Si hay otro nodo de la misma unidad casi encima, se separan:
        // el primario arriba, el respaldo abajo. La comparacion va en
        // pixeles, asi que el ajuste se mantiene igual a cualquier zoom.
        const hermano = lista.find((o) => o.nodeId !== u.nodeId && o.unitId === u.unitId);
        let pos: [number, number] = medida;

        if (hermano) {
          const p = map.latLngToLayerPoint(medida);
          const q = map.latLngToLayerPoint(posicionActual(hermano, ahora));
          if (p.distanceTo(q) < SOLAPE_PX) {
            const desplazado = map.layerPointToLatLng([
              p.x,
              p.y + (u.role === 'primary' ? -SEPARACION_PX : SEPARACION_PX),
            ]);
            pos = [desplazado.lat, desplazado.lng];
          }
        }
        const callada = ahora - u.recibidoEn > SIN_DATOS_MS;

        return (
          <div key={u.nodeId}>
            {u.rastro.length > 1 ? (
              <>
                {/* Dos trazos: uno ancho y tenue como estela, otro fino
                    encima, para que el rastro se lea sobre el mapa. */}
                <Polyline
                  positions={u.rastro}
                  pathOptions={{ color: '#49c79c', weight: 8, opacity: callada ? 0.06 : 0.13 }}
                />
                <Polyline
                  positions={u.rastro}
                  pathOptions={{
                    color: '#49c79c',
                    weight: 2,
                    opacity: callada ? 0.25 : 0.7,
                    dashArray: '4 7',
                  }}
                />
              </>
            ) : null}

            <Marker
              position={pos}
              icon={iconoUnidad({
                rumbo: u.rumbo,
                callada,
                alerta: u.alerta,
                etiqueta: u.unitId,
                role: u.role,
                // Sin aviso de failover todavia, el primario es la
                // fuente: es lo que hace el backend al dar de alta.
                esFuente:
                  fuentePorUnidad[u.unitId] !== undefined
                    ? fuentePorUnidad[u.unitId] === u.nodeId
                    : u.role === 'primary',
              })}
              zIndexOffset={500}
            >
              <Popup>
                <strong>{u.nodeId}</strong>
                <br />
                {u.role === 'primary' ? 'Nodo primario' : 'Nodo de respaldo'}
                <br />
                {u.speedKmh !== null ? `${u.speedKmh.toFixed(1)} km/h` : 'sin velocidad'}
                <br />
                {callada
                  ? `Sin datos desde ${formatTime(new Date(u.recibidoEn).toISOString())}`
                  : `Último dato ${formatTime(new Date(u.recibidoEn).toISOString())}`}
              </Popup>
            </Marker>
          </div>
        );
      })}
    </>
  );
}
