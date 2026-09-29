/* Vista Unidad: estado de los nodos, aceleración y velocidad en vivo.
 *
 * La telemetría llega por Socket.IO: el backend reemite cada mensaje que
 * guarda con éxito. La velocidad sale únicamente de `gps.speedMs` (la
 * calcula el GPS del celular) — no se deriva ni se estima aquí.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
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
import type { TelemetryBroadcast, Unit } from '../api/types';
import { ConnectionBadge } from '../components/Badges';
import SpeedGauge from '../components/SpeedGauge';
import { AsyncBoundary } from '../components/States';
import { chartPalette } from '../lib/chartColors';
import { formatAgo, formatNumber } from '../lib/format';
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
}

export default function Unidad() {
  const state = useApi<Unit[]>(() => api.listUnits());
  const colors = chartPalette();

  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [lastByNode, setLastByNode] = useState<Record<string, TelemetryBroadcast>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // El manejador del socket se recrea al cambiar de nodo; la ref permite
  // leer la selección vigente sin volver a suscribirse en cada cambio.
  const selectedRef = useRef<string | null>(null);

  const selectNode = useCallback((nodeId: string) => {
    selectedRef.current = nodeId;
    setSelectedNodeId(nodeId);
    setPoints([]);
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
        },
      ].slice(-MAX_POINTS),
    );
  }, []);

  useSocketEvent('telemetry', onTelemetry);

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
          <h1>Unidades</h1>
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

      {points.length === 0 ? (
        <section className="chart-card">
          <p className="chart-hint">
            Esperando telemetría del corredor. Las gráficas se dibujan solas
            en cuanto un nodo empiece a publicar.
          </p>
        </section>
      ) : (
        <div className="live-grid">
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
              <span className="chart-meta">GPS del dispositivo</span>
            </div>

            <SpeedGauge
              speedKmh={ultimo?.speedKmh ?? null}
              colors={{ accent: colors.seriesX, muted: colors.muted }}
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
                    stroke={colors.seriesX}
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
