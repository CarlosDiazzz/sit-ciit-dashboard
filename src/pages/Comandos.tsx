import DecisionBrief from '../components/DecisionBrief';
/* Envío de comandos y seguimiento sent -> delivered -> executed/rejected.
 * El formulario de emisión llega en la Fase 4; aquí queda el seguimiento
 * y el control de autoridad por rol.
 */

import { api } from '../api/client';
import { useApi } from '../api/useApi';
import type { Command } from '../api/types';
import { useSession } from '../auth/context';
import { AsyncBoundary } from '../components/States';
import { CommandStatusBadge } from '../components/Badges';
import { formatDateTime } from '../lib/format';
import './tables.css';

const ACTION_LABEL: Record<string, string> = {
  set_sampling_rate: 'Ajustar muestreo',
  set_thresholds: 'Ajustar umbrales',
  trigger_alarm: 'Activar alarma',
  stop_alarm: 'Detener alarma',
  set_mode: 'Cambiar modo',
  toggle_sensor: 'Activar/desactivar sensor',
};

export default function Comandos() {
  const state = useApi<Command[]>(() => api.listCommands({ limit: 100 }));
  const { user, can } = useSession();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Comandos</h1>
          <p>
            {user
              ? // Se avisa del alcance del rol para que no sorprenda que
                // falten botones: operator solo puede alarmas.
                can('set_sampling_rate')
                ? 'Tu rol puede emitir cualquier comando.'
                : 'Tu rol solo puede activar y detener alarmas.'
              : 'Inicia sesión para emitir comandos.'}
          </p>
        </div>
      </div>

      <DecisionBrief title="Enviado no significa ejecutado" evidence="Comprueba la entrega y la confirmación del nodo. Un rechazo requiere revisar su motivo; un comando pendiente no acredita una acción realizada." action="Contrasta el seguimiento con la bitácora antes de solicitar otra intervención. El envío de comandos aún no está disponible en esta vista." to="/bitacora" linkLabel="Consultar trazabilidad" />
      <AsyncBoundary
        state={state}
        empty={{
          title: 'No se ha emitido ningún comando',
          hint: 'Los comandos enviados a los nodos aparecerán aquí con su avance.',
        }}
      >
        {(comandos) => (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nodo destino</th><th>Acción</th>
                  <th>Estado</th>
                  <th>Emitido</th>
                  <th>Entregado</th>
                  <th>Ejecutado</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {comandos.map((cmd) => (
                  <tr key={cmd.id}>
                    <td className="mono">{cmd.targetNodeId}</td><td>{ACTION_LABEL[cmd.action] ?? cmd.action}</td>
                    <td>
                      <CommandStatusBadge status={cmd.status} />
                    </td>
                    <td className="tabular">{formatDateTime(cmd.issuedAt)}</td>
                    <td className="tabular">{formatDateTime(cmd.deliveredAt)}</td>
                    <td className="tabular">
                      {formatDateTime(cmd.executedAt ?? cmd.rejectedAt)}
                    </td>
                    <td>{cmd.reason ?? '—'}</td>
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
