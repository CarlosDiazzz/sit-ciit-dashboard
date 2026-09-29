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
          <h1>Bitácora</h1>
          <p>Registro de auditoría: cada cambio de estado de cada comando.</p>
        </div>
      </div>

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
