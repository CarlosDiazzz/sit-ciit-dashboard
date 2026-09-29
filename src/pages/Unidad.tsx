/* Vista Unidad: estado de los nodos y gráfica en vivo de aceleración.
 *
 * La telemetría llega por Socket.IO: el backend reemite cada mensaje que
 * guarda con éxito. Luz, velocidad y GPS se agregan cuando esos sensores
 * empiecen a llegar del celular (Fase 2+).
 */

import { useCallback, useMemo, useState } from 'react';
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
import { AsyncBoundary } from '../components/States';
import { chartPalette } from '../lib/chartColors';
import { formatAgo, formatNumber } from '../lib/format';
import './tables.css';
import './unidad.css';

const ROLE_LABEL = { primary: 'Primario', backup: 'Respaldo' } as const;

/** Puntos visibles en la gráfica. A ~1 Hz son alrededor de un minuto de
 *  historia, suficiente para ver un impacto sin saturar el render. */
const MAX_POINTS = 60;

interface ChartPoint {
  ts: number;
  time: string;
  x: number;
  y: number;
  z: number;
  magnitude: number;
}

export default function Unidad() {
  const state = useApi<Unit[]>(() => api.listUnits());
  const colors = chartPalette();

  /** Unidad seleccionada por su código de contrato ("unit-01"), que es lo
   *  que trae el payload del socket. */
  const [unitCode, setUnitCode] = useState<string | null>(null);
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [lastByNode, setLastByNode] = useState<Record<string, TelemetryBroadcast>>({});

  const onTelemetry = useCallback(
    (evt: TelemetryBroadcast) => {
      setLastByNode((prev) => ({ ...prev, [evt.nodeId]: evt }));

      // Sin unidad elegida se sigue la primera que reporte, para que la
      // gráfica no quede en blanco esperando un clic.
      const seguida = unitCode ?? evt.unitId;
      if (evt.unitId !== seguida || !evt.accel) return;

      const { x, y, z } = evt.accel;
      setPoints((prev) =>
        [
          ...prev,
          {
            ts: evt.ts,
            time: new Date(evt.ts).toLocaleTimeString('es-MX', { hour12: false }),
            x,
            y,
            z,
            magnitude: Math.sqrt(x * x + y * y + z * z),
          },
        ].slice(-MAX_POINTS),
      );
    },
    [unitCode],
  );

  useSocketEvent('telemetry', onTelemetry);

  const seguida = unitCode ?? Object.values(lastByNode)[0]?.unitId ?? null;

  const nodosReportando = useMemo(
    () => Object.values(lastByNode).filter((n) => n.unitId === seguida),
    [lastByNode, seguida],
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Unidades</h1>
          <p>Nodos por unidad, fuente activa y aceleración en vivo.</p>
        </div>
      </div>

      <section className="chart-card">
        <div className="card-head">
          <h2>Aceleración {seguida ? <span className="mono">{seguida}</span> : null}</h2>
          {/* Los nodos que están reportando ahora mismo por el socket, que
              no es lo mismo que los dados de alta en la BD. */}
          <span className="chart-meta">
            {nodosReportando.length > 0
              ? `${nodosReportando.length} nodo(s) reportando`
              : 'sin telemetría'}
          </span>
        </div>

        {points.length === 0 ? (
          <p className="chart-hint">
            Esperando telemetría del corredor. La gráfica se dibuja sola en
            cuanto un nodo empiece a publicar.
          </p>
        ) : (
          <div className="chart-frame">
            <ResponsiveContainer>
              <LineChart data={points} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={colors.grid} vertical={false} />
                <XAxis
                  dataKey="time"
                  stroke={colors.axis}
                  tick={{ fill: colors.muted, fontSize: 12 }}
                  minTickGap={40}
                />
                <YAxis
                  stroke={colors.axis}
                  tick={{ fill: colors.muted, fontSize: 12 }}
                  domain={['auto', 'auto']}
                  label={{
                    value: 'g',
                    position: 'insideTopLeft',
                    fill: colors.muted,
                    fontSize: 12,
                  }}
                />
                <Tooltip
                  contentStyle={{
                    background: colors.surface,
                    border: `1px solid ${colors.grid}`,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: colors.textSecondary }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: colors.textSecondary }} />
                <Line type="monotone" dataKey="x" stroke={colors.seriesX} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="y" stroke={colors.seriesY} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="z" stroke={colors.seriesZ} dot={false} isAnimationActive={false} />
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
        )}
      </section>

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
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setUnitCode(unidad.unitCode);
                      setPoints([]);
                    }}
                    disabled={seguida === unidad.unitCode}
                  >
                    {seguida === unidad.unitCode ? 'En gráfica' : 'Graficar'}
                  </button>
                </div>

                <div className="cards">
                  {unidad.nodes.map((nodo) => {
                    const ultimo = lastByNode[nodo.nodeCode];
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
                          <dd>{ultimo ? ultimo.seq : '—'}</dd>
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
