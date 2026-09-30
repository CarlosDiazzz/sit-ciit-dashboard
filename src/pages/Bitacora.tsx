import DecisionBrief from '../components/DecisionBrief';
import { PagedRows } from '../components/Pagination';
/* Bitácora: cada cambio de estado de cada comando, para auditoría.
 *
 * A diferencia de la vista de Comandos, que muestra el estado actual,
 * aquí queda el historial completo: incluye los acks tardíos que no
 * hicieron avanzar el estado, porque para una auditoría importa que el
 * mensaje llegó, no solo el resultado final.
 */

import { api } from '../api/client';
import PageBreadcrumbs from '../components/PageBreadcrumbs';
import { useApi } from '../api/useApi';
import type { CommandLogEntry } from '../api/types';
import { AsyncBoundary } from '../components/States';
import { CommandStatusBadge } from '../components/Badges';
import { formatDateTime } from '../lib/format';
import './tables.css';

const ACCION_LABEL: Record<string, string> = {
  set_sampling_rate: 'Ajustar muestreo',
  set_thresholds: 'Ajustar umbrales',
  trigger_alarm: 'Activar alarma',
  stop_alarm: 'Detener alarma',
  set_mode: 'Cambiar modo',
  toggle_sensor: 'Activar/desactivar sensor',
};

export default function Bitacora() {
  const state = useApi<CommandLogEntry[]>(() => api.listCommandLog());

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Bitácora</h1>
          <p>Registro de auditoría: quién mandó qué, a qué nodo y cuándo.</p>
        </div>
        <PageBreadcrumbs current="Bitácora" />
      </div>

      <DecisionBrief title="Reconstruye la secuencia de la intervención" evidence="Cada entrada representa una transición de estado. Compara los tiempos y motivos del mismo comando para comprender qué ocurrió." action="Revisa el seguimiento del comando para distinguir una solicitud enviada de una ejecución confirmada." to="/comandos" linkLabel="Revisar comandos" />
      <AsyncBoundary
        state={state}
        empty={{
          title: 'La bitácora está vacía',
          hint: 'Se irá llenando conforme se emitan comandos y los nodos los confirmen.',
        }}
      >
        {(entradas) => (
          <PagedRows items={entradas} label="Historial de comandos">{rows => (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Cuándo</th>
                  <th>Acción</th>
                  <th>Nodo</th>
                  <th>Estado</th>
                  <th>Emitió</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td className="tabular">{formatDateTime(e.occurredAt)}</td>
                    <td>{ACCION_LABEL[e.action] ?? e.action}</td>
                    <td className="mono">{e.targetNodeCode}</td>
                    <td>
                      <CommandStatusBadge status={e.status} />
                    </td>
                    <td>{e.issuedByEmail}</td>
                    <td>{e.reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}</PagedRows>
        )}
      </AsyncBoundary>
    </>
  );
}
