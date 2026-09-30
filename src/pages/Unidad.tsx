import DecisionBrief from '../components/DecisionBrief';
/* Vista Unidad: estado de los nodos, aceleración y velocidad en vivo.
 *
 * La telemetría llega por Socket.IO: el backend reemite cada mensaje que
 * guarda con éxito. La velocidad sale únicamente de `gps.speedMs` (la
 * calcula el GPS del celular) — no se deriva ni se estima aquí.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { api } from '../api/client';
import { useSocketEvent } from '../api/socket';
import { useApi } from '../api/useApi';
import type { RiskRule, TelemetryBroadcast, TelemetryPoint, Unit } from '../api/types';
import { useSession } from '../auth/context';
import { ConnectionBadge, MovementBadge } from '../components/Badges';
import NodeComparison from '../components/NodeComparison';
import SpeedGauge from '../components/SpeedGauge';
import AttitudeIndicator from '../components/AttitudeIndicator';
import { actitudDesde } from '../lib/actitud';
import { AsyncBoundary } from '../components/States';
import WeatherRiskPanel from '../components/WeatherRiskPanel';
import { chartPalette } from '../lib/chartColors';
import { formatAgo, formatNumber } from '../lib/format';
import { useColorMode } from '../hooks/useColorMode';
import './tables.css';
import './unidad.css';

const ROLE_LABEL = { primary: 'Primario', backup: 'Respaldo' } as const;

/** Puntos visibles en las gráficas. A ~1 Hz son alrededor de un minuto
 *  de historia, suficiente para ver un impacto sin saturar el render. */
const MAX_POINTS = 60;

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

/** Convierte una fila real de /telemetry a la misma forma que llega por
 *  socket, para poder rellenar lastByNode con historia sin duplicar la
 *  lógica que ya la consume (NodeComparison, el picker de nodo, etc). */
function toBroadcast(unitCode: string, row: TelemetryPoint): TelemetryBroadcast {
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
        ? { lat: row.gpsLat, lon: row.gpsLon, speedMs: row.gpsSpeedMs ?? undefined, accuracyM: row.gpsAccuracyM ?? undefined }
        : undefined,
  };
}

