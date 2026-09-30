import { t as translate, locale } from '../accessibility/i18n';
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
          <h1>{translate("Auditoría administrativa")}</h1>
          <p>{translate("Historial de cambios y responsables; los registros se conservan sin edición.")}</p>
        </div>
        <PageBreadcrumbs current="Auditoría administrativa" />
      </div>
      <label className="field">{translate("Filtrar por módulo")}<input
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(1);
          }}
        />
      </label>
      {audit.loading ? (
        <p>{translate("Cargando…")}</p>
      ) : audit.error ? (
        <p role="alert">{translate(audit.error.userMessage)} <button className="btn" onClick={audit.reload}>{translate("Reintentar")}</button></p>
      ) : !audit.data?.items.length ? <div className="workspace-empty"><strong>{translate("No hay cambios para esta búsqueda.")}</strong></div> : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{translate("Fecha")}</th>
                <th>{translate("Persona")}</th>
                <th>{translate("Módulo")}</th>
                <th>{translate("Acción")}</th>
                <th>{translate("Cambios")}</th>
              </tr>
            </thead>
            <tbody>
              {translate(audit.data?.items.map((r: any) => (
                <tr key={r.id}>
                  <td>{translate(new Date(r.created_at).toLocaleString(locale()))}</td>
                  <td><span className="person-cell"><span className="person-avatar" aria-hidden="true"><UserRound size={17} /></span>{translate(r.actor_email ?? 'Sistema')}</span></td>
                  <td>{translate(r.resource)}</td>
                  <td>
                    {translate((
                      {
                        create: "Creación",
                        update: "Edición",
                        archive: "Archivo",
                        "rotate-secret": "Cambio de secreto",
                      } as Record<string, string>
                    )[r.action] ?? r.action)}
                  </td>
                  <td>
                    <details>
                      <summary>{translate("Ver cambios")}</summary>
                      <pre>
                        {translate(JSON.stringify(
                          { antes: r.before_data, despues: r.after_data },
                          null,
                          2,
                        ))}
                      </pre>
                    </details>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pageSize={limit} total={audit.data?.total ?? 0} disabled={audit.loading || !!audit.error} onPage={setPage} onPageSize={n => { setLimit(n); setPage(1); }} />
      <h2>{translate("Historial de notificaciones")}</h2>
      {deliveries.error ? (
        <p role="alert">{translate(deliveries.error.userMessage)}</p>
      ) : deliveries.loading ? (
        <p>{translate("Cargando…")}</p>
      ) : deliveries.data?.length ? (
        <PagedRows items={deliveries.data} label={translate("Historial de notificaciones")}>{rows => (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{translate("Fecha")}</th>
                <th>{translate("Regla")}</th>
                <th>{translate("Canal")}</th>
                <th>{translate("Resultado")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{translate(new Date(r.created_at).toLocaleString(locale()))}</td>
                  <td>{translate(r.name)}</td>
                  <td>{translate(r.channel)}</td>
                  <td>{translate(r.detail)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}</PagedRows>
      ) : (
        <p>{translate("No hay notificaciones registradas.")}</p>
      )}
    </>
  );
}
