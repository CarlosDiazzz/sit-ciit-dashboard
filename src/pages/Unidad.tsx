import DecisionBrief from "../components/DecisionBrief";
/* Vista Unidad: monitoreo del nodo seleccionado y su conectividad.
 *
 * La telemetría llega por Socket.IO: el backend reemite cada mensaje que
 * guarda con éxito. La velocidad sale únicamente de `gps.speedMs` (la
 * calcula el GPS del celular) — no se deriva ni se estima aquí.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { useSocketEvent } from "../api/socket";
import { useApi } from "../api/useApi";
import type {
  RiskRule,
  TelemetryBroadcast,
  TelemetryPoint,
  Unit,
} from "../api/types";
import { useSession } from "../auth/context";
import { ConnectionBadge, MovementBadge } from "../components/Badges";
import NodeConnectivityMap from "../components/NodeConnectivityMap";
import SpeedGauge from "../components/SpeedGauge";
import AttitudeIndicator from "../components/AttitudeIndicator";
import { actitudDesde } from "../lib/actitud";
import { ErrorState, Loading } from "../components/States";
import WeatherRiskPanel from "../components/WeatherRiskPanel";
import { chartPalette } from "../lib/chartColors";
import { formatAgo, formatNumber } from "../lib/format";
import { useColorMode } from "../hooks/useColorMode";
import "./tables.css";
import "./unidad.css";

const ROLE_LABEL = { primary: "Primario", backup: "Respaldo" } as const;

/** Puntos visibles en las gráficas. A ~1 Hz son alrededor de un minuto
 *  de historia, suficiente para ver un impacto sin saturar el render. */
const MAX_POINTS = 60;

/** Un salto mayor a esto entre dos muestras es una interrupcion, no el
 *  ritmo normal de publicacion (1 Hz). Se corta la linea ahi: unir los
 *  extremos dibujaria una transicion suave donde en realidad no hubo
 *  datos, que es afirmar algo que no se midio. */
const HUECO_MS = 10_000;

/** Inserta un punto vacio donde hay una interrupcion, para que las
 *  series se corten en vez de cruzar el hueco. */
function marcarHuecos(puntos: ChartPoint[]): ChartPoint[] {
  const salida: ChartPoint[] = [];
  for (let i = 0; i < puntos.length; i += 1) {
    const p = puntos[i]!;
    const anterior = puntos[i - 1];
    if (anterior && p.ts - anterior.ts > HUECO_MS) {
      salida.push({
        ts: anterior.ts + 1,
        time: "",
        x: null,
        y: null,
        z: null,
        magnitude: null,
        speedKmh: null,
        rotacion: null,
      });
    }
    salida.push(p);
  }
  return salida;
}

interface ChartPoint {
  ts: number;
  time: string;
  x: number | null;
  y: number | null;
  z: number | null;
  magnitude: number | null;
  speedKmh: number | null;
  /** Magnitud de la velocidad angular en rad/s. Va en su propia grafica:
   *  mezclarla con la aceleracion en un mismo eje seria engañoso, son
   *  magnitudes distintas. */
  rotacion: number | null;
}

/** Convierte una muestra guardada al mismo formato de la telemetría en vivo. */
function toBroadcast(
  unitCode: string,
  row: TelemetryPoint,
): TelemetryBroadcast {
  return {
    nodeId: row.nodeCode,
    unitId: unitCode,
    role: row.role,
    seq: row.seq,
    ts: new Date(row.ts).getTime(),
    receivedAt: new Date(row.receivedAt).getTime(),
    accel:
      row.accelX != null && row.accelY != null && row.accelZ != null
        ? { x: row.accelX, y: row.accelY, z: row.accelZ }
        : undefined,
    gyro:
      row.gyroX != null && row.gyroY != null && row.gyroZ != null
        ? { x: row.gyroX, y: row.gyroY, z: row.gyroZ }
        : undefined,
    mag:
      row.magX != null && row.magY != null && row.magZ != null
        ? { x: row.magX, y: row.magY, z: row.magZ }
        : undefined,
    lux: row.lux ?? undefined,
    pressureHpa: row.pressureHpa ?? undefined,
    gps:
      row.gpsLat != null && row.gpsLon != null
        ? {
            lat: row.gpsLat,
            lon: row.gpsLon,
            speedMs: row.gpsSpeedMs ?? undefined,
            accuracyM: row.gpsAccuracyM ?? undefined,
          }
        : undefined,
  };
}

