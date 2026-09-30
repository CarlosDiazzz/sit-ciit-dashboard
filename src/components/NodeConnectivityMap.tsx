import { useEffect, useState } from "react";
import { latLngBounds } from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import { api, type ConnectivityEvent } from "../api/client";

function Fit({ events }: { events: ConnectivityEvent[] }) {
  const map = useMap();
  useEffect(() => {
    if (events.length)
      map.fitBounds(latLngBounds(events.map((e) => [e.gpsLat!, e.gpsLon!])), {
        padding: [30, 30],
        maxZoom: 14,
      });
  }, [events, map]);
  return null;
}
export default function NodeConnectivityMap({
  nodeId,
  nodeCode,
}: {
  nodeId: string;
  nodeCode: string;
}) {
  const [data, setData] = useState<{
    items: ConnectivityEvent[];
    hasMore: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    async function load() {
      const now = new Date();
      try {
        const result = await api.nodeConnectivity(
          nodeId,
          new Date(now.getTime() - days * 86400000).toISOString(),
          now.toISOString(),
        );
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      } catch (e) {
        if (!cancelled)
          setError(
            e instanceof Error
              ? e.message
              : "No se pudo consultar la conectividad.",
          );
      }
    }
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [nodeId, days]);
  const located = (data?.items ?? []).filter(
    (e) =>
      e.gpsLat != null &&
      e.gpsLon != null &&
      Number.isFinite(e.gpsLat) &&
      Number.isFinite(e.gpsLon),
  );
  const lost = data?.items.filter((e) => e.kind === "signal_lost").length ?? 0;
  const restored =
    data?.items.filter((e) => e.kind === "signal_recovered").length ?? 0;
  return (
    <section className="chart-card" aria-label={`Conectividad de ${nodeCode}`}>
      <div className="card-head">
        <h2>Pérdidas y recuperaciones de señal</h2>
        <label className="field">
          <span>Periodo de conectividad</span>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={1}>Últimas 24 horas</option>
            <option value={7}>Últimos 7 días</option>
            <option value={30}>Últimos 30 días</option>
          </select>
        </label>
      </div>
      <p>
        Interrupciones de comunicación detectadas por el servidor. La pérdida
        muestra la última posición GPS conocida; la recuperación muestra la
        primera captura GPS posterior, si llegó en los siguientes 5 minutos.
      </p>
      <p className="chart-meta">Las recuperaciones se registran desde la activación de esta función; los eventos anteriores pueden mostrar solo la pérdida.</p>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p>Cargando conectividad…</p>}
      {data && (
        <>
          <div className="connectivity-legend">
            <span>🔴 Pérdidas: {lost}</span>
            <span>🟢 Recuperaciones: {restored}</span>
            <span>Sin ubicación GPS: {data.items.length - located.length}</span>
          </div>
          {data.hasMore && (
            <p>
              Se muestran los 200 eventos más recientes. Selecciona un periodo
              más corto para revisar los anteriores.
            </p>
          )}
          {located.length ? (
            <MapContainer
              center={[located[0]!.gpsLat!, located[0]!.gpsLon!]}
              zoom={13}
              className="connectivity-map"
              aria-label="Mapa de conectividad"
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              <Fit events={located} />
              {located.map((e) => (
                <CircleMarker
                  key={e.id}
                  center={[e.gpsLat!, e.gpsLon!]}
                  radius={8}
                  pathOptions={{
                    color: e.kind === "signal_lost" ? "#b42318" : "#15803d",
                    fillOpacity: 0.8,
                  }}
                >
                  <Popup>
                    <strong>
                      {e.kind === "signal_lost"
                        ? "Señal perdida"
                        : "Señal recuperada"}{" "}
                      · {nodeCode}
                    </strong>
                    <br />
                    Detección: {new Date(e.ts).toLocaleString("es-MX")}
                    <br />
                    {e.positionTs
                      ? `Captura GPS: ${new Date(e.positionTs).toLocaleString("es-MX")}`
                      : "Última posición conocida; fecha de captura no disponible."}
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          ) : (
            <p className="chart-hint">
              {data.items.length
                ? "Los eventos registrados no tienen ubicación GPS disponible."
                : "Sin interrupciones registradas en este periodo."}
            </p>
          )}
        </>
      )}
    </section>
  );
}
