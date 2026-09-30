/* Historial de eventos: severidad, confirmación y marca de tardíos.
 *
 * Los eventos nuevos llegan por Socket.IO y se anteponen a la lista
 * cargada: un centro de control no puede pedirle al operador que
 * recargue para enterarse de un impacto.
 */

import { useCallback, useState } from 'react';

import { api } from '../api/client';
import { useSocketEvent } from '../api/socket';
import { useApi } from '../api/useApi';
import type { EventBroadcast, EventRecord } from '../api/types';
import { AsyncBoundary } from '../components/States';
import { LateBadge, SeverityBadge } from '../components/Badges';
import { eventKindLabel, eventValueUnit } from '../lib/labels';
import { formatDateTime } from '../lib/format';
import './tables.css';

export default function Eventos() {
  const state = useApi<EventRecord[]>(() => api.listEvents({ limit: 100 }));
  /** Eventos llegados por socket desde la última carga. Se mantienen
   *  aparte en vez de recargar la lista entera en cada uno. */
  const [enVivo, setEnVivo] = useState<EventRecord[]>([]);

  useSocketEvent(
    'event',
    useCallback((ev: EventBroadcast) => {
      // El socket emite la forma del mensaje MQTT, no la de la fila: no
      // trae el id de la base ni el estado de confirmación. Se completa
      // con lo que la vista necesita y se marca como recién llegado.
      const fila: EventRecord = {
        id: `vivo-${ev.nodeId}-${ev.ts}`,
        unitId: ev.unitId,
        nodeId: ev.nodeId,
        kind: ev.kind,
        severity: ev.severity,
        value: ev.value ?? null,
        threshold: ev.threshold ?? null,
        gpsLat: ev.gps?.lat ?? null,
        gpsLon: ev.gps?.lon ?? null,
        ts: new Date(ev.ts).toISOString(),
        // Recién recibido: sin retraso apreciable entre ambos relojes.
        receivedAt: new Date().toISOString(),
        acknowledgedAt: null,
        acknowledgedBy: null,
      };
      setEnVivo((prev) => [fila, ...prev].slice(0, 100));
    }, []),
  );

  // Se combinan antes de decidir qué mostrar: con la lista guardada
  // vacía, AsyncBoundary pintaría el estado vacío y esconderia un
  // evento que acaba de llegar.
  const combinados: EventRecord[] | null =
    state.data === null && enVivo.length === 0 ? null : [...enVivo, ...(state.data ?? [])];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Eventos</h1>
          <p>Detecciones de los nodos y eventos generados por el backend.</p>
        </div>
      </div>

      <AsyncBoundary
        state={{ ...state, data: combinados }}
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
                  <tr key={ev.id} className={ev.id.startsWith('vivo-') ? 'is-fresh' : undefined}>
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
                    <td className="tabular">
                      {ev.value === null
                        ? '—'
                        : `${ev.value.toFixed(2)} ${eventValueUnit(ev.kind)}`.trim()}
                    </td>
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
