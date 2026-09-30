import { t as translate } from '../accessibility/i18n';
/* Capa de simulación del corredor.
 *
 * Dibuja los trenes simulados y sus alertas con los mismos iconos que
 * los nodos reales, para que la demo muestre cómo se vería el sistema en
 * operación. Lo que los distingue es la etiqueta SIM en el nombre y el
 * aviso permanente mientras la simulación está encendida: nadie debe
 * poder confundir esto con telemetría medida.
 */

import { useEffect, useRef, useState } from 'react';
import { Marker, Popup, Tooltip } from 'react-leaflet';

import type { MapCoordinate } from '../lib/mapData';
import {
  avanzarSimulacion,
  iniciarSimulacion,
  type EstadoSimulacion,
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
            {translate(eventKindLabel(a.kind))} · {translate(a.value.toFixed(2))} {translate(eventValueUnit(a.kind))}
          </Tooltip>
          <Popup>
            <strong>{translate(eventKindLabel(a.kind))}</strong>
            <br />
            {translate(a.value.toFixed(2))} {translate(eventValueUnit(a.kind))}
            <br />
            {translate(a.nodeId)} · {translate(formatTime(new Date(a.ts).toISOString()))}
          </Popup>
        </Marker>
      ))}

      {estado.trenes.map((t) => (
        <Marker
          key={t.nodeId}
          position={[t.lat, t.lon]}
          icon={iconoUnidad({
            rumbo: t.rumbo,
            callada: false,
            alerta: null,
            etiqueta: t.unitId,
            role: 'primary',
            esFuente: true,
          })}
          zIndexOffset={400}
        >
          <Popup>
            <strong>{translate(t.unitId)}</strong>
            <br />
            {t.speedKmh}{translate(" km/h")}<br />
            {Math.round(t.avance * 100)}{translate(" % del corredor")}<br />
            <em>{translate("Unidad simulada")}</em>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
