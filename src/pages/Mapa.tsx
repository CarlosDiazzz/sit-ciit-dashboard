/* Mapa del corredor: posición en vivo de las unidades sobre el trazado
 * real de la Línea Z.
 *
 * Esta entrega deja el contenedor del mapa y la lista de unidades. Falta:
 * el GeoJSON de la Línea Z (sit-ciit-infra/data), los marcadores en vivo
 * y las capas de antenas OpenCelliD y clima Open-Meteo (Fase 1 y Fase 7).
 */

import { useEffect, useState } from 'react';
import { MapContainer, Polyline, TileLayer } from 'react-leaflet';
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
            {railSegments.map((segment, index) => (
              <Polyline key={index} positions={segment} pathOptions={{ color: '#2E7D32', weight: 4 }} />
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
