import { Link } from "react-router-dom";
/* CRUD de nodos — solo control_center. El secreto es lo único que
 * autentica a un celular como un nodo real (contrato v1.3.0): sin él,
 * cualquiera podía declararse dueño de cualquier nodeId con solo
 * escribirlo. Se muestra una sola vez al crear/regenerar, igual que un
 * API key — nunca se vuelve a consultar.
 */

import { useState } from "react";
import PageBreadcrumbs from "../components/PageBreadcrumbs";

import { ApiError, api } from "../api/client";
import { useApi } from "../api/useApi";
import type { NodeCredentialRecord } from "../api/types";
import type { NodeRole } from "../contract/contract";
import { useSession } from "../auth/context";
import { AsyncBoundary } from "../components/States";
import { ConnectionBadge } from "../components/Badges";
import "./tables.css";
import "./usuarios.css";

const ROLES: NodeRole[] = ["primary", "backup"];

export default function Nodos() {
  const { user } = useSession();
  const nodos = useApi<NodeCredentialRecord[]>(() => api.listNodes(), []);

  const [nodeCode, setNodeCode] = useState("");
  const [unitCode, setUnitCode] = useState("");
  const [role, setRole] = useState<NodeRole>("primary");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revelado, setRevelado] = useState<{
    nodeCode: string;
    secret: string;
  } | null>(null);

  if (!["admin", "control_center"].includes(user?.role ?? "")) {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Nodos</h1>
            <p>Esta sección es solo para el centro de control.</p>
          </div>
          <PageBreadcrumbs current="Nodos" />
        </div>
      </>
    );
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const creado = await api.createNode({ nodeCode, unitCode, role });
      setRevelado({ nodeCode: creado.nodeCode, secret: creado.secret });
      setNodeCode("");
      setUnitCode("");
      nodos.reload();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.userMessage : "No se pudo crear el nodo.",
      );
    } finally {
      setEnviando(false);
    }
  }

  async function regenerar(n: NodeCredentialRecord) {
    if (
      !confirm(
        `¿Regenerar el secreto de ${n.nodeCode}? El anterior deja de servir de inmediato.`,
      )
    )
      return;
    try {
      const { secret } = await api.regenerateNodeSecret(n.id);
      setRevelado({ nodeCode: n.nodeCode, secret });
      nodos.reload();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.userMessage
          : "No se pudo regenerar el secreto.",
      );
    }
  }

  async function reactivar(n: NodeCredentialRecord) {
    if (
      !confirm(
        `¿Reactivar ${n.nodeCode} y generar un secreto nuevo? Tendrás que actualizar el celular.`,
      )
    )
      return;
    try {
      const { secret } = await api.reactivateNode(n.id);
      setRevelado({ nodeCode: n.nodeCode, secret });
      nodos.reload();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.userMessage
          : "No se pudo reactivar el nodo.",
      );
    }
  }

  async function borrar(n: NodeCredentialRecord) {
    if (
      !confirm(`¿Archivar el nodo ${n.nodeCode}? Su historial se conservará.`)
    )
      return;
    try {
      await api.deleteNode(n.id);
      nodos.reload();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.userMessage
          : "No se pudo borrar el nodo.",
      );
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Nodos</h1>
          <p>
            Alta de nodos y su secreto — sin él, un celular no puede publicar
            nada.
          </p>
        </div>
        <PageBreadcrumbs current="Nodos" />
      </div>

      {revelado ? (
        <div className="user-form" style={{ borderColor: "var(--warning)" }}>
          <p className="user-aviso" role="status">
            Secreto de <strong>{revelado.nodeCode}</strong> — cópialo ahora, no
            se vuelve a mostrar:
          </p>
          <p className="mono" style={{ wordBreak: "break-all", fontSize: 14 }}>
            {revelado.secret}
          </p>
          <button
            type="button"
            className="btn"
            onClick={() => setRevelado(null)}
          >
            Ya lo copié
          </button>
        </div>
      ) : null}

      <form className="user-form" onSubmit={crear}>
        <div className="user-fields">
          <label className="field">
            <span>Código del nodo</span>
            <input
              value={nodeCode}
              onChange={(e) => setNodeCode(e.target.value)}
              placeholder="unit-04-a"
              required
              autoCapitalize="none"
            />
          </label>

          <label className="field">
            <span>Código de la unidad</span>
            <input
              value={unitCode}
              onChange={(e) => setUnitCode(e.target.value)}
              placeholder="unit-04"
              required
              autoCapitalize="none"
            />
          </label>

          <label className="field">
            <span>Rol</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as NodeRole)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r === "primary" ? "Primario" : "Respaldo"}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" className="btn btn-primary" disabled={enviando}>
            {enviando ? "Creando…" : "Crear nodo"}
          </button>
        </div>

        {error ? (
          <p className="user-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>

      <AsyncBoundary
        state={nodos}
        empty={{
          title: "No hay nodos",
          hint: "Crea el primero con el formulario de arriba.",
        }}
      >
        {(lista) => (
          <PagedRows items={lista} label="Dispositivos registrados">{rows => (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nodo</th>
                  <th>Unidad</th>
                  <th>Rol</th>
                  <th>Secreto</th>
                  <th>Conexión</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((n) => (
                  <tr key={n.id}>
                    <td className="mono">{n.nodeCode}</td>
                    <td className="mono">{n.unitCode}</td>
                    <td>{n.role === "primary" ? "Primario" : "Respaldo"}</td>
                    <td>
                      <span
                        className={`badge ${n.hasSecret ? "badge-online" : "badge-warning"}`}
                      >
                        {n.hasSecret ? "Con secreto" : "Sin secreto"}
                      </span>
                    </td>
                    <td>
                      {n.active ? (
                        <ConnectionBadge online={n.isOnline} />
                      ) : (
                        <span>Archivado</span>
                      )}
                    </td>
                    <td>
                      <Link
                        className="btn"
                        to={`/historial-nodos?nodo=${n.id}`}
                      >
                        Historial
                      </Link>{" "}
                      {n.active ? (
                        <>
                          <button
                            type="button"
                            className="btn"
                            onClick={() => regenerar(n)}
                          >
                            Regenerar secreto
                          </button>{" "}
                          <button
                            type="button"
                            className="btn"
                            onClick={() => borrar(n)}
                          >
                            Archivar
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="btn"
                          onClick={() => reactivar(n)}
                        >
                          Reactivar y renovar secreto
                        </button>
                      )}
                    </td>
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
import { PagedRows } from '../components/Pagination';
