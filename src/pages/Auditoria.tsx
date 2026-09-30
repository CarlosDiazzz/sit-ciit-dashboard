import { useState } from "react";
import { UserRound } from 'lucide-react';
import { Pagination, PagedRows } from '../components/Pagination';
import PageBreadcrumbs from '../components/PageBreadcrumbs';
import { api } from "../api/client";
import { useApi } from "../api/useApi";
import "./gestion.css";
import "./tables.css";
export default function Auditoria() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [filter, setFilter] = useState("");
  const audit = useApi<any>(
    () => api.managementAudit({ page, limit, search: filter }),
    [page, limit, filter],
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
        <PageBreadcrumbs current="Auditoría administrativa" />
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
        <p role="alert">{audit.error.userMessage} <button className="btn" onClick={audit.reload}>Reintentar</button></p>
      ) : !audit.data?.items.length ? <div className="workspace-empty"><strong>No hay cambios para esta búsqueda.</strong></div> : (
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
                  <td><span className="person-cell"><span className="person-avatar" aria-hidden="true"><UserRound size={17} /></span>{r.actor_email ?? 'Sistema'}</span></td>
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
      <Pagination page={page} pageSize={limit} total={audit.data?.total ?? 0} disabled={audit.loading || !!audit.error} onPage={setPage} onPageSize={n => { setLimit(n); setPage(1); }} />
      <h2>Historial de notificaciones</h2>
      {deliveries.error ? (
        <p role="alert">{deliveries.error.userMessage}</p>
      ) : deliveries.loading ? (
        <p>Cargando…</p>
      ) : deliveries.data?.length ? (
        <PagedRows items={deliveries.data} label="Historial de notificaciones">{rows => (
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
              {rows.map((r) => (
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
        )}</PagedRows>
      ) : (
        <p>No hay notificaciones registradas.</p>
      )}
    </>
  );
}