function toChartPoint(row: TelemetryPoint): ChartPoint {
  const { accelX, accelY, accelZ, gyroX, gyroY, gyroZ } = row;
  return {
    ts: new Date(row.ts).getTime(),
    time: new Date(row.ts).toLocaleTimeString("es-MX", { hour12: false }),
    x: accelX,
    y: accelY,
    z: accelZ,
    magnitude:
      accelX != null && accelY != null && accelZ != null
        ? Math.sqrt(accelX ** 2 + accelY ** 2 + accelZ ** 2)
        : null,
    speedKmh: row.gpsSpeedMs != null ? row.gpsSpeedMs * 3.6 : null,
    rotacion:
      gyroX != null && gyroY != null && gyroZ != null
        ? Math.sqrt(gyroX ** 2 + gyroY ** 2 + gyroZ ** 2)
        : null,
  };
}

// Indicador instantáneo de movimiento a partir del acelerómetro (no una
// velocidad: el GPS es la única fuente de eso, ver nota arriba).
// Histéresis para no parpadear en el umbral: entra al superar ENTER,
// solo sale al bajar de EXIT. Reacciona en el siguiente sample (~1 s),
// más rápido que el km/h del GPS, como complemento mientras ese número
// se confirma — la misma señal que decide en el celular cuándo pedirle
// al GPS una lectura anticipada (ver sit-ciit-mobile).
const MOVEMENT_ENTER_G = 0.08;
const MOVEMENT_EXIT_G = 0.03;

