import { t as translate } from '../accessibility/i18n';
import DecisionBrief from '../components/DecisionBrief';
/* Mapa de la Línea Z y sus conexiones G y K desde el archivo local Overpass.
 * La lista de unidades conserva su fuente de telemetría independiente.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { latLngBounds, point } from 'leaflet';
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { api } from '../api/client';
import { useApi } from '../api/useApi';
import type { Unit } from '../api/types';
import { ErrorState, Loading } from '../components/States';
import PageBreadcrumbs from '../components/PageBreadcrumbs';
import LiveMapLayers from '../components/LiveMapLayers';
import NodeStatusPanel from '../components/NodeStatusPanel';
import TrackDefectLayer from '../components/TrackDefectLayer';
import TrackDefectSummary from '../components/TrackDefectSummary';
import SimulationLayer from '../components/SimulationLayer';
import type {
  CellTower,
  TelemetryBroadcast,
  TrackDefect,
  TrackDefectsResponse,
} from '../api/types';
import { MEDIAS_AGUAS_JUNCTION, parseMainRailRoute, parseRailConnections, type MapCoordinate, type RailConnection } from '../lib/mapData';
import { muestrearRuta } from '../lib/routeProjection';
import { FACTOR_TIEMPO } from '../lib/simulacion';
import './mapa.css';

// Cada cuánto se muestrea la ruta real para pedir antenas reales cerca:
// más fino no ayuda (el backend cachea 24h y las celdas de OpenCelliD
// ya cubren ~1.8 km cada una), más grueso deja huecos en el corredor.
const PASO_MUESTREO_TORRES_M = 3000;

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
      const bounds = latLngBounds(positions);
      // Permite alejarse hasta el encuadre completo del corredor.
      const updateMinZoom = () => {
        map.setMinZoom(Math.min(10, map.getBoundsZoom(bounds, false, point(56, 56))));
      };
      updateMinZoom();
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 10 });
      map.on('resize', updateMinZoom);
      return () => { map.off('resize', updateMinZoom); };
    }
  }, [map, route, connections]);

  return null;
}

export default function Mapa() {
  const state = useApi<Unit[]>(() => api.listUnits());
  const [railRoute, setRailRoute] = useState<MapCoordinate[]>([]);
  const [railConnections, setRailConnections] = useState<RailConnection[]>([]);
  const [mapDataError, setMapDataError] = useState<string | null>(null);
  const [torres, setTorres] = useState<CellTower[]>([]);
  // Defectos de via confirmados por repeticion. Se cargan una vez: no
  // cambian con cada mensaje, solo cuando pasa otro tren por el punto.
  const defectos = useApi<TrackDefectsResponse>(() => api.trackDefects());
  const [verIndicios, setVerIndicios] = useState(false);
  // Simulación del corredor para la demo: varios trenes y alertas a lo
  // largo de la Línea Z, que no se pueden mostrar con dos celulares en
  // una sala. Apagada por defecto y avisada en pantalla mientras corre.
  const [simulando, setSimulando] = useState(false);
  const [defectosSim, setDefectosSim] = useState<TrackDefect[]>([]);
  /** Hora de operación que representa la demo. */
  const [relojSim, setRelojSim] = useState('');
  /** Ultimo mensaje por nodo: da la velocidad en vivo del panel sin
   *  abrir un segundo socket. */
  const [ultimaTelemetria, setUltimaTelemetria] = useState<Record<string, TelemetryBroadcast>>({});
  // La telemetria llega a 1 Hz por nodo y solo la usa el panel lateral
  // para la velocidad. Actualizar el estado en cada mensaje redibujaba
  // TODO el mapa, capas incluidas; en su lugar se acumula en una ref y
  // se publica al estado cada 2 s, que es ritmo de sobra para un numero
  // que se lee de reojo.
  const bufferTelemetria = useRef<Record<string, TelemetryBroadcast>>({});
  const recibirTelemetria = useCallback((t: TelemetryBroadcast) => {
    bufferTelemetria.current = { ...bufferTelemetria.current, [t.nodeId]: t };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setUltimaTelemetria(bufferTelemetria.current), 2000);
    return () => clearInterval(id);
  }, []);

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

  // Antenas reales cerca de la ruta, una vez que se conoce su geometría
  // real — el backend no la conoce, solo consulta OpenCelliD cerca de
  // los puntos que se le mandan (ver GET /coverage/towers).
  useEffect(() => {
    if (railRoute.length < 2) return;
    let cancelled = false;
    const puntos = muestrearRuta(railRoute, PASO_MUESTREO_TORRES_M);

    void api
      .listCellTowers(puntos)
      .then((data) => {
        if (!cancelled) setTorres(data);
      })
      .catch(() => {
        // Sin antenas no se puede dar ETA, pero la posición estimada
        // (Parte 2) sigue funcionando sola — no bloquea el resto del mapa.
      });

    return () => { cancelled = true; };
  }, [railRoute]);

  return (
    <>
      <div className="page-head">
        <div>
          <span className="dss-kicker">{translate("QUETZALCÓATL / CORREDOR INTEROCEÁNICO")}</span><h1>{translate("Ruta")}</h1>
          <p>{translate("Corredor Salina Cruz–Coatzacoalcos (Línea Z).")}</p>
        </div>
        <PageBreadcrumbs current="Ruta" />
      </div>

      <DecisionBrief title={translate("Supervisa la cobertura antes de interpretar la ruta")} evidence={translate("El mapa reúne el trazado ferroviario y las últimas posiciones GPS recibidas. Verifica la hora y la fuente activa antes de interpretar una ubicación.")} action={translate("Revisa el estado de la unidad y su último reporte antes de decidir sobre el recorrido.")} to="/unidad" linkLabel={translate("Revisar unidades")} />
      <div className="map-layout">
        <div className="map-frame">
          {simulando ? (
            <p className="sim-banner" role="status">
              <span className="sim-banner__dot" aria-hidden="true" />
              {translate("Simulación activa · las unidades SIM y sus alertas no son mediciones reales")}
              {/* El reloj acelerado: cinco minutos de pantalla son cinco
                  horas de operación. Sin decirlo, un tren que cruza
                  300 km durante la demo no cuadra. */}
              {relojSim ? (
                <span className="sim-banner__clock">
                  {relojSim} <b>×{FACTOR_TIEMPO}</b>
                </span>
              ) : null}
            </p>
          ) : null}
          <MapContainer center={CENTRO} zoom={8} className="map">
            <TileLayer
              // Teselas de OpenStreetMap: la atribución es obligatoria
              // por su licencia.
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <SimulationLayer
              onReloj={setRelojSim}
              ruta={railRoute}
              activa={simulando}
              onDefectos={setDefectosSim}
            />

            <TrackDefectLayer
              defects={simulando ? defectosSim : (defectos.data?.defects ?? [])}
              mostrarIndicios={verIndicios}
            />

            <LiveMapLayers onTelemetria={recibirTelemetria} railRoute={railRoute} torres={torres} />

            <FitMapToData route={railRoute} connections={railConnections} />
            {railConnections.map((connection) => (
              <Polyline
                key={connection.name}
                positions={connection.segments}
                pathOptions={{ color: '#2E7D32', weight: 4 }}
              >
                <Tooltip sticky>{translate(connection.name === 'Línea G' ? 'Línea G · Centro del país' : 'Línea K · Juchitán / Centroamérica')}</Tooltip>
              </Polyline>
            ))}
            {railRoute.length > 1 && (
              <Polyline positions={railRoute} pathOptions={{ color: '#2E7D32', weight: 4 }}>
                <Tooltip sticky>{translate("Línea Z · Coatzacoalcos–Salina Cruz")}</Tooltip>
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
                <Tooltip direction="top" offset={[0, -7]}>{translate(point.name)}</Tooltip>
                <Popup>
                  <span className="industrial-park-popup">{translate("Polo de desarrollo")}</span>
                  <strong>{translate(point.name)}</strong>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

        <aside className="map-side">
          {translate(mapDataError && <p className="map-hint" role="alert">{translate(mapDataError)}</p>)}

          {state.loading ? (
            <Loading label={translate("Cargando nodos…")} />
          ) : state.error ? (
            <ErrorState error={state.error} onRetry={state.reload} />
          ) : (
            <>
              <TrackDefectSummary
                estado={
                  simulando
                    ? { data: { windowDays: 0, analyzed: defectosSim.length, defects: defectosSim }, loading: false, error: null }
                    : defectos
                }
                verIndicios={verIndicios}
                onVerIndicios={setVerIndicios}
              />
              <label className="sim-toggle">
                <input
                  type="checkbox"
                  checked={simulando}
                  onChange={(e) => setSimulando(e.target.checked)}
                />{translate("Simular corredor en vivo")}</label>
              <NodeStatusPanel units={state.data} ultimaTelemetria={ultimaTelemetria} />
            </>
          )}
        </aside>
      </div>
    </>
  );
}
