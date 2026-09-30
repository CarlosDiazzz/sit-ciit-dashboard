/* Mapa del corredor: posición en vivo de las unidades sobre el trazado
 * real de la Línea Z.
 *
 * Esta entrega deja el contenedor del mapa y la lista de unidades. Falta:
 * el GeoJSON de la Línea Z (sit-ciit-infra/data), los marcadores en vivo
 * y las capas de antenas OpenCelliD y clima Open-Meteo (Fase 1 y Fase 7).
 */

import { useEffect, useState } from 'react';
import { latLngBounds } from 'leaflet';
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { api } from '../api/client';
import { useApi } from '../api/useApi';
import type { Unit } from '../api/types';
import { ErrorState, Loading } from '../components/States';
import { ConnectionBadge } from '../components/Badges';
import { parseRailSegments, type MapCoordinate } from '../lib/mapData';
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
  { name: 'Medias Aguas', position: [17.668, -94.905] },
  { name: 'Matías Romero', position: [16.878, -95.043] },
  { name: 'Cd. Ixtepec', position: [16.5639, -95.1018] },
  { name: 'Juchitán', position: [16.4389, -95.0198] },
  { name: 'Salina Cruz', position: [16.175, -95.194] },
];

function FitMapToData({ segments }: { segments: MapCoordinate[][] }) {
  const map = useMap();

  useEffect(() => {
    const positions = [
      ...segments.flat(),
      ...PUNTOS_CLAVE.map((point) => point.position),
    ];
    if (positions.length > 0) {
      map.fitBounds(latLngBounds(positions), { padding: [28, 28], maxZoom: 10 });
    }
  }, [map, segments]);

  return null;
}

export default function Mapa() {
  const state = useApi<Unit[]>(() => api.listUnits());
  const [railSegments, setRailSegments] = useState<MapCoordinate[][]>([]);
  const [mapDataError, setMapDataError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('mapData.txt')
      .then((response) => {
        if (!response.ok) throw new Error(`No se pudo cargar mapData.txt (${response.status}).`);
        return response.json();
      })
      .then((data: unknown) => {
        const segments = parseRailSegments(data);
        if (segments.length === 0) throw new Error('mapData.txt no contiene trazos ferroviarios con coordenadas.');
        if (!cancelled) setRailSegments(segments);
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
            <FitMapToData segments={railSegments} />
            {railSegments.map((segment, index) => (
              <Polyline key={index} positions={segment} pathOptions={{ color: '#2E7D32', weight: 4 }} />
            ))}
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
              {mapDataError ?? 'Sin unidades registradas todavía.'}
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
