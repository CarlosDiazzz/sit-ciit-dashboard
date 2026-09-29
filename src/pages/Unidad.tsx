import { useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
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

import SpeedGauge from '../components/SpeedGauge';

// Gráficas en vivo por unidad, vía Socket.IO (el backend reemite cada
// `telemetry` que guarda con éxito). Dos gráficas separadas, no una con
// doble eje: aceleración (g) y velocidad (km/h) son unidades distintas.
//
// La velocidad SOLO sale de gps.speedMs (el GPS del celular la calcula).
// No se deriva del acelerómetro: integrar aceleración dos veces para
// obtener velocidad acumula error muy rápido (deriva) y daría un número
// que aparenta precisión sin tenerla — no es aceptable para un dato que
// se muestra como real. Luz se agrega cuando el sensor llegue (Fase 2+).

interface TelemetryEvent {
  nodeId: string;
  unitId: string;
  role: 'primary' | 'backup';
  seq: number;
  ts: number;
  receivedAt: number;
  accel?: { x: number; y: number; z: number };
  gps?: { lat: number; lon: number; speedMs?: number; accuracyM?: number };
}

interface ChartPoint {
  ts: number;
  time: string;
  x: number | null;
  y: number | null;
  z: number | null;
  magnitude: number | null;
  speedKmh: number | null;
}

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3000';
const MAX_POINTS = 60;

// Paleta categórica validada (dataviz skill): slots 1-3 (azul/naranja/aqua)
// para los ejes x/y/z — pasan CVD y contraste en modo claro y oscuro para
// líneas. La magnitud no es una serie categórica más, es la derivada de
// las otras tres — tinta neutra (texto primario), no un cuarto hue.
// La velocidad vive en su propia gráfica (otra unidad, otro eje) y usa el
// slot 7 (violeta): deliberadamente distinto de blue/orange/aqua para que
// no lea como "parte" del grupo x/y/z.
const PALETTE = {
  light: {
    surface: '#fcfcfb',
    textPrimary: '#0b0b0b',
    textSecondary: '#52514e',
    muted: '#898781',
    grid: '#e1e0d9',
    axis: '#c3c2b7',
    seriesX: '#2a78d6',
    seriesY: '#eb6834',
    seriesZ: '#1baf7a',
    seriesSpeed: '#4a3aa7',
  },
  dark: {
    surface: '#1a1a19',
    textPrimary: '#ffffff',
    textSecondary: '#c3c2b7',
    muted: '#898781',
    grid: '#2c2c2a',
    axis: '#383835',
    seriesX: '#3987e5',
    seriesY: '#d95926',
    seriesZ: '#199e70',
    seriesSpeed: '#9085e9',
  },
} as const;

function usePrefersDark(): boolean {
  const [dark, setDark] = useState(
    () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return dark;
}

export default function Unidad() {
  const colors = PALETTE[usePrefersDark() ? 'dark' : 'light'];

  const [unitId, setUnitId] = useState('unit-01');
  const [connected, setConnected] = useState(false);
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [lastByNode, setLastByNode] = useState<Record<string, TelemetryEvent>>({});
  const [showTable, setShowTable] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Nodo seleccionado dentro de la unidad — necesario en cuanto hay más de
  // un nodo (primary + backup): sin esto, sus lecturas se mezclarían en
  // una sola línea como si fueran de un solo dispositivo.
  const [selectedNodeId, setSelectedNodeIdState] = useState<string | null>(null);
  const selectedNodeIdRef = useRef<string | null>(null);
  function selectNode(id: string | null) {
    selectedNodeIdRef.current = id;
    setSelectedNodeIdState(id);
    setPoints([]);
  }

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('telemetry', (evt: TelemetryEvent) => {
      setLastByNode((prev) => ({ ...prev, [evt.nodeId]: evt }));
      if (evt.unitId !== unitId) return;

      // Primer nodo visto de esta unidad se selecciona solo.
      if (!selectedNodeIdRef.current) {
        selectedNodeIdRef.current = evt.nodeId;
        setSelectedNodeIdState(evt.nodeId);
      }
      if (evt.nodeId !== selectedNodeIdRef.current) return;

      const magnitude = evt.accel
        ? Math.sqrt(evt.accel.x ** 2 + evt.accel.y ** 2 + evt.accel.z ** 2)
        : null;
      const speedKmh = evt.gps?.speedMs != null ? evt.gps.speedMs * 3.6 : null;
      if (!evt.accel && speedKmh == null) return;

      setPoints((prev) =>
        [
          ...prev,
          {
            ts: evt.ts,
            time: new Date(evt.ts).toLocaleTimeString(),
            x: evt.accel?.x ?? null,
            y: evt.accel?.y ?? null,
            z: evt.accel?.z ?? null,
            magnitude,
            speedKmh,
          },
        ].slice(-MAX_POINTS)
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [unitId]);

  const nodesOfUnit = useMemo(
    () => Object.values(lastByNode).filter((n) => n.unitId === unitId),
    [lastByNode, unitId]
  );

  return (
    <div>
      <h1>Unidad</h1>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <label>
          unitId:{' '}
          <input
            value={unitId}
            onChange={(e) => {
              setUnitId(e.target.value);
              selectNode(null);
            }}
          />
        </label>

        {nodesOfUnit.length > 1 && (
          <label>
            nodo:{' '}
            <select value={selectedNodeId ?? ''} onChange={(e) => selectNode(e.target.value)}>
              {nodesOfUnit.map((n) => (
                <option key={n.nodeId} value={n.nodeId}>
                  {n.nodeId} ({n.role})
                </option>
              ))}
            </select>
          </label>
        )}

        <span style={{ color: connected ? colors.seriesZ : colors.muted }}>
          ● socket {connected ? 'conectado' : 'desconectado'}
        </span>
        <button onClick={() => setShowTable((v) => !v)}>{showTable ? 'Ver gráficas' : 'Ver tabla'}</button>
      </div>

      {showTable ? (
        <table cellPadding={4} style={{ borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr style={{ color: colors.textSecondary, textAlign: 'left' }}>
              <th>hora</th>
              <th>x</th>
              <th>y</th>
              <th>z</th>
              <th>|a|</th>
              <th>km/h</th>
            </tr>
          </thead>
          <tbody>
            {[...points]
              .reverse()
              .slice(0, 20)
              .map((p) => (
                <tr key={p.ts} style={{ borderTop: `1px solid ${colors.grid}` }}>
                  <td>{p.time}</td>
                  <td>{p.x?.toFixed(3) ?? '—'}</td>
                  <td>{p.y?.toFixed(3) ?? '—'}</td>
                  <td>{p.z?.toFixed(3) ?? '—'}</td>
                  <td>{p.magnitude?.toFixed(3) ?? '—'}</td>
                  <td>{p.speedKmh != null ? p.speedKmh.toFixed(1) : '—'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      ) : (
        <>
          <h3>Aceleración (g)</h3>
          <div style={{ width: '100%', height: 280, background: colors.surface }}>
            <ResponsiveContainer>
              <LineChart data={points} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={colors.grid} strokeDasharray="0" vertical={false} />
                <XAxis dataKey="time" stroke={colors.axis} tick={{ fill: colors.muted, fontSize: 12 }} minTickGap={40} />
                <YAxis stroke={colors.axis} tick={{ fill: colors.muted, fontSize: 12 }} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ background: colors.surface, border: `1px solid ${colors.grid}`, fontSize: 12 }}
                  labelStyle={{ color: colors.textSecondary }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: colors.textSecondary }} />
                <Line name="x" type="monotone" dataKey="x" stroke={colors.seriesX} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
                <Line name="y" type="monotone" dataKey="y" stroke={colors.seriesY} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
                <Line name="z" type="monotone" dataKey="z" stroke={colors.seriesZ} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
                <Line
                  name="|a| (magnitud)"
                  type="monotone"
                  dataKey="magnitude"
                  stroke={colors.textPrimary}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <h3 style={{ marginTop: 20 }}>Velocidad — GPS (km/h)</h3>
          <div style={{ maxWidth: 260 }}>
            <SpeedGauge
              speedKmh={points.at(-1)?.speedKmh ?? null}
              colors={{ accent: colors.seriesSpeed, muted: colors.muted }}
            />
          </div>
          <div style={{ width: '100%', height: 200, background: colors.surface }}>
            <ResponsiveContainer>
              <LineChart data={points} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={colors.grid} strokeDasharray="0" vertical={false} />
                <XAxis dataKey="time" stroke={colors.axis} tick={{ fill: colors.muted, fontSize: 12 }} minTickGap={40} />
                <YAxis stroke={colors.axis} tick={{ fill: colors.muted, fontSize: 12 }} domain={[0, 'auto']} />
                <Tooltip
                  contentStyle={{ background: colors.surface, border: `1px solid ${colors.grid}`, fontSize: 12 }}
                  labelStyle={{ color: colors.textSecondary }}
                />
                <Line
                  name="velocidad (km/h)"
                  type="monotone"
                  dataKey="speedKmh"
                  stroke={colors.seriesSpeed}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      <h2 style={{ marginTop: 24 }}>Nodos de la unidad</h2>
      {nodesOfUnit.length === 0 ? (
        <p style={{ color: colors.muted }}>Sin lecturas todavía.</p>
      ) : (
        <ul>
          {nodesOfUnit.map((n) => (
            <li key={n.nodeId}>
              <strong>{n.nodeId}</strong> ({n.role}) — seq {n.seq} — último:{' '}
              {new Date(n.receivedAt).toLocaleTimeString()}
              {n.nodeId === selectedNodeId ? '  ← graficando' : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
