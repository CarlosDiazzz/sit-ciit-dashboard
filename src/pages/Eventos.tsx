/* Historial de eventos: severidad, confirmación y marca de tardíos.
 * Implementación completa: Fase 2 (eventos) y Fase 3 (marca de tardíos).
 */

import { useCallback } from 'react';
import { api } from '../api/client';
import { useSocketEvent } from '../api/socket';
import { useApi } from '../api/useApi';
import type { EventRecord } from '../api/types';
import { AsyncBoundary } from '../components/States';
import { LateBadge, SeverityBadge } from '../components/Badges';
import { eventKindLabel } from '../lib/labels';
import { formatDateTime } from '../lib/format';
import './tables.css';

export default function Eventos() {
  const state = useApi<EventRecord[]>(() => api.listEvents({ limit: 100 }));

  // El backend reemite cada evento recién guardado (device o generado por
  // él mismo, ej. weather_risk); se recarga la lista real en vez de
  // intentar insertar el payload del socket a mano (tiene otra forma, ver
  // EventBroadcast en api/types.ts).
  const onEvent = useCallback(() => state.reload(), [state]);
  useSocketEvent('event', onEvent);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Eventos</h1>
          <p>Detecciones de los nodos y eventos generados por el backend.</p>
        </div>
      </div>

      <AsyncBoundary
        state={state}
        empty={{
          title: 'Sin eventos registrados',
          hint: 'Aparecerán aquí en cuanto un nodo detecte un impacto, apertura de puerta o volcadura.',
        }}
      >
        {(eventos) => (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Severidad</th>
                  <th>Ocurrió</th>
                  <th>Valor</th>
                  <th>Umbral</th>
                  <th>Confirmado</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map((ev) => (
                  <tr key={ev.id}>
                    <td>
                      {eventKindLabel(ev.kind)}
                      {/* Los eventos sin nodo los generó el backend
                          comparando primary contra backup. */}
                      {ev.nodeId === null ? (
                        <span className="tag">unidad</span>
                      ) : null}
                    </td>
                    <td>
                      <SeverityBadge severity={ev.severity} />
                    </td>
                    <td className="tabular">
                      {formatDateTime(ev.ts)}{' '}
                      <LateBadge ts={ev.ts} receivedAt={ev.receivedAt} />
                    </td>
                    <td className="tabular">{ev.value ?? '—'}</td>
                    <td className="tabular">{ev.threshold ?? '—'}</td>
                    <td className="tabular">
                      {ev.acknowledgedAt ? formatDateTime(ev.acknowledgedAt) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AsyncBoundary>
    </>
  );
}
