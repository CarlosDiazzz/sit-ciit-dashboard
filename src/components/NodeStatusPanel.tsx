/* Estado de los nodos conectados, en el panel del mapa.
 *
 * Sustituye a las tarjetas fijas que decían "Trazado disponible" y
 * "Sin estimación": eso no cambia nunca y no ayuda a decidir nada.
 *
 * Lo que sí importa en un centro de control es qué puede dejar de
 * reportar en los próximos minutos. El orden de las tarjetas es el de
 * urgencia, no el alfabético: primero lo que está mal.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import type { TelemetryBroadcast } from '../api/types';
import type { Unit } from '../api/types';
import { formatAgo } from '../lib/format';
import './nodeStatus.css';

/** Batería por debajo de esto: el nodo puede apagarse durante el turno. */
const BATERIA_CRITICA = 20;
const BATERIA_BAJA = 40;

/** Cola pendiente que ya indica un tramo sin cobertura, no un bache. */
const COLA_ALERTA = 50;

/** Sin heartbeat en este tiempo el backend lo marca offline. */
const HEARTBEAT_LIMITE_MS = 15_000;

type Gravedad = 'critico' | 'aviso' | 'normal';

interface Fila {
  nodeCode: string;
  unitCode: string;
  role: 'primary' | 'backup';
  esFuente: boolean;
  isOnline: boolean;
  bateria: number | null;
  cola: number | null;
  sensores: number;
  heartbeatMs: number | null;
  velocidadKmh: number | null;
  gravedad: Gravedad;
  /** Lo que hay que atender, en una frase. null si todo está bien. */
  motivo: string | null;
}

/** Qué está mal con este nodo, si algo lo está. El orden de las
 *  comprobaciones es el de urgencia: lo que antes deja sin datos. */
function evaluar(f: Omit<Fila, 'gravedad' | 'motivo'>): { gravedad: Gravedad; motivo: string | null } {
  if (!f.isOnline) {
    return { gravedad: 'critico', motivo: 'Sin reportar: el backend lo dio por caído' };
  }
  if (f.heartbeatMs !== null && f.heartbeatMs > HEARTBEAT_LIMITE_MS) {
    return { gravedad: 'critico', motivo: 'Sin latido reciente, a punto de marcarse offline' };
  }
  if (f.bateria !== null && f.bateria <= BATERIA_CRITICA) {
    return { gravedad: 'critico', motivo: `Batería al ${Math.round(f.bateria)} %: puede apagarse en el turno` };
  }
  if (f.cola !== null && f.cola >= COLA_ALERTA) {
    return { gravedad: 'aviso', motivo: `${f.cola} mensajes sin enviar: viene de un tramo sin cobertura` };
  }
  if (f.bateria !== null && f.bateria <= BATERIA_BAJA) {
    return { gravedad: 'aviso', motivo: `Batería al ${Math.round(f.bateria)} %` };
  }
  if (f.sensores === 0) {
    return { gravedad: 'aviso', motivo: 'No declara sensores disponibles' };
  }
  return { gravedad: 'normal', motivo: null };
}

const PESO: Record<Gravedad, number> = { critico: 0, aviso: 1, normal: 2 };

export default function NodeStatusPanel({
  units,
  ultimaTelemetria,
}: {
  units: Unit[] | null;
  /** Último mensaje por nodo, para la velocidad en vivo. */
  ultimaTelemetria: Record<string, TelemetryBroadcast>;
}) {
  // Reloj propio: sin esto, "hace N s" se congela hasta que llegue
  // telemetria nueva, justo cuando un nodo deja de reportar y es cuando
  // mas importa ver que el tiempo corre.
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 2000);
    return () => clearInterval(id);
  }, []);

  const filas: Fila[] = (units ?? []).flatMap((u) =>
    u.nodes.map((n) => {
      const vivo = ultimaTelemetria[n.nodeCode];
      const base = {
        nodeCode: n.nodeCode,
        unitCode: u.unitCode,
        role: n.role,
        esFuente: u.activeNodeId === n.id,
        isOnline: n.isOnline,
        bateria: n.batteryPct,
        cola: n.pendingOutbox,
        sensores: n.capabilities.length,
        heartbeatMs: n.lastHeartbeatAt
          ? ahora - new Date(n.lastHeartbeatAt).getTime()
          : null,
        velocidadKmh:
          vivo?.gps?.speedMs != null ? vivo.gps.speedMs * 3.6 : null,
      };
      return { ...base, ...evaluar(base) };
    }),
  );

  // Primero lo que necesita atención; a igual gravedad, el primario.
  filas.sort(
    (a, b) =>
      PESO[a.gravedad] - PESO[b.gravedad] ||
      (a.role === b.role ? a.nodeCode.localeCompare(b.nodeCode) : a.role === 'primary' ? -1 : 1),
  );

  const conProblema = filas.filter((f) => f.gravedad !== 'normal').length;

  if (filas.length === 0) {
    return (
      <section className="nodes-panel">
        <h2 className="nodes-panel__head">Nodos</h2>
        <p className="nodes-panel__empty">
          Ningún nodo dado de alta. Aparecen aquí en cuanto uno publique su
          primer mensaje.
        </p>
      </section>
    );
  }

  return (
    <section className="nodes-panel">
      <div className="nodes-panel__head">
        <h2>Nodos</h2>
        <span className={conProblema > 0 ? 'nodes-panel__count is-alert' : 'nodes-panel__count'}>
          {conProblema > 0 ? `${conProblema} requiere${conProblema === 1 ? '' : 'n'} atención` : 'Todos al día'}
        </span>
      </div>

      <ul className="nodes-list">
        {filas.map((f) => (
          <li key={f.nodeCode} className={`node-row node-row--${f.gravedad}`}>
            <div className="node-row__top">
              <span className="node-row__code">
                {f.nodeCode}
                <em>{f.role === 'primary' ? 'primario' : 'respaldo'}</em>
              </span>
              {f.esFuente ? <span className="node-row__source">fuente</span> : null}
            </div>

            {/* Las métricas van en la misma posición en cada tarjeta:
                así se comparan dos nodos de un vistazo. */}
            <dl className="node-row__metrics">
              <div>
                <dt>Batería</dt>
                <dd className={f.bateria !== null && f.bateria <= BATERIA_CRITICA ? 'is-critical' : undefined}>
                  {f.bateria === null ? '—' : `${Math.round(f.bateria)} %`}
                </dd>
              </div>
              <div>
                <dt>Cola</dt>
                <dd className={f.cola !== null && f.cola >= COLA_ALERTA ? 'is-warning' : undefined}>
                  {f.cola ?? '—'}
                </dd>
              </div>
              <div>
                <dt>Velocidad</dt>
                <dd>{f.velocidadKmh === null ? '—' : `${f.velocidadKmh.toFixed(0)} km/h`}</dd>
              </div>
              <div>
                <dt>Latido</dt>
                <dd>{f.heartbeatMs === null ? 'nunca' : formatAgo(new Date(ahora - f.heartbeatMs).toISOString())}</dd>
              </div>
            </dl>

            {f.motivo ? <p className="node-row__reason">{f.motivo}</p> : null}
          </li>
        ))}
      </ul>

      <Link to="/unidad" className="nodes-panel__link">
        Ver telemetría en vivo →
      </Link>
    </section>
  );
}
