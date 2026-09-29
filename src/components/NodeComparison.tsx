/* Comparación lado a lado de los nodos que están reportando.
 *
 * Con varios nodos en la misma unidad (primary y backup) lo que importa
 * no es el detalle de uno, sino verlos juntos: quién está vivo, cuál va
 * más adelantado en seq y si sus lecturas coinciden. Esa comparación es
 * la que sostiene el failover y la detección de discrepancias que hace
 * el backend.
 */

import type { TelemetryBroadcast } from '../api/types';
import { formatNumber } from '../lib/format';
import './nodeComparison.css';

const ROLE_LABEL = { primary: 'Primario', backup: 'Respaldo' } as const;

/** Tras este tiempo sin recibir nada se considera que el nodo se calló.
 *  El backend usa 15 s para marcarlo offline formalmente; aquí basta con
 *  avisar antes en pantalla. */
const SILENCIO_MS = 10_000;

function magnitud(a: { x: number; y: number; z: number }): number {
  return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
}

export default function NodeComparison({
  lastByNode,
  ahora,
  selectedNodeId,
  onSelect,
}: {
  lastByNode: Record<string, TelemetryBroadcast>;
  /** Se recibe de fuera para que todas las tarjetas midan el silencio
   *  contra el mismo instante y se refresquen juntas. */
  ahora: number;
  selectedNodeId: string | null;
  onSelect: (nodeId: string) => void;
}) {
  const nodos = Object.values(lastByNode).sort((a, b) =>
    a.role === b.role ? a.nodeId.localeCompare(b.nodeId) : a.role === 'primary' ? -1 : 1,
  );

  if (nodos.length === 0) return null;

  // Solo tiene sentido comparar magnitudes entre nodos de la misma
  // unidad: dos unidades distintas van en camiones distintos.
  const porUnidad = new Map<string, TelemetryBroadcast[]>();
  for (const n of nodos) {
    const l = porUnidad.get(n.unitId);
    if (l) l.push(n);
    else porUnidad.set(n.unitId, [n]);
  }

  return (
    <section className="node-compare">
      <div className="card-head">
        <h2>Nodos reportando</h2>
        <span className="chart-meta">{nodos.length} activo(s)</span>
      </div>

      <div className="node-grid">
        {nodos.map((n) => {
          const silencioMs = ahora - n.receivedAt;
          const callado = silencioMs > SILENCIO_MS;
          const hermanos = porUnidad.get(n.unitId) ?? [];

          // Discrepancia: dos nodos de la misma unidad deberían sentir
          // algo parecido. Una diferencia grande sugiere que uno se
          // soltó o que un sensor falla — el backend lo formaliza como
          // evento sensor_disagreement.
          let discrepa = false;
          if (n.accel && hermanos.length > 1) {
            const mia = magnitud(n.accel);
            discrepa = hermanos.some(
              (o) => o.nodeId !== n.nodeId && o.accel && Math.abs(magnitud(o.accel) - mia) > 0.5,
            );
          }

          return (
            <button
              key={n.nodeId}
              type="button"
              className={`node-card${selectedNodeId === n.nodeId ? ' is-selected' : ''}${
                callado ? ' is-quiet' : ''
              }`}
              onClick={() => onSelect(n.nodeId)}
            >
              <div className="node-card-head">
                <span className="node-code mono">{n.nodeId}</span>
                <span className={`node-role node-role-${n.role}`}>{ROLE_LABEL[n.role]}</span>
              </div>

              <dl className="node-stats">
                <dt>Unidad</dt>
                <dd className="mono">{n.unitId}</dd>

                <dt>Secuencia</dt>
                <dd>{n.seq}</dd>

                <dt>|a|</dt>
                <dd>{n.accel ? formatNumber(magnitud(n.accel), 2) : '—'}</dd>

                <dt>Velocidad</dt>
                <dd>
                  {n.gps?.speedMs != null ? `${formatNumber(n.gps.speedMs * 3.6, 1)} km/h` : '—'}
                </dd>

                <dt>Último dato</dt>
                <dd>{silencioMs < 1500 ? 'ahora' : `hace ${Math.round(silencioMs / 1000)} s`}</dd>
              </dl>

              {callado ? <p className="node-warn">Sin datos recientes</p> : null}
              {discrepa ? <p className="node-warn">Discrepa del otro nodo</p> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
