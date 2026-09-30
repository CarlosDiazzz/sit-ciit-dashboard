import DecisionBrief from '../components/DecisionBrief';
/* Mapa del corredor: posición en vivo de las unidades sobre el trazado
 * real de la Línea Z.
 *
 * Esta entrega deja el contenedor del mapa y la lista de unidades. Falta:
 * el GeoJSON de la Línea Z (sit-ciit-infra/data), los marcadores en vivo
 * y las capas de antenas OpenCelliD y clima Open-Meteo (Fase 1 y Fase 7).
 */

import { useCallback, useState } from 'react';
import { useSocketEvent } from '../api/socket';
import type { TelemetryBroadcast } from '../api/types';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { api } from '../api/client';
import { useApi } from '../api/useApi';
import type { Unit } from '../api/types';
import { ErrorState, Loading } from '../components/States';
import { ConnectionBadge } from '../components/Badges';
import './mapa.css';

// Centro aproximado del corredor Salina Cruz–Coatzacoalcos, para que el
// mapa abra encuadrado antes de tener el trazado real.
const CENTRO: [number, number] = [17.3, -94.8];

export default function Mapa() {
  const state = useApi<Unit[]>(() => api.listUnits());

  const [positions, setPositions] = useState<Record<string, TelemetryBroadcast>>({});
  const onTelemetry = useCallback((event: TelemetryBroadcast) => {
    if (event.gps && Number.isFinite(event.gps.lat) && Number.isFinite(event.gps.lon)) {
      setPositions(previous => ({ ...previous, [event.nodeId]: event }));
    }
  }, []);
  useSocketEvent('telemetry', onTelemetry);

  return (
    <>
      <div className="page-head">
        <div>
          <span className="dss-kicker">QUETZALCÓATL / CORREDOR INTEROCEÁNICO</span><h1>Ruta</h1>
          <p>Corredor Salina Cruz–Coatzacoalcos (Línea Z).</p>
        </div>
      </div>

      <DecisionBrief title="Supervisa la cobertura antes de interpretar la ruta" evidence="El mapa muestra las posiciones GPS recibidas en esta sesión, por nodo. Son últimas ubicaciones reportadas; verifica su hora antes de interpretarlas." action="Revisa la fuente activa y el último reporte de la unidad antes de tomar una decisión sobre su recorrido." to="/unidad" linkLabel="Revisar unidades" />
            <div className="dss-metrics route-metrics">
        <article><span>Ubicación</span><strong>{Object.keys(positions).length}</strong><small>Nodos con posición recibida en esta sesión</small></article>
        <article><span>Recorrido · Línea Z</span><strong>Sin trazado</strong><small>Distancia recorrida y restante aún no disponibles</small></article>
        <article><span>ETA · Llegada estimada</span><strong>Sin estimación</strong><small>Requiere destino, distancia restante y velocidad promedio</small></article>
      </div>
      <div className="map-layout">
        <div className="map-frame">
          <MapContainer center={CENTRO} zoom={8} className="map">
            <TileLayer
              // Teselas de OpenStreetMap: la atribución es obligatoria
              // por su licencia.
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {Object.values(positions).map(position => position.gps && <CircleMarker key={position.nodeId} center={[position.gps.lat, position.gps.lon]} radius={7} pathOptions={{ color: '#49c79c' }}><Popup><strong>{position.unitId}</strong><br />Nodo: {position.nodeId}<br />Última ubicación: {new Date(position.ts).toLocaleString('es-MX')}<br />Precisión: {position.gps.accuracyM != null ? `${position.gps.accuracyM} m` : 'Sin dato'}</Popup></CircleMarker>)}
          </MapContainer>
        </div>

        <aside className="map-side">
          <h2>Unidades</h2>

          {state.loading ? (
            <Loading label="Cargando unidades…" />
          ) : state.error ? (
            <ErrorState error={state.error} onRetry={state.reload} />
          ) : state.data && state.data.length > 0 ? (
            <ul className="unit-strip">
              {state.data.map((unidad) => {
                const activo = unidad.nodes.find((n) => n.id === unidad.activeNodeId);
                return (
                  <li key={unidad.id}>
                    <span>{unidad.label ?? unidad.unitCode}</span>
                    <ConnectionBadge online={activo?.isOnline ?? false} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="map-hint">
              Sin unidades registradas todavía. Las posiciones GPS se muestran al recibir
              telemetría de los nodos.
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
