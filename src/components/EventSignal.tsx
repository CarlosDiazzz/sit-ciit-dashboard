/* La señal alrededor de un evento.
 *
 * Un evento dice "2.59 g a las 07:54". Eso no basta para saber qué pasó:
 * un golpe de vía y un frenón pueden alcanzar el mismo pico y tener
 * curvas completamente distintas. Un golpe es un pico agudo de décimas
 * de segundo; un frenado es una meseta que dura segundos.
 *
 * Aquí se dibujan las lecturas de los segundos anteriores y posteriores,
 * centradas en el instante de la alerta, que es lo que permite decidir
 * si la detección fue correcta.
 */

import { useEffect, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { ApiError, api } from '../api/client';
import type { EventWindow } from '../api/types';
import { chartPalette } from '../lib/chartColors';
import './eventSignal.css';

interface Punto {
  offsetMs: number;
  magnitud: number | null;
  rotacion: number | null;
}

export default function EventSignal({ eventId }: { eventId: string }) {
  const [datos, setDatos] = useState<EventWindow | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Arranca cargando y solo cambia al resolverse la peticion: llamar a
  // setState sincronicamente dentro del efecto encadena renders.
  const [cargando, setCargando] = useState(true);
  const colors = chartPalette();

  useEffect(() => {
    let vigente = true;
    api
      .eventWindow(eventId)
      .then((d) => {
        if (vigente) setDatos(d);
      })
      .catch((e: unknown) => {
        if (vigente) {
          setError(e instanceof ApiError ? e.userMessage : 'No se pudo cargar la señal.');
        }
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
  }, [eventId]);

  if (cargando) return <p className="signal-note">Cargando la señal…</p>;
  if (error) return <p className="signal-note signal-note--error">{error}</p>;
  if (!datos || datos.samples.length === 0) {
    return (
      <p className="signal-note">
        No hay telemetría guardada alrededor de este evento. Ocurre cuando el
        nodo detectó algo sin estar publicando lecturas.
      </p>
    );
  }

  const puntos: Punto[] = datos.samples.map((s) => ({
    offsetMs: s.offsetMs,
    magnitud: s.accel
      ? Math.sqrt(s.accel.x ** 2 + s.accel.y ** 2 + s.accel.z ** 2)
      : null,
    rotacion: s.gyro ? Math.sqrt(s.gyro.x ** 2 + s.gyro.y ** 2 + s.gyro.z ** 2) : null,
  }));

  const pico = puntos.reduce(
    (max, p) => (p.magnitud !== null && p.magnitud > max ? p.magnitud : max),
    0,
  );
  const antes = puntos.filter((p) => p.offsetMs < 0).length;

  return (
    <div className="signal">
      <div className="signal-head">
        <h4>Señal registrada</h4>
        <span className="signal-meta">
          {datos.samples.length} lecturas · ±{datos.windowSeconds} s
        </span>
      </div>

      <div className="signal-chart">
        <ResponsiveContainer>
          <LineChart data={puntos} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid stroke={colors.grid} vertical={false} />
            <XAxis
              dataKey="offsetMs"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}s`}
              stroke={colors.axis}
              tick={{ fill: colors.muted, fontSize: 11 }}
            />
            <YAxis
              stroke={colors.axis}
              tick={{ fill: colors.muted, fontSize: 11 }}
              domain={[0, 'auto']}
            />
            <Tooltip
              contentStyle={{
                background: colors.surface,
                border: `1px solid ${colors.grid}`,
                fontSize: 12,
              }}
              labelFormatter={(v) => `${(Number(v) / 1000).toFixed(2)} s del evento`}
            />

            {/* El instante de la alerta: sin esta marca no se sabe qué
                parte de la curva disparó el evento. */}
            <ReferenceLine x={0} stroke={colors.textPrimary} strokeDasharray="3 3" />
            {datos.event.threshold !== null ? (
              <ReferenceLine
                y={datos.event.threshold}
                stroke={colors.seriesY}
                strokeDasharray="4 4"
                label={{
                  value: 'umbral',
                  position: 'insideTopRight',
                  fill: colors.muted,
                  fontSize: 10,
                }}
              />
            ) : null}

            <Line
              type="monotone"
              dataKey="magnitud"
              name="|a| g"
              stroke={colors.seriesX}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="rotacion"
              name="rad/s"
              stroke={colors.seriesZ}
              strokeDasharray="4 3"
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <dl className="signal-stats">
        <div>
          <dt>Pico medido</dt>
          <dd>{pico > 0 ? `${pico.toFixed(2)} g` : '—'}</dd>
        </div>
        <div>
          <dt>Antes / después</dt>
          <dd>
            {antes} / {puntos.length - antes}
          </dd>
        </div>
        <div>
          <dt>Umbral</dt>
          <dd>{datos.event.threshold !== null ? datos.event.threshold.toFixed(2) : '—'}</dd>
        </div>
      </dl>

      <p className="signal-hint">
        Un pico agudo de décimas de segundo es un golpe; una meseta que dura
        segundos es un frenado o una curva.
      </p>
    </div>
  );
}
