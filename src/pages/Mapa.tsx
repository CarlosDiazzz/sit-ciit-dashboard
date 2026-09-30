/* Mapa de la Línea Z y sus conexiones G y K desde el archivo local Overpass.
 * La lista de unidades conserva su fuente de telemetría independiente.
 */

import { useEffect, useState } from 'react';
import { latLngBounds } from 'leaflet';
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { api } from '../api/client';
import { useApi } from '../api/useApi';
import type { Unit } from '../api/types';
import { ErrorState, Loading } from '../components/States';
import { ConnectionBadge } from '../components/Badges';
import { MEDIAS_AGUAS_JUNCTION, parseMainRailRoute, parseRailConnections, type MapCoordinate, type RailConnection } from '../lib/mapData';
import './mapa.css';

// Centro aproximado del corredor Salina Cruz–Coatzacoalcos, para que el
// mapa abra encuadrado antes de tener el trazado real.
const CENTRO: [number, number] = [17.3, -94.8];

// Puntos de referencia de polos industriales y localidades del corredor.
const PUNTOS_CLAVE: { name: string; position: MapCoordinate }[] = [
  { name: 'Coatzacoalcos', position: [18.14905, -94.4447] },
  { name: 'San Andrés Tuxtla', position: [18.4487, -95.2134] },
  { name: 'Minatitlán', position: [17.9895, -94.5568] },
  { name: 'Acayucan', position: [17.9498, -94.913] },
  { name: 'Medias Aguas', position: MEDIAS_AGUAS_JUNCTION },
  { name: 'Matías Romero', position: [16.878, -95.043] },
  { name: 'Cd. Ixtepec', position: [16.5639, -95.1018] },
  { name: 'Juchitán', position: [16.4389, -95.0198] },
  { name: 'Salina Cruz', position: [16.175, -95.194] },
];

function FitMapToData({ route, connections }: { route: MapCoordinate[]; connections: RailConnection[] }) {
  const map = useMap();

  useEffect(() => {
    const positions = [
      ...route,
      ...connections.flatMap((connection) => connection.segments.flat()),
      ...PUNTOS_CLAVE.map((point) => point.position),
    ];
    if (positions.length > 0) {
      map.fitBounds(latLngBounds(positions), { padding: [28, 28], maxZoom: 10 });
    }
  }, [map, route, connections]);

  return null;
}

export default function Mapa() {
  const state = useApi<Unit[]>(() => api.listUnits());
  const [railRoute, setRailRoute] = useState<MapCoordinate[]>([]);
  const [railConnections, setRailConnections] = useState<RailConnection[]>([]);
  const [mapDataError, setMapDataError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('mapData.txt')
      .then((response) => {
        if (!response.ok) throw new Error(`No se pudo cargar mapData.txt (${response.status}).`);
        return response.json();
      })
      .then((data: unknown) => {
        const route = parseMainRailRoute(data);
        if (route.length === 0) throw new Error('mapData.txt no contiene una ruta ferroviaria válida.');
        const connections = parseRailConnections(data);
        if (!cancelled) {
          setRailRoute(route);
          setRailConnections(connections);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setMapDataError(error instanceof Error ? error.message : 'No se pudo cargar el mapa.');
      });

    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Mapa</h1>
          <p>Corredor Salina Cruz–Coatzacoalcos (Línea Z).</p>
        </div>
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
            <FitMapToData route={railRoute} connections={railConnections} />
            {railConnections.map((connection) => (
              <Polyline
                key={connection.name}
                positions={connection.segments}
                pathOptions={{ color: '#2E7D32', weight: 4 }}
              >
                <Tooltip sticky>{connection.name === 'Línea G' ? 'Línea G · Centro del país' : 'Línea K · Juchitán / Centroamérica'}</Tooltip>
              </Polyline>
            ))}
            {railRoute.length > 1 && (
              <Polyline positions={railRoute} pathOptions={{ color: '#2E7D32', weight: 4 }}>
                <Tooltip sticky>Línea Z · Coatzacoalcos–Salina Cruz</Tooltip>
              </Polyline>
            )}
            {PUNTOS_CLAVE.map((point) => (
              <CircleMarker
                key={point.name}
                center={point.position}
                radius={7}
                pathOptions={{
                  color: '#fff',
                  weight: 2,
                  fillColor: '#795548',
                  fillOpacity: 1,
                  className: 'industrial-park-marker',
                }}
              >
                <Tooltip direction="top" offset={[0, -7]}>{point.name}</Tooltip>
                <Popup>
                  <span className="industrial-park-popup">Polo de desarrollo</span>
                  <strong>{point.name}</strong>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

        <aside className="map-side">
          <h2>Unidades</h2>
          {mapDataError && <p className="map-hint" role="alert">{mapDataError}</p>}

          {state.loading && state.data === null ? (
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
              Sin unidades registradas todavía.
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
