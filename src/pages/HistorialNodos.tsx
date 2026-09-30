import { t as translate, locale } from '../accessibility/i18n';
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api/client";
import { useApi } from "../api/useApi";
import type { NodeHistoryPage, TelemetryPoint } from "../api/types";
import { chartPalette } from "../lib/chartColors";
import { useColorMode } from "../hooks/useColorMode";
import "./tables.css";
import "./gestion.css";
import "./historial.css";
const localInput = (time: number) => {
  const d = new Date(time);
  return new Date(time - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 19);
};
const dateLabel = (value: string) => new Date(value).toLocaleString(locale());
const numberLabel = (value: number | null | undefined, digits = 3) =>
  value == null
    ? "—"
    : value.toLocaleString(locale(), { maximumFractionDigits: digits });
const vector = (
  x: number | null | undefined,
  y: number | null | undefined,
  z: number | null | undefined,
) =>
  [x, y, z].every((v) => v == null)
    ? "—"
    : [x, y, z].map((v) => numberLabel(v)).join(" / ");
const metrics = {
  accel: {
    label: "Acelerómetro",
    unit: "g",
    keys: ["accelX", "accelY", "accelZ"],
  },
  gyro: {
    label: "Giroscopio",
    unit: "rad/s",
    keys: ["gyroX", "gyroY", "gyroZ"],
  },
  mag: { label: "Magnetómetro", unit: "µT", keys: ["magX", "magY", "magZ"] },
  speed: { label: "Velocidad almacenada", unit: "km/h", keys: ["speedKmh"] },
  light: { label: "Luz", unit: "lux", keys: ["lux"] },
  pressure: { label: "Presión", unit: "hPa", keys: ["pressureHpa"] },
} as const;
type Metric = keyof typeof metrics;
interface Query {
  nodeId: string;
  from: string;
  to: string;
  limit: number;
}
function exportPage(rows: TelemetryPoint[], node: string) {
  const headers = [
    "Nodo",
    "Capturado (UTC)",
    "Recibido (UTC)",
    "Secuencia",
    "Accel X (g)",
    "Accel Y (g)",
    "Accel Z (g)",
    "Gyro X (rad/s)",
    "Gyro Y (rad/s)",
    "Gyro Z (rad/s)",
    "Mag X (µT)",
    "Mag Y (µT)",
    "Mag Z (µT)",
    "Luz (lux)",
    "Presión (hPa)",
    "Latitud",
    "Longitud",
    "Velocidad almacenada (km/h)",
    "Precisión GPS (m)",
  ];
  const escape = (value: unknown) => {
    let text = String(value ?? "");
    if (typeof value === "string" && /^\s*[=+\-@]/.test(text))
      text = "'" + text;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const body = [
    headers.map(translate),
    ...rows.map((r) => [
      r.nodeCode,
      r.ts,
      r.receivedAt,
      r.seq,
      r.accelX,
      r.accelY,
      r.accelZ,
      r.gyroX,
      r.gyroY,
      r.gyroZ,
      r.magX,
      r.magY,
      r.magZ,
      r.lux,
      r.pressureHpa,
      r.gpsLat,
      r.gpsLon,
      r.gpsSpeedMs == null ? null : r.gpsSpeedMs * 3.6,
      r.gpsAccuracyM,
    ]),
  ]
    .map((row) => row.map(escape).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\uFEFF" + body], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `historial-${node.replace(/[^a-zA-Z0-9_-]/g, "_")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
export default function HistorialNodos() {
  const [params] = useSearchParams();
  const nodes = useApi(() => api.listHistoryNodes(), []);
  const [chosen, setChosen] = useState(params.get("nodo") ?? "");
  const nodeId = chosen || nodes.data?.[0]?.id || "";
  const [from, setFrom] = useState(() => localInput(Date.now() - 86400000));
  const [to, setTo] = useState(() => localInput(Date.now() + 1000));
  const [limit, setLimit] = useState(100);
  const [query, setQuery] = useState<Query | null>(null);
  const [error, setError] = useState("");
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [page, setPage] = useState(0);
  const [metric, setMetric] = useState<Metric>("accel");
  const data = useApi<NodeHistoryPage | null>(
    () =>
      query
        ? api.nodeHistory({ ...query, cursor: cursors[page] })
        : Promise.resolve(null),
    [query?.nodeId, query?.from, query?.to, query?.limit, cursors[page]],
  );
  const activeNode = nodes.data?.find((n) => n.id === query?.nodeId);
  const { mode } = useColorMode();
  const palette = chartPalette(mode === "dark");
  const chart = useMemo(
    () =>
      [...(data.data?.items ?? [])].reverse().map((r) => ({
        ...r,
        time: new Date(r.ts).getTime(),
        speedKmh: r.gpsSpeedMs == null ? null : r.gpsSpeedMs * 3.6,
      })),
    [data.data],
  );
  const definition = metrics[metric];
  const hasMetric = chart.some((r) =>
    definition.keys.some((k) => r[k] != null),
  );
  function consult(start = from, end = to) {
    if (!nodeId) {
      setError("Selecciona un nodo.");
      return;
    }
    const a = new Date(start),
      b = new Date(end);
    if (
      !Number.isFinite(a.getTime()) ||
      !Number.isFinite(b.getTime()) ||
      a > b
    ) {
      setError("Revisa las fechas: el inicio debe ser anterior al final.");
      return;
    }
    if (b.getTime() - a.getTime() > 31 * 86400000) {
      setError("Consulta periodos de hasta 31 días.");
      return;
    }
    setError("");
    setPage(0);
    setCursors([undefined]);
    setQuery({ nodeId, from: a.toISOString(), to: b.toISOString(), limit });
    data.reload();
  }
  function preset(hours: number) {
    const end = localInput(Date.now() + 1000),
      start = localInput(Date.now() - hours * 3600000);
    setFrom(start);
    setTo(end);
    consult(start, end);
  }
  return (
    <>
      <div className="page-head history-page-head">
        <div>
          <h1>{translate("Historial de nodos")}</h1>
          <p>{translate("Consulta las lecturas guardadas de un dispositivo, aunque esté desconectado o archivado.")}</p>
        </div>
      </div>
      {nodes.loading ? (
        <p role="status">{translate("Cargando nodos…")}</p>
      ) : nodes.error ? (
        <div role="alert">
          {translate(nodes.error.userMessage)}
          <button className="btn" onClick={nodes.reload}>{translate("Reintentar")}</button>
        </div>
      ) : !nodes.data?.length ? (
        <p>{translate("No hay nodos disponibles para tu cuenta.")}</p>
      ) : (
        <form
          className="user-form"
          onSubmit={(e) => {
            e.preventDefault();
            consult();
          }}
        >
          <div className="management-fields">
            <label className="field">{translate("Nodo")}<select
                aria-label={translate("Nodo")}
                value={nodeId}
                onChange={(e) => setChosen(e.target.value)}
              >
                {nodes.data.map((n) => (
                  <option key={n.id} value={n.id}>
                    {translate(n.nodeCode)} · {translate(n.unitLabel ?? n.unitCode)} ·{" "}
                    {translate(n.role === "primary" ? "Principal" : "Respaldo")}
                    {translate(n.active ? "" : " · Archivado")}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">{translate("Desde")}<input
                aria-label={translate("Desde")}
                type="datetime-local"
                step="1"
                required
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label className="field">{translate("Hasta")}<input
                aria-label={translate("Hasta")}
                type="datetime-local"
                step="1"
                required
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
            <label className="field">{translate("Lecturas por página")}<select
                aria-label={translate("Lecturas por página")}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
              >
                {[50, 100, 200].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="management-toolbar">
            <button
              className="btn btn-primary history-consult-btn"
              disabled={data.loading}
            >
              {translate("Consultar historial")}
            </button>
            <button className="btn" type="button" onClick={() => preset(1)}>{translate("Última hora")}</button>
            <button className="btn" type="button" onClick={() => preset(24)}>{translate("Últimas 24 horas")}</button>
            <button className="btn" type="button" onClick={() => preset(168)}>{translate("Últimos 7 días")}</button>
            <span>{translate("Fechas en tu hora local · hasta 31 días por consulta")}</span>
          </div>
        </form>
      )}
      {translate(error && (
        <p className="user-error" role="alert">
          {translate(error)}
        </p>
      ))}
      {!query ? (
        <p>{translate("Selecciona el nodo y pulsa Consultar historial.")}</p>
      ) : data.loading ? (
        <p role="status">{translate("Consultando lecturas…")}</p>
      ) : data.error ? (
        <div role="alert">
          {translate(data.error.userMessage)}
          <button className="btn" onClick={data.reload}>{translate("Reintentar")}</button>
        </div>
      ) : !data.data?.items.length ? (
        <p>{translate("No hay lecturas guardadas para este nodo en el periodo seleccionado.")}</p>
      ) : (
        <>
          <div className="history-summary">
            <strong>
              {translate(activeNode?.nodeCode ?? "Nodo seleccionado")} ·{" "}
              {data.data.items.length}{translate(" lecturas en esta página")}</strong>
            <span>
              {translate(dateLabel(query.from))} — {translate(dateLabel(query.to))}
            </span>
            <span>{translate("Capturado: ")}{translate(dateLabel(data.data.items.at(-1)!.ts))} —{" "}
              {translate(dateLabel(data.data.items[0].ts))}
            </span>
          </div>
          <section className="user-form">
            <div className="management-toolbar">
              <label className="field">{translate("Variable")}<select
                  aria-label={translate("Variable")}
                  value={metric}
                  onChange={(e) => setMetric(e.target.value as Metric)}
                >
                  {Object.entries(metrics).map(([key, m]) => (
                    <option key={key} value={key}>
                      {translate(m.label)} ({translate(m.unit)})
                    </option>
                  ))}
                </select>
              </label>
              <span>{translate("La gráfica muestra únicamente las lecturas de esta página, en orden temporal.")}</span>
            </div>
            {hasMetric ? (
              <div
                className="history-chart"
                role="img"
                aria-label={translate(`Historial de ${definition.label}`)}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chart}
                    margin={{ top: 12, right: 20, left: 8, bottom: 16 }}
                  >
                    <CartesianGrid
                      stroke={palette.grid}
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      dataKey="time"
                      type="number"
                      domain={["dataMin", "dataMax"]}
                      tickFormatter={(value) =>
                        new Date(value).toLocaleTimeString(locale())
                      }
                      stroke={palette.axis}
                    />
                    <YAxis stroke={palette.axis} width={65} />
                    <Tooltip
                      labelFormatter={(value) =>
                        new Date(Number(value)).toLocaleString(locale())
                      }
                      contentStyle={{
                        background: palette.surface,
                        color: palette.textPrimary,
                        borderColor: palette.grid,
                      }}
                    />
                    <Legend />
                    {definition.keys.map((key, i) => (
                      <Line
                        key={key}
                        type="linear"
                        dataKey={key}
                        name={
                          translate(definition.keys.length > 1
                            ? `${["X", "Y", "Z"][i]} (${definition.unit})`
                            : `${definition.label} (${definition.unit})`)
                        }
                        stroke={
                          definition.keys.length === 1
                            ? palette.seriesSpeed
                            : [
                                palette.seriesX,
                                palette.seriesY,
                                palette.seriesZ,
                              ][i]
                        }
                        connectNulls={false}
                        dot={chart.length < 10}
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p>{translate("No se registró esta variable en las lecturas de la página.")}</p>
            )}
          </section>
          <div className="management-toolbar">
            <button
              className="btn"
              onClick={() =>
                exportPage(data.data!.items, activeNode?.nodeCode ?? "nodo")
              }
            >{translate("Descargar página CSV")}</button>
            <span>{translate("Valores ausentes: — · Velocidad según la fuente almacenada; puede ser estimada por el nodo.")}</span>
          </div>
          <div className="table-wrap">
            <table className="table history-table">
              <thead>
                <tr>
                  <th>{translate("Capturado")}</th>
                  <th>{translate("Recibido")}</th>
                  <th>{translate("Demora")}</th>
                  <th>{translate("Secuencia")}</th>
                  <th>{translate("Aceleración X/Y/Z (g)")}</th>
                  <th>{translate("Giro X/Y/Z (rad/s)")}</th>
                  <th>{translate("Magnetómetro X/Y/Z (µT)")}</th>
                  <th>{translate("Luz (lux)")}</th>
                  <th>{translate("Presión (hPa)")}</th>
                  <th>{translate("Ubicación GPS")}</th>
                  <th>{translate("Velocidad (km/h)")}</th>
                  <th>{translate("Precisión GPS (m)")}</th>
                </tr>
              </thead>
              <tbody>
                {data.data.items.map((row) => {
                  const delay =
                    (new Date(row.receivedAt).getTime() -
                      new Date(row.ts).getTime()) /
                    1000;
                  return (
                    <tr key={`${row.id}-${row.ts}`}>
                      <td>{translate(dateLabel(row.ts))}</td>
                      <td>{translate(dateLabel(row.receivedAt))}</td>
                      <td>
                        {translate(delay < 0
                          ? "Reloj desfasado"
                          : `${numberLabel(delay, 1)} s`)}
                        {delay > 30 && (
                          <span className="tag">{translate("Recepción tardía")}</span>
                        )}
                      </td>
                      <td>{row.seq}</td>
                      <td>{translate(vector(row.accelX, row.accelY, row.accelZ))}</td>
                      <td>{translate(vector(row.gyroX, row.gyroY, row.gyroZ))}</td>
                      <td>{translate(vector(row.magX, row.magY, row.magZ))}</td>
                      <td>{translate(numberLabel(row.lux))}</td>
                      <td>{translate(numberLabel(row.pressureHpa))}</td>
                      <td>
                        {translate(row.gpsLat == null || row.gpsLon == null
                          ? "—"
                          : `${numberLabel(row.gpsLat, 6)}, ${numberLabel(row.gpsLon, 6)}`)}
                      </td>
                      <td>
                        {translate(numberLabel(
                          row.gpsSpeedMs == null ? null : row.gpsSpeedMs * 3.6,
                          2,
                        ))}
                      </td>
                      <td>{translate(numberLabel(row.gpsAccuracyM, 1))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="management-toolbar">
            <button
              className="btn"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >{translate("Más recientes")}</button>
            <span>{translate("Página ")}{page + 1}</span>
            <button
              className="btn"
              disabled={!data.data.nextCursor}
              onClick={() => {
                setCursors([
                  ...cursors.slice(0, page + 1),
                  data.data!.nextCursor!,
                ]);
                setPage(page + 1);
              }}
            >{translate("Más antiguas")}</button>
          </div>
        </>
      )}
    </>
  );
}