export default function Unidad() {
  const state = useApi<Unit[]>(() => api.listUnits());
  // Tabla de referencia de umbrales: es la misma para todas las unidades.
  const riskRulesState = useApi<RiskRule[]>(() => api.listRiskRules());
  const { mode } = useColorMode();
  const colors = chartPalette(mode === "dark");
  const { user } = useSession();
  const canEditCargoCategory = ["admin", "control_center"].includes(
    user?.role ?? "",
  );

  // Búsqueda en el selector, sin desplegar tarjetas de otros nodos.
  const [filtro, setFiltro] = useState("");

  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [lastByNode, setLastByNode] = useState<Record<string, TelemetryBroadcast>>({});
  // ?nodo=unit-01-b abre la vista ya centrada en ese nodo. Lo usa el
  // enlace desde un evento: sin esto el operador aterrizaba en la vista
  // general y tenia que buscar cual estaba revisando.
  const [params] = useSearchParams();
  const nodoPedido = params.get('nodo');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(nodoPedido);
  const [isMoving, setIsMoving] = useState(false);
  // Reloj compartido: hace que los "hace N s" de las tarjetas avancen
  // aunque no llegue telemetria nueva (asi se ve que un nodo se callo).
  const [ahora, setAhora] = useState(() => Date.now());
  const isMovingRef = useRef(false);
  const movementEmaRef = useRef(0);

  // El manejador del socket se recrea al cambiar de nodo; la ref permite
  // leer la selección vigente sin volver a suscribirse en cada cambio.
  // Arranca con el nodo de la URL: si quedara en null, el primer
  // mensaje del socket pisaria la seleccion pedida.
  const selectedRef = useRef<string | null>(nodoPedido);

  const selectNode = useCallback((nodeId: string) => {
    selectedRef.current = nodeId;
    setSelectedNodeId(nodeId);
    setPoints([]);
    movementEmaRef.current = 0;
    isMovingRef.current = false;
    setIsMoving(false);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const onTelemetry = useCallback((evt: TelemetryBroadcast) => {
    if (evt.nodeId !== selectedRef.current) return;
    setLastByNode((prev) => {
      const old = prev[evt.nodeId];
      return old && old.ts > evt.ts ? prev : { ...prev, [evt.nodeId]: evt };
    });

    const speedKmh = evt.gps?.speedMs != null ? evt.gps.speedMs * 3.6 : null;
    if (!evt.accel && !evt.gyro && speedKmh == null) return;

    const a = evt.accel;
    const g = evt.gyro;

    if (a) {
      const magnitude = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
      const deviation = Math.abs(magnitude - 1);
      movementEmaRef.current = movementEmaRef.current * 0.7 + deviation * 0.3;
      const nextIsMoving = isMovingRef.current
        ? movementEmaRef.current > MOVEMENT_EXIT_G
        : movementEmaRef.current > MOVEMENT_ENTER_G;
      if (nextIsMoving !== isMovingRef.current) {
        isMovingRef.current = nextIsMoving;
        setIsMoving(nextIsMoving);
      }
    }

    setPoints((prev) => {
      const point: ChartPoint = {
        ts: evt.ts,
        time: new Date(evt.ts).toLocaleTimeString("es-MX", { hour12: false }),
        x: a?.x ?? null,
        y: a?.y ?? null,
        z: a?.z ?? null,
        magnitude: a ? Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z) : null,
        speedKmh,
        rotacion: g ? Math.sqrt(g.x * g.x + g.y * g.y + g.z * g.z) : null,
      };
      const byTs = new Map(prev.filter((p) => p.time).map((p) => [p.ts, p]));
      byTs.set(point.ts, point);
      return marcarHuecos(
        [...byTs.values()].sort((a, b) => a.ts - b.ts).slice(-MAX_POINTS),
      );
    });
  }, []);

  useSocketEvent("telemetry", onTelemetry);

  const catalog = useMemo(
    () =>
      (state.data ?? []).flatMap((unit) =>
        unit.nodes.map((node) => ({ unit, node })),
      ),
    [state.data],
  );
  const selected = catalog.find(
    (item) => item.node.nodeCode === selectedNodeId,
  );
  const filtered = catalog.filter(({ unit, node }) =>
    `${node.nodeCode} ${unit.unitCode} ${unit.label ?? ""}`
      .toLowerCase()
      .includes(filtro.trim().toLowerCase()),
  );
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  useEffect(() => {
    if (!selectedNodeId && catalog.length)
      selectNode(catalog[0]!.node.nodeCode);
  }, [catalog, selectedNodeId, selectNode]);
  const selectedUuid = selected?.node.id;
  const selectedCode = selected?.node.nodeCode;
  const selectedUnitCode = selected?.unit.unitCode;
  useEffect(() => {
    if (!selectedUuid || !selectedCode || !selectedUnitCode) return;
    let cancelled = false;
    setHistoryError(null);
    setHistoryLoading(true);
    const to = new Date();
    void api
      .nodeHistory({
        nodeId: selectedUuid,
        from: new Date(to.getTime() - 86400000).toISOString(),
        to: to.toISOString(),
        limit: MAX_POINTS,
      })
      .then((page) => {
        if (cancelled) return;
        const rows = page.items.filter((row) => row.nodeCode === selectedCode);
        const latest = rows[0];
        if (latest)
          setLastByNode((prev) => {
            const old = prev[latest.nodeCode];
            const value = toBroadcast(selectedUnitCode, latest);
            return {
              ...prev,
              [latest.nodeCode]: old && old.ts > value.ts ? old : value,
            };
          });
        setPoints((prev) => {
          const byTs = new Map(
            rows.map((row) => {
              const point = toChartPoint(row);
              return [point.ts, point] as const;
            }),
          );
          prev
            .filter((point) => point.time)
            .forEach((point) => byTs.set(point.ts, point));
          return marcarHuecos(
            [...byTs.values()].sort((a, b) => a.ts - b.ts).slice(-MAX_POINTS),
          );
        });
      })
      .catch((error) => {
        if (!cancelled)
          setHistoryError(
            error instanceof Error
              ? error.message
              : "No se pudo cargar la telemetría.",
          );
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedUuid, selectedCode, selectedUnitCode]);
  useEffect(() => {
    const timer = setInterval(state.reload, 15000);
    return () => clearInterval(timer);
  }, [state.reload]);
  const ultimo = points.at(-1);

  const ejeComun = {
    stroke: colors.axis,
    tick: { fill: colors.muted, fontSize: 12 },
  };
  const tooltipComun = {
    contentStyle: {
      background: colors.surface,
      border: `1px solid ${colors.grid}`,
      fontSize: 12,
    },
    labelStyle: { color: colors.textSecondary },
  };

  return (
    <>
      <div className="page-head">
        <div>
          <span className="dss-kicker">TONATIUH / MONITOREO</span>
          <h1>Monitoreo de nodo</h1>
          <p>Gráficas, recomendaciones y conectividad del nodo seleccionado.</p>
        </div>
      </div>
      <div className="focused-selector">
        <label className="field">
          <span>Buscar nodo o unidad</span>
          <input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Código de nodo o unidad…"
          />
        </label>
        <label className="field">
          <span>Nodo seleccionado</span>
          <select
            value={selectedNodeId ?? ""}
            onChange={(e) => selectNode(e.target.value)}
          >
            {!selectedNodeId && <option value="">Seleccionar nodo</option>}
            {selected &&
              !filtered.some((item) => item.node.id === selected.node.id) && (
                <option value={selected.node.nodeCode}>
                  {selected.node.nodeCode} ·{" "}
                  {selected.unit.label ?? selected.unit.unitCode}
                </option>
              )}
            {filtered.map(({ unit, node }) => (
              <option key={node.id} value={node.nodeCode}>
                {node.nodeCode} · {unit.label ?? unit.unitCode} ·{" "}
                {ROLE_LABEL[node.role]}
              </option>
            ))}
          </select>
        </label>
        {filtro && !filtered.length && (
          <p>Sin coincidencias para «{filtro}».</p>
        )}
      </div>
      {state.loading && !state.data && <Loading label="Cargando nodos…" />}
      {state.error && <ErrorState error={state.error} onRetry={state.reload} />}
      {!state.loading && !state.error && !catalog.length && (
        <p>No hay nodos registrados.</p>
      )}
      {selected && (
        <section className="chart-card focused-summary">
          <div className="card-head">
            <h2>{selected.node.nodeCode}</h2>
            <ConnectionBadge online={selected.node.isOnline} />
          </div>
          <dl>
            <div>
              <dt>Unidad</dt>
              <dd>{selected.unit.label ?? selected.unit.unitCode}</dd>
            </div>
            <div>
              <dt>Función</dt>
              <dd>
                {ROLE_LABEL[selected.node.role]}
                {selected.unit.activeNodeId === selected.node.id
                  ? " · fuente activa"
                  : ""}
              </dd>
            </div>
            <div>
              <dt>Último heartbeat</dt>
              <dd>{formatAgo(selected.node.lastHeartbeatAt)}</dd>
            </div>
            <div>
              <dt>Batería</dt>
              <dd>
                {selected.node.batteryPct == null
                  ? "—"
                  : `${formatNumber(selected.node.batteryPct, 0)} %`}
              </dd>
            </div>
            <div>
              <dt>Cola pendiente</dt>
              <dd>{selected.node.pendingOutbox ?? "—"}</dd>
            </div>
            <div>
              <dt>Última muestra</dt>
              <dd>
                {selectedNodeId && lastByNode[selectedNodeId]
                  ? formatAgo(
                      new Date(
                        lastByNode[selectedNodeId].receivedAt,
                      ).toISOString(),
                    )
                  : "Sin lecturas"}
              </dd>
            </div>
          </dl>
          {selectedNodeId &&
            lastByNode[selectedNodeId] &&
            ahora - lastByNode[selectedNodeId].receivedAt > 15000 && (
              <p role="status">
                La última lectura está retenida; no confirma el movimiento
                actual.
              </p>
            )}
        </section>
      )}

      <DecisionBrief
        title={
          selectedNodeId
            ? `Fuente observada: ${selectedNodeId}`
            : "Aún no hay una fuente para evaluar"
        }
        evidence={
          selectedNodeId && lastByNode[selectedNodeId]
            ? `Última recepción: ${formatAgo(new Date(lastByNode[selectedNodeId].receivedAt).toISOString())}. Las gráficas conservan hasta 60 muestras recibidas en esta sesión; una lectura retenida no garantiza el estado actual.`
            : "Esperando telemetría. Sin lecturas no se puede determinar el movimiento ni el estado de la carga."
        }
        action={
          selected?.node.isOnline
            ? "Revisa las gráficas y los riesgos de la carga. Ante un cambio brusco, consulta las incidencias y confirma con el operador."
            : "Verifica la conexión del nodo y su cola pendiente. Consulta el mapa para revisar las interrupciones registradas."
        }
        to="/eventos"
        linkLabel="Revisar incidencias"
      />
      {selected && (
        <NodeConnectivityMap
          key={selected.node.id}
          nodeId={selected.node.id}
          nodeCode={selected.node.nodeCode}
        />
      )}
      {historyError && <p role="alert">{historyError}</p>}

      {points.length === 0 ? (
        <section className="chart-card">
          <p className="chart-hint">
            {historyLoading
              ? "Cargando las últimas muestras…"
              : "Sin muestras del nodo seleccionado en las últimas 24 horas. Esperando telemetría en vivo."}
          </p>
        </section>
      ) : (
        <div className="live-grid">
          <AttitudeIndicator
            actitud={actitudDesde(
              selectedNodeId ? lastByNode[selectedNodeId] : undefined,
            )}
            nodeCode={selectedNodeId}
          />

          <section className="chart-card">
            <div className="card-head">
              <h2>Aceleración</h2>
              <span className="chart-meta mono">{selectedNodeId}</span>
            </div>
            <div className="chart-frame">
              <ResponsiveContainer>
                <LineChart
                  data={points}
                  margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid stroke={colors.grid} vertical={false} />
                  <XAxis dataKey="time" minTickGap={40} {...ejeComun} />
                  <YAxis domain={["auto", "auto"]} {...ejeComun} />
                  <Tooltip {...tooltipComun} />
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: colors.textSecondary }}
                  />
                  <Line
                    type="monotone"
                    dataKey="x"
                    stroke={colors.seriesX}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="y"
                    stroke={colors.seriesY}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="z"
                    stroke={colors.seriesZ}
                    dot={false}
                    isAnimationActive={false}
                  />
                  {/* |a| es la derivada de las tres series, no una cuarta
                      categoría: tinta neutra y trazo punteado. */}
                  <Line
                    type="monotone"
                    dataKey="magnitude"
                    name="|a|"
                    stroke={colors.textPrimary}
                    strokeDasharray="4 3"
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="chart-card">
            <div className="card-head">
              <h2>Velocidad</h2>
              {selected?.node.isOnline &&
              selectedNodeId &&
              lastByNode[selectedNodeId]?.accel &&
              ahora - lastByNode[selectedNodeId].receivedAt <= 15000 ? (
                <MovementBadge moving={isMoving} />
              ) : (
                <span className="chart-meta">Movimiento sin confirmar</span>
              )}
            </div>

            <SpeedGauge
              speedKmh={ultimo?.speedKmh ?? null}
              colors={{ accent: colors.seriesSpeed, muted: colors.muted }}
            />

            <div className="chart-frame chart-frame-sm">
              <ResponsiveContainer>
                <LineChart
                  data={points}
                  margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid stroke={colors.grid} vertical={false} />
                  <XAxis dataKey="time" minTickGap={40} {...ejeComun} />
                  <YAxis domain={[0, "auto"]} {...ejeComun} />
                  <Tooltip {...tooltipComun} />
                  {/* Sin unir huecos de GPS o periodos sin recepción. */}
                  <Line
                    type="monotone"
                    dataKey="speedKmh"
                    name="km/h"
                    stroke={colors.seriesSpeed}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="chart-card">
            <div className="card-head">
              <h2>Rotación</h2>
              <span className="chart-meta">giroscopio · rad/s</span>
            </div>
            <div className="chart-frame chart-frame-sm">
              <ResponsiveContainer>
                <LineChart
                  data={points}
                  margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid stroke={colors.grid} vertical={false} />
                  <XAxis dataKey="time" minTickGap={40} {...ejeComun} />
                  <YAxis domain={[0, "auto"]} {...ejeComun} />
                  <Tooltip {...tooltipComun} />
                  {/* En su propia grafica y no junto a la aceleracion:
                      son magnitudes distintas (rad/s frente a g) y
                      compartir eje daria una comparacion falsa. */}
                  <Line
                    type="monotone"
                    dataKey="rotacion"
                    name="rad/s"
                    stroke={colors.seriesY}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}

      {selected && (
        <WeatherRiskPanel
          key={selected.unit.id}
          unit={selected.unit}
          canEditCategory={canEditCargoCategory}
          allRules={riskRulesState.data ?? []}
          onCategoryChanged={state.reload}
        />
      )}
    </>
  );
}