function toChartPoint(row: TelemetryPoint): ChartPoint {
  const { accelX, accelY, accelZ, gyroX, gyroY, gyroZ } = row;
  return {
    ts: new Date(row.ts).getTime(),
    time: new Date(row.ts).toLocaleTimeString('es-MX', { hour12: false }),
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
  const colors = chartPalette(mode === 'dark');
  const { user } = useSession();
  const canEditCargoCategory = user?.role === 'control_center';

  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [lastByNode, setLastByNode] = useState<Record<string, TelemetryBroadcast>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  // Reloj compartido: hace que los "hace N s" de las tarjetas avancen
  // aunque no llegue telemetria nueva (asi se ve que un nodo se callo).
  const [ahora, setAhora] = useState(() => Date.now());
  const isMovingRef = useRef(false);
  const movementEmaRef = useRef(0);

  // El manejador del socket se recrea al cambiar de nodo; la ref permite
  // leer la selección vigente sin volver a suscribirse en cada cambio.
  const selectedRef = useRef<string | null>(null);

  const selectNode = useCallback(
    (nodeId: string) => {
      selectedRef.current = nodeId;
      setSelectedNodeId(nodeId);
      setPoints([]);
      movementEmaRef.current = 0;
      isMovingRef.current = false;
      setIsMoving(false);

      // Rellenar con historia real del nodo elegido: sin esto, la
      // gráfica se quedaba vacía al cambiar de nodo hasta que llegara
      // algo nuevo por socket específicamente para ese nodo.
      const unidad = state.data?.find((u) => u.nodes.some((n) => n.nodeCode === nodeId));
      if (!unidad) return;
      void (async () => {
        try {
          const rows = await api.listTelemetry(unidad.unitCode);
          if (selectedRef.current !== nodeId) return; // se cambió de nuevo mientras cargaba
          const propias = rows.filter((r) => r.nodeCode === nodeId);
          if (propias.length === 0) return;
          setPoints(propias.slice(0, MAX_POINTS).reverse().map(toChartPoint));
        } catch {
          // Sin historia para este nodo no debe romper la selección —
          // se sigue esperando datos en vivo.
        }
      })();
    },
    [state.data],
  );

  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const onTelemetry = useCallback((evt: TelemetryBroadcast) => {
    setLastByNode((prev) => ({ ...prev, [evt.nodeId]: evt }));

    // Sin selección previa se sigue el primer nodo que reporte, para que
    // las gráficas no queden en blanco esperando un clic.
    if (!selectedRef.current) {
      selectedRef.current = evt.nodeId;
      setSelectedNodeId(evt.nodeId);
    }
    if (evt.nodeId !== selectedRef.current) return;

    const speedKmh = evt.gps?.speedMs != null ? evt.gps.speedMs * 3.6 : null;
    if (!evt.accel && speedKmh == null) return;

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

    setPoints((prev) =>
      [
        ...prev,
        {
          ts: evt.ts,
          time: new Date(evt.ts).toLocaleTimeString('es-MX', { hour12: false }),
          x: a?.x ?? null,
          y: a?.y ?? null,
          z: a?.z ?? null,
          magnitude: a ? Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z) : null,
          speedKmh,
          rotacion: g ? Math.sqrt(g.x * g.x + g.y * g.y + g.z * g.z) : null,
        },
      ].slice(-MAX_POINTS),
    );
  }, []);

  useSocketEvent('telemetry', onTelemetry);

  // Historia real al abrir la pantalla: antes solo se pintaba lo que
  // llegara por socket desde este momento — si el nodo no estaba
  // publicando justo en ese instante, el picker y las gráficas se veían
  // vacíos aunque hubiera telemetría reciente guardada en la base.
  const backfilledRef = useRef(false);
  useEffect(() => {
    if (backfilledRef.current) return;
    const unidades = state.data;
    if (!unidades || unidades.length === 0) return;
    backfilledRef.current = true;

    void (async () => {
      const porNodo: Record<string, TelemetryBroadcast> = {};
      let masReciente: { rows: TelemetryPoint[] } | null = null;

      for (const unidad of unidades) {
        let rows: TelemetryPoint[];
        try {
          rows = await api.listTelemetry(unidad.unitCode);
        } catch {
          // Sin historia para esta unidad no debe impedir ver las demás.
          continue;
        }
        if (rows.length === 0) continue;

        // rows viene ordenado más reciente primero; una pasada basta
        // para quedarse con la última fila real de cada nodo.
        for (const row of rows) {
          if (!porNodo[row.nodeCode]) {
            porNodo[row.nodeCode] = toBroadcast(unidad.unitCode, row);
          }
        }

        if (!masReciente || new Date(rows[0]!.ts).getTime() > new Date(masReciente.rows[0]!.ts).getTime()) {
          masReciente = { rows };
        }
      }

      if (Object.keys(porNodo).length > 0) {
        // ...prev al final: si ya llegó algo real por socket mientras
        // se cargaba la historia, esa lectura en vivo gana.
        setLastByNode((prev) => ({ ...porNodo, ...prev }));
      }

      if (masReciente && !selectedRef.current) {
        const nodeCode = masReciente.rows[0]!.nodeCode;
        selectedRef.current = nodeCode;
        setSelectedNodeId(nodeCode);
        setPoints(
          masReciente.rows
            .filter((r) => r.nodeCode === nodeCode)
            .slice(0, MAX_POINTS)
            .reverse()
            .map(toChartPoint),
        );
      }
    })();
  }, [state.data]);

  const reportando = useMemo(() => Object.values(lastByNode), [lastByNode]);
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
          <span className="dss-kicker">TONATIUH / UNIDADES</span><h1>Estado general</h1>
          <p>Nodos por unidad, aceleración y velocidad en vivo.</p>
        </div>

        {reportando.length > 0 ? (
          <label className="node-picker">
            Nodo:{' '}
            <select
              value={selectedNodeId ?? ''}
              onChange={(e) => selectNode(e.target.value)}
            >
              {reportando.map((n) => (
                <option key={n.nodeId} value={n.nodeId}>
                  {n.nodeId} ({ROLE_LABEL[n.role]})
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <DecisionBrief
        title={selectedNodeId ? `Fuente observada: ${selectedNodeId}` : 'Aún no hay una fuente para evaluar'}
        evidence={selectedNodeId && lastByNode[selectedNodeId]
          ? `Última recepción: ${formatAgo(new Date(lastByNode[selectedNodeId].receivedAt).toISOString())}. Las gráficas conservan hasta 60 muestras recibidas en esta sesión; una lectura retenida no garantiza el estado actual.`
          : 'Esperando telemetría. Sin lecturas no se puede determinar el movimiento ni el estado de la carga.'}
        action="Compara los nodos principal y de respaldo. Si observas un cambio brusco, consulta los eventos y verifica el contexto con el operador."
        to="/eventos"
        linkLabel="Revisar incidencias"
      />
      <NodeComparison
        lastByNode={lastByNode}
        ahora={ahora}
        selectedNodeId={selectedNodeId}
        onSelect={selectNode}
      />

      {points.length === 0 ? (
        <section className="chart-card">
          <p className="chart-hint">
            Esperando telemetría del corredor. Las gráficas se dibujan solas
            en cuanto un nodo empiece a publicar.
          </p>
        </section>
      ) : (
        <div className="live-grid">
          <AttitudeIndicator
            actitud={actitudDesde(selectedNodeId ? lastByNode[selectedNodeId] : undefined)}
            nodeCode={selectedNodeId}
          />

          <section className="chart-card">
            <div className="card-head">
              <h2>Aceleración</h2>
              <span className="chart-meta mono">{selectedNodeId}</span>
            </div>
            <div className="chart-frame">
              <ResponsiveContainer>
                <LineChart data={points} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={colors.grid} vertical={false} />
                  <XAxis dataKey="time" minTickGap={40} {...ejeComun} />
                  <YAxis domain={['auto', 'auto']} {...ejeComun} />
                  <Tooltip {...tooltipComun} />
                  <Legend wrapperStyle={{ fontSize: 12, color: colors.textSecondary }} />
                  <Line type="monotone" dataKey="x" stroke={colors.seriesX} dot={false} isAnimationActive={false} connectNulls />
                  <Line type="monotone" dataKey="y" stroke={colors.seriesY} dot={false} isAnimationActive={false} connectNulls />
                  <Line type="monotone" dataKey="z" stroke={colors.seriesZ} dot={false} isAnimationActive={false} connectNulls />
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
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="chart-card">
            <div className="card-head">
              <h2>Velocidad</h2>
              <MovementBadge moving={isMoving} />
            </div>

            <SpeedGauge
              speedKmh={ultimo?.speedKmh ?? null}
              colors={{ accent: colors.seriesSpeed, muted: colors.muted }}
            />

            <div className="chart-frame chart-frame-sm">
              <ResponsiveContainer>
                <LineChart data={points} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={colors.grid} vertical={false} />
                  <XAxis dataKey="time" minTickGap={40} {...ejeComun} />
                  <YAxis domain={[0, 'auto']} {...ejeComun} />
                  <Tooltip {...tooltipComun} />
                  {/* connectNulls: el GPS llega más lento que el
                      acelerómetro, así que hay puntos sin velocidad. */}
                  <Line
                    type="monotone"
                    dataKey="speedKmh"
                    name="km/h"
                    stroke={colors.seriesSpeed}
                    dot={false}
                    isAnimationActive={false}
                    connectNulls
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
                <LineChart data={points} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={colors.grid} vertical={false} />
                  <XAxis dataKey="time" minTickGap={40} {...ejeComun} />
                  <YAxis domain={[0, 'auto']} {...ejeComun} />
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
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}

      <AsyncBoundary
        state={state}
        empty={{
          title: 'No hay unidades registradas',
          hint: 'Las unidades aparecen cuando un nodo se da de alta contra el backend.',
        }}
      >
        {(unidades) => (
          <div className="unit-list">
            {unidades.map((unidad) => (
              <section key={unidad.id} className="unit">
                <div className="card-head">
                  <h2>{unidad.label ?? unidad.unitCode}</h2>
                </div>

                <WeatherRiskPanel
                  unit={unidad}
                  canEditCategory={canEditCargoCategory}
                  allRules={riskRulesState.data ?? []}
                  onCategoryChanged={state.reload}
                />

                <div className="cards">
                  {unidad.nodes.map((nodo) => {
                    const vivo = lastByNode[nodo.nodeCode];
                    return (
                      <article key={nodo.id} className="card">
                        <div className="card-head">
                          <h3>
                            {ROLE_LABEL[nodo.role]}
                            {unidad.activeNodeId === nodo.id ? (
                              <span className="tag">fuente activa</span>
                            ) : null}
                          </h3>
                          <ConnectionBadge online={nodo.isOnline} />
                        </div>

                        <dl>
                          <dt>Nodo</dt>
                          <dd className="mono">{nodo.nodeCode}</dd>

                          <dt>Último heartbeat</dt>
                          <dd>{formatAgo(nodo.lastHeartbeatAt)}</dd>

                          <dt>Batería</dt>
                          <dd>
                            {nodo.batteryPct === null
                              ? '—'
                              : `${formatNumber(nodo.batteryPct, 0)} %`}
                          </dd>

                          <dt>Cola pendiente</dt>
                          <dd>{nodo.pendingOutbox ?? '—'}</dd>

                          <dt>Último seq</dt>
                          <dd>{vivo ? vivo.seq : '—'}</dd>
                        </dl>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </AsyncBoundary>
    </>
  );
}
