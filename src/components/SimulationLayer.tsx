/* Capa de simulación del corredor.
 *
 * Dibuja las unidades simuladas y sus alertas con los mismos iconos que
 * los nodos reales, para que la demo muestre cómo se vería el sistema en
 * operación. Lo que los distingue es la etiqueta SIM en el nombre y el
 * aviso permanente mientras la simulación está encendida: nadie debe
 * poder confundir esto con telemetría medida.
 *
 * La ficha de cada unidad enseña lo mismo que enseñaría de un nodo real
 * —qué nodo es la fuente, batería, cola de outbox, y las lecturas del
 * acelerómetro y el giroscopio— porque eso es lo que hay que poder
 * explicar cuando alguien pregunta qué mide el sistema.
 */

import { useEffect, useRef, useState } from 'react';
import { Marker, Popup, Tooltip } from 'react-leaflet';

import type { MapCoordinate } from '../lib/mapData';
import {
  avanzarSimulacion,
  iniciarSimulacion,
  type EstadoSimulacion,
  type TrenSimulado,
} from '../lib/simulacion';
import type { TrackDefect } from '../api/types';
import { iconoEvento, iconoUnidad } from './mapIcons';
import { eventKindLabel, eventValueUnit } from '../lib/labels';
import { formatTime } from '../lib/format';

/** Ritmo de la simulación. 250 ms basta para que el movimiento se vea
 *  fluido sin cargar el navegador. */
const PASO_MS = 250;

export default function SimulationLayer({
  ruta,
  activa,
  onDefectos,
}: {
  ruta: MapCoordinate[];
  activa: boolean;
  /** Los defectos simulados suben al panel lateral, que ya sabe
   *  pintarlos: no hace falta una vista aparte. */
  onDefectos: (d: TrackDefect[]) => void;
}) {
  const [estado, setEstado] = useState<EstadoSimulacion | null>(null);
  const onDefectosRef = useRef(onDefectos);
  onDefectosRef.current = onDefectos;

  useEffect(() => {
    if (!activa || ruta.length < 2) {
      setEstado(null);
      onDefectosRef.current([]);
      return;
    }

    const rutaXY = ruta.map((p) => [p[0], p[1]] as [number, number]);
    let actual = iniciarSimulacion(rutaXY);
    setEstado(actual);

    const id = setInterval(() => {
      actual = avanzarSimulacion(actual, rutaXY, PASO_MS / 1000);
      setEstado(actual);
      onDefectosRef.current(actual.defectos);
    }, PASO_MS);

    return () => clearInterval(id);
  }, [activa, ruta]);

  if (!activa || !estado) return null;

  return (
    <>
      {estado.alertas.map((a) => (
        <Marker
          key={a.id}
          position={[a.lat, a.lon]}
          icon={iconoEvento(a.severity, a.severity === 'critical')}
        >
          <Tooltip direction="top" offset={[0, -10]}>
            {eventKindLabel(a.kind)} · {a.value.toFixed(2)} {eventValueUnit(a.kind)}
          </Tooltip>
          <Popup>
            <strong>{eventKindLabel(a.kind)}</strong>
            <br />
            {a.value.toFixed(2)} {eventValueUnit(a.kind)} (umbral{' '}
            {a.threshold.toFixed(2)})
            <br />
            {a.nodeId} · {formatTime(new Date(a.ts).toISOString())}
          </Popup>
        </Marker>
      ))}

      {estado.trenes.map((t) => (
        <Marker
          key={t.unitId}
          position={[t.lat, t.lon]}
          icon={iconoUnidad({
            rumbo: t.rumbo,
            // Sin cobertura la unidad se pinta apagada, igual que un
            // nodo real que dejó de reportar.
            callada: t.sinCobertura,
            alerta: null,
            etiqueta: t.etiqueta,
            role: nodoActivo(t).role,
            esFuente: true,
          })}
          zIndexOffset={400}
        >
          <Tooltip direction="top" offset={[0, -10]}>
            {t.etiqueta} · {t.speedKmh.toFixed(0)} km/h
          </Tooltip>
          <Popup>
            <FichaUnidad tren={t} />
          </Popup>
        </Marker>
      ))}
    </>
  );
}

function nodoActivo(t: TrenSimulado) {
  return t.nodos.find((n) => n.nodeId === t.nodoActivo) ?? t.nodos[0]!;
}

/** Ficha de la unidad: lo mismo que se podría decir de una real. */
function FichaUnidad({ tren }: { tren: TrenSimulado }) {
  const activo = nodoActivo(tren);
  const accel = tren.telemetria.accel;
  const gyro = tren.telemetria.gyro;

  return (
    <div>
      <strong>{tren.etiqueta}</strong>
      <br />
      {tren.speedKmh.toFixed(0)} km/h · {Math.round(tren.avance * 100)} % del corredor
      <br />
      <br />

      {/* Qué nodo manda ahora. Cuando el primario se queda sin pila, la
          unidad pasa al respaldo y aquí se ve el cambio. */}
      <strong>Fuente: {activo.nodeId}</strong>
      <br />
      {activo.role === 'primary' ? 'Nodo primario' : 'Nodo de respaldo'} ·{' '}
      {activo.samplingMs} ms
      <br />
      {tren.nodos.map((n) => (
        <span key={n.nodeId}>
          {n.nodeId}: {n.online ? `${n.batteryPct.toFixed(0)} %` : 'apagado'}
          {n.pendingOutbox > 0 ? ` · ${n.pendingOutbox} en cola` : ''}
          <br />
        </span>
      ))}

      {tren.sinCobertura ? (
        <>
          <br />
          <em>Sin cobertura: sigue midiendo, encola y enviará al recuperarla.</em>
          <br />
        </>
      ) : null}

      <br />
      {/* Las lecturas crudas: es lo que llega por el contrato y de lo
          que el nodo deriva los eventos. */}
      {accel ? (
        <>
          Accel (g): {accel.x.toFixed(2)} / {accel.y.toFixed(2)} / {accel.z.toFixed(2)}
          <br />
        </>
      ) : null}
      {gyro ? (
        <>
          Giro (rad/s): {gyro.x.toFixed(2)} / {gyro.y.toFixed(2)} / {gyro.z.toFixed(2)}
          <br />
        </>
      ) : null}
      {tren.telemetria.gps?.accuracyM !== undefined ? (
        <>
          GPS ±{tren.telemetria.gps.accuracyM.toFixed(0)} m
          <br />
        </>
      ) : null}
      <br />
      <em>Unidad simulada</em>
    </div>
  );
}
