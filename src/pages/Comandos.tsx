/* Emisión de comandos y seguimiento sent → delivered → executed/rejected.
 *
 * El formulario oculta las acciones que el rol de la sesión no puede
 * emitir; la autoridad real la impone el backend antes de publicar en
 * MQTT y el nodo la revalida.
 */

import { useCallback, useState } from 'react';
import { PagedRows } from '../components/Pagination';

import { ApiError, api } from '../api/client';
import { useSocketEvent } from '../api/socket';
import { useApi } from '../api/useApi';
import type { Command, CommandUpdate, Unit } from '../api/types';
import { useSession } from '../auth/context';
import { CommandStatusBadge } from '../components/Badges';
import { AsyncBoundary } from '../components/States';
import { formatDateTime } from '../lib/format';
import { OPERATOR_ALLOWED_ACTIONS, type CmdAction } from '../contract/contract';
import './tables.css';
import './comandos.css';

const ACCIONES: { action: CmdAction; label: string; hint?: string }[] = [
  { action: 'set_sampling_rate', label: 'Ajustar muestreo', hint: 'samplingMs' },
  { action: 'set_thresholds', label: 'Ajustar umbrales', hint: 'impactG' },
  { action: 'trigger_alarm', label: 'Activar alarma' },
  { action: 'stop_alarm', label: 'Detener alarma' },
  { action: 'set_mode', label: 'Cambiar modo', hint: 'mode' },
  { action: 'toggle_sensor', label: 'Activar/desactivar sensor', hint: 'sensor' },
];

/** Parámetro que pide cada acción. Las alarmas no llevan ninguno. */
const PARAM_POR_ACCION: Partial<Record<CmdAction, { clave: string; etiqueta: string; placeholder: string }>> = {
  set_sampling_rate: { clave: 'samplingMs', etiqueta: 'Muestreo (ms)', placeholder: '1000' },
  set_thresholds: { clave: 'impactG', etiqueta: 'Umbral de impacto (g)', placeholder: '2.5' },
  set_mode: { clave: 'mode', etiqueta: 'Modo', placeholder: 'normal | inspection | alarm' },
  toggle_sensor: { clave: 'sensor', etiqueta: 'Sensor', placeholder: 'accelerometer' },
};

export default function Comandos() {
  const { user, can } = useSession();
  const unidades = useApi<Unit[]>(() => api.listUnits());
  const comandos = useApi<Command[]>(() => api.listCommands({ limit: 100 }), []);

  const [nodo, setNodo] = useState('');
  const [accion, setAccion] = useState<CmdAction>('trigger_alarm');
  const [valor, setValor] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  /** Avances que llegan por socket, superpuestos a la lista cargada:
   *  evita recargar la tabla entera en cada ack. */
  const [avances, setAvances] = useState<Record<string, CommandUpdate>>({});

  useSocketEvent(
    'command:update',
    useCallback((u: CommandUpdate) => {
      setAvances((prev) => ({ ...prev, [u.cmdId]: u }));
    }, []),
  );

  const permitidas = ACCIONES.filter((a) => can(a.action));
  const param = PARAM_POR_ACCION[accion];
  const nodos = (unidades.data ?? []).flatMap((u) => u.nodes);

  async function emitir(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAviso(null);
    setEnviando(true);
    try {
      const params: Record<string, unknown> = {};
      if (param && valor.trim() !== '') {
        // Los umbrales y el muestreo son numéricos; el resto, texto.
        const n = Number(valor);
        params[param.clave] = Number.isFinite(n) && valor.trim() !== '' ? n : valor.trim();
      }

      const cmd = await api.issueCommand({
        targetNodeId: nodo,
        action: accion,
        params: Object.keys(params).length > 0 ? params : undefined,
      });

      setAviso(`Comando enviado a ${cmd.targetNodeCode}. Esperando confirmación del nodo.`);
      setValor('');
      comandos.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.userMessage : 'No se pudo enviar el comando.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Comandos</h1>
          <p>
            {user
              ? can('set_sampling_rate')
                ? 'Tu rol puede emitir cualquier comando.'
                : 'Tu rol solo puede activar y detener alarmas.'
              : 'Inicia sesión para emitir comandos.'}
          </p>
        </div>
      </div>

      {user ? (
        <form className="cmd-form" onSubmit={emitir}>
          <div className="cmd-fields">
            <label className="field">
              <span>Nodo destino</span>
              <select value={nodo} onChange={(e) => setNodo(e.target.value)} required>
                <option value="">Elegir…</option>
                {nodos.map((n) => (
                  <option key={n.id} value={n.nodeCode}>
                    {n.nodeCode} ({n.role === 'primary' ? 'primario' : 'respaldo'})
                    {n.isOnline ? '' : ' — sin conexión'}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Acción</span>
              <select
                value={accion}
                onChange={(e) => {
                  setAccion(e.target.value as CmdAction);
                  setValor('');
                }}
              >
                {permitidas.map((a) => (
                  <option key={a.action} value={a.action}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>

            {param ? (
              <label className="field">
                <span>{param.etiqueta}</span>
                <input
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder={param.placeholder}
                  required
                />
              </label>
            ) : null}

            <button type="submit" className="btn btn-primary" disabled={enviando || !nodo}>
              {enviando ? 'Enviando…' : 'Enviar comando'}
            </button>
          </div>

          {/* Un nodo sin conexión no rechaza el comando: el broker lo
              retiene hasta que vuelva (clean:false en el contrato). */}
          <p className="cmd-nota">
            Si el nodo está sin conexión el comando queda en <b>Enviado</b> hasta que
            reconecte.
          </p>

          {error ? <p className="cmd-error" role="alert">{error}</p> : null}
          {aviso ? <p className="cmd-aviso" role="status">{aviso}</p> : null}

          {permitidas.length < ACCIONES.length ? (
            <p className="cmd-nota">
              {ACCIONES.length - permitidas.length} acciones ocultas: requieren rol de
              centro de control ({OPERATOR_ALLOWED_ACTIONS.length} disponibles para
              operador).
            </p>
          ) : null}
        </form>
      ) : null}

      <AsyncBoundary
        state={comandos}
        empty={{
          title: 'No se ha emitido ningún comando',
          hint: 'Los comandos enviados a los nodos aparecerán aquí con su avance.',
        }}
      >
        {(lista) => (
          <PagedRows items={lista} label="Seguimiento de comandos">{rows => (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Acción</th>
                  <th>Nodo</th>
                  <th>Estado</th>
                  <th>Emitido</th>
                  <th>Entregado</th>
                  <th>Ejecutado</th>
                  <th>Emitió</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((cmd) => {
                  const avance = avances[cmd.cmdId];
                  const estado = avance?.status ?? cmd.status;
                  const etiqueta =
                    ACCIONES.find((a) => a.action === cmd.action)?.label ?? cmd.action;
                  return (
                    <tr key={cmd.id} className={avance ? 'is-fresh' : undefined}>
                      <td>
                        {etiqueta}
                        {cmd.reason ? <span className="tag">{cmd.reason}</span> : null}
                      </td>
                      <td className="mono">{cmd.targetNodeCode}</td>
                      <td>
                        <CommandStatusBadge status={estado} />
                      </td>
                      <td className="tabular">{formatDateTime(cmd.issuedAt)}</td>
                      <td className="tabular">{formatDateTime(cmd.deliveredAt)}</td>
                      <td className="tabular">
                        {formatDateTime(cmd.executedAt ?? cmd.rejectedAt)}
                      </td>
                      <td>{cmd.issuedByEmail}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}</PagedRows>
        )}
      </AsyncBoundary>
    </>
  );
}
