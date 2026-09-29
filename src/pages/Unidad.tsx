/* Estado de las unidades y sus nodos: primary/backup, fuente activa,
 * cola pendiente y último heartbeat.
 * Pendiente: gráficas en vivo con Recharts (Fase 1+).
 */

import { api } from '../api/client';
import { useApi } from '../api/useApi';
import type { Unit } from '../api/types';
import { AsyncBoundary } from '../components/States';
import { ConnectionBadge } from '../components/Badges';
import { formatAgo, formatNumber } from '../lib/format';
import './tables.css';

const ROLE_LABEL = { primary: 'Primario', backup: 'Respaldo' } as const;

export default function Unidad() {
  const state = useApi<Unit[]>(() => api.listUnits());

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Unidades</h1>
          <p>Nodos por unidad, fuente activa y estado del último heartbeat.</p>
        </div>
      </div>

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
                <div className="page-head">
                  <h2>{unidad.label ?? unidad.unitCode}</h2>
                </div>

                <div className="cards">
                  {unidad.nodes.map((nodo) => (
                    <article
                      key={nodo.id}
                      className={`card${unidad.activeNodeId === nodo.id ? ' is-active-source' : ''}`}
                    >
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

                        <dt>Muestreo</dt>
                        <dd>{nodo.samplingMs === null ? '—' : `${nodo.samplingMs} ms`}</dd>
                      </dl>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </AsyncBoundary>
    </>
  );
}
