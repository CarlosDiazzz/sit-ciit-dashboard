import DecisionBrief from '../components/DecisionBrief';
/* Bitácora: historial completo de transiciones de comandos, para
 * auditoría (quién mandó qué y cuándo). Fase 4.
 */

import { api } from '../api/client';
import { useApi } from '../api/useApi';
import type { CommandLogEntry } from '../api/types';
import { AsyncBoundary } from '../components/States';
import { CommandStatusBadge } from '../components/Badges';
import { formatDateTime } from '../lib/format';
import './tables.css';

export default function Bitacora() {
  const state = useApi<CommandLogEntry[]>(() => api.listCommandLog());

  return (
    <>
      <div className="page-head">
        <div>
          <span className="dss-kicker">TEZCATLIPOCA / TRAZABILIDAD</span><h1>Auditoría</h1>
          <p>Registro de auditoría: cada cambio de estado de cada comando.</p>
        </div>
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
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Cuándo</th>
                  <th>Comando</th>
                  <th>Estado</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {entradas.map((entrada) => (
                  <tr key={entrada.id}>
                    <td className="tabular">{formatDateTime(entrada.occurredAt)}</td>
                    <td className="mono">{entrada.commandId.slice(0, 8)}</td>
                    <td>
                      <CommandStatusBadge status={entrada.status} />
                    </td>
                    <td>{entrada.reason ?? '—'}</td>
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
