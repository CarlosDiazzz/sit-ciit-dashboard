/* Capas en vivo del mapa: dónde está cada unidad y dónde ocurrió cada
 * evento.
 *
 * Va aparte de Mapa.tsx, que dibuja la geografía fija del corredor
 * (trazado, conexiones, polos industriales): eso cambia de tanto en
 * tanto, esto cambia cada segundo.
 *
 * Todo lo que se pinta aquí viene del backend. Una unidad sin GPS no
 * aparece en el mapa — no se inventa una posición sobre la vía.
 */

import { useCallback, useEffect, useState } from 'react';
import { CircleMarker, Polyline, Popup, Tooltip } from 'react-leaflet';

import { useSocketEvent } from '../api/socket';
import type { EventBroadcast, TelemetryBroadcast } from '../api/types';
import type { EventSeverity } from '../contract/contract';
import { eventKindLabel, eventValueUnit } from '../lib/labels';
import { formatTime } from '../lib/format';

/** Posiciones guardadas por unidad para dibujar su rastro. A 1 Hz son
 *  unos dos minutos de recorrido, suficiente para ver hacia dónde va
 *  sin llenar el mapa de puntos. */
const RASTRO_MAX = 120;

/** Un evento se desvanece del mapa tras este tiempo: el mapa muestra lo
 *  que está pasando, el historial completo vive en la vista Eventos. */
const EVENTO_VIGENCIA_MS = 10 * 60 * 1000;

/** Sin datos en este tiempo, la unidad se dibuja apagada: sigue en su
 *  última posición conocida, pero ya no se afirma que esté ahí. */
const SIN_DATOS_MS = 30_000;

const COLOR_SEVERIDAD: Record<EventSeverity, string> = {
  info: '#58a6ff',
  warning: '#d29922',
  critical: '#f85149',
};

interface PosicionUnidad {
  nodeId: string;
  unitId: string;
  role: 'primary' | 'backup';
  lat: number;
  lon: number;
  speedKmh: number | null;
  recibidoEn: number;
  rastro: [number, number][];
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

export default function LiveMapLayers() {
  const [posiciones, setPosiciones] = useState<Record<string, PosicionUnidad>>({});
  const [eventos, setEventos] = useState<EventoEnMapa[]>([]);
  const [ahora, setAhora] = useState(() => Date.now());

  // Reloj propio: hace que una unidad que dejó de reportar se apague
  // sola, aunque no llegue nada nuevo que fuerce el render.
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  useSocketEvent(
    'telemetry',
    useCallback((t: TelemetryBroadcast) => {
      // Sin GPS no hay nada que ubicar. Es lo normal bajo techo.
      const gps = t.gps;
      if (!gps) return;
      const { lat, lon } = gps;

      setPosiciones((prev) => {
        const anterior = prev[t.nodeId];
        const punto: [number, number] = [lat, lon];
        const rastro: [number, number][] = [...(anterior?.rastro ?? []), punto].slice(-RASTRO_MAX);
        return {
          ...prev,
          [t.nodeId]: {
            nodeId: t.nodeId,
            unitId: t.unitId,
            role: t.role,
            lat,
            lon,
            speedKmh: gps.speedMs != null ? gps.speedMs * 3.6 : null,
            recibidoEn: t.receivedAt,
            rastro,
          },
        };
      });
    }, []),
  );

  useSocketEvent(
    'event',
    useCallback((ev: EventBroadcast) => {
      // Un evento sin GPS sí ocurrió, pero no se puede situar: aparece
      // en la vista Eventos, no aquí.
      const gps = ev.gps;
      if (!gps) return;
      setEventos((prev) =>
        [
          {
            id: `${ev.nodeId}-${ev.ts}`,
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

  const unidades = Object.values(posiciones);
  const eventosVigentes = eventos.filter((e) => ahora - e.ts < EVENTO_VIGENCIA_MS);

  return (
    <>
      {/* Eventos primero, para que los marcadores de unidad queden
          encima y no los tape una marca de evento. */}
      {eventosVigentes.map((ev) => (
        <CircleMarker
          key={ev.id}
          center={[ev.lat, ev.lon]}
          radius={ev.severity === 'critical' ? 11 : 8}
          pathOptions={{
            color: COLOR_SEVERIDAD[ev.severity],
            fillColor: COLOR_SEVERIDAD[ev.severity],
            fillOpacity: 0.28,
            weight: 2,
          }}
        >
          <Tooltip direction="top" offset={[0, -8]}>
            {eventKindLabel(ev.kind)}
            {ev.value !== null ? ` · ${ev.value.toFixed(2)} ${eventValueUnit(ev.kind)}`.trimEnd() : ''}
          </Tooltip>
          <Popup>
            <strong>{eventKindLabel(ev.kind)}</strong>
            <br />
            {ev.value !== null
              ? `${ev.value.toFixed(2)} ${eventValueUnit(ev.kind)}`.trimEnd()
              : 'sin valor'}
            <br />
            {formatTime(new Date(ev.ts).toISOString())}
          </Popup>
        </CircleMarker>
      ))}

      {unidades.map((u) => {
        const callada = ahora - u.recibidoEn > SIN_DATOS_MS;
        return (
          <div key={u.nodeId}>
            {u.rastro.length > 1 ? (
              <Polyline
                positions={u.rastro}
                pathOptions={{
                  color: '#49c79c',
                  weight: 3,
                  opacity: callada ? 0.25 : 0.65,
                  dashArray: '5 6',
                }}
              />
            ) : null}

            <CircleMarker
              center={[u.lat, u.lon]}
              radius={9}
              pathOptions={{
                color: '#0b0e0d',
                fillColor: callada ? '#6e7681' : '#49c79c',
                fillOpacity: 1,
                weight: 2,
              }}
            >
              <Tooltip direction="top" offset={[0, -9]} permanent>
                {u.unitId}
              </Tooltip>
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
            </CircleMarker>
          </div>
        );
      })}
    </>
  );
}
