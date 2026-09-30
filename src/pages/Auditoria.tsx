import { useState } from "react";
import { api } from "../api/client";
import { useApi } from "../api/useApi";
import "./gestion.css";
import "./tables.css";
export default function Auditoria() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");
  const audit = useApi<any>(
    () => api.managementAudit({ page, search: filter }),
    [page, filter],
  );
  const deliveries = useApi<any[]>(() => api.managementDeliveries(), []);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Auditoría administrativa</h1>
          <p>
            Historial de cambios y responsables; los registros se conservan sin
            edición.
          </p>
        </div>
      </div>
      <label className="field">
        Filtrar por módulo
        <input
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(1);
          }}
        />
      </label>
      {audit.loading ? (
        <p>Cargando…</p>
      ) : audit.error ? (
        <p role="alert">{audit.error.userMessage}</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Persona</th>
                <th>Módulo</th>
                <th>Acción</th>
                <th>Cambios</th>
              </tr>
            </thead>
            <tbody>
              {audit.data?.items.map((r: any) => (
                <tr key={r.id}>
                  <td>{new Date(r.created_at).toLocaleString("es-MX")}</td>
                  <td>{r.actor_email}</td>
                  <td>{r.resource}</td>
                  <td>
                    {(
                      {
                        create: "Creación",
                        update: "Edición",
                        archive: "Archivo",
                        "rotate-secret": "Cambio de secreto",
                      } as Record<string, string>
                    )[r.action] ?? r.action}
                  </td>
                  <td>
                    <details>
                      <summary>Ver cambios</summary>
                      <pre>
                        {JSON.stringify(
                          { antes: r.before_data, despues: r.after_data },
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="management-toolbar">
        <button
          className="btn"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          Anterior
        </button>
        <span>Página {page}</span>
        <button
          className="btn"
          disabled={page * 25 >= (audit.data?.total ?? 0)}
          onClick={() => setPage(page + 1)}
        >
          Siguiente
        </button>
      </div>
      <h2>Historial de notificaciones</h2>
      {deliveries.error ? (
        <p role="alert">{deliveries.error.userMessage}</p>
      ) : deliveries.loading ? (
        <p>Cargando…</p>
      ) : deliveries.data?.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Regla</th>
                <th>Canal</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.data.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.created_at).toLocaleString("es-MX")}</td>
                  <td>{r.name}</td>
                  <td>{r.channel}</td>
                  <td>{r.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No hay notificaciones registradas.</p>
      )}
    </>
  );
}
