import { t as translate, locale } from '../accessibility/i18n';
import { RefreshCw } from 'lucide-react';
import { api } from "../api/client";
import PageBreadcrumbs from "../components/PageBreadcrumbs";
import { useApi } from "../api/useApi";
import "./gestion.css";
export default function Avisos() {
  const notices = useApi<
    {
      id: string;
      created_at: string;
      title: string;
      severity: string;
      incident_status: string;
    }[]
  >(() => api.managementMyNotifications(), []);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{translate("Mis avisos")}</h1>
          <p>{translate("Notificaciones de incidentes dentro de tu ámbito de acceso.")}</p>
        </div>
        <div className="page-head-actions">
          <PageBreadcrumbs current="Mis avisos" />
          <button
            className="btn page-refresh-btn"
            onClick={notices.reload}
            disabled={notices.loading}
          >
            <RefreshCw size={15} aria-hidden="true" />
            {translate("Actualizar")}
          </button>
        </div>
      </div>
      {notices.loading ? (
        <p role="status">{translate("Cargando avisos…")}</p>
      ) : notices.error ? (
        <p role="alert">{translate(notices.error.userMessage)}</p>
      ) : notices.data?.length ? (
        notices.data.map((n) => (
          <article className="management-note" key={n.id}>
            <h2>{translate(n.title)}</h2>
            <p>
              {translate(new Date(n.created_at).toLocaleString(locale()))} ·{" "}
              {
                translate((
                  {
                    info: "Información",
                    warning: "Advertencia",
                    critical: "Crítico",
                  } as Record<string, string>
                )[n.severity])
              }
            </p>
            <p>{translate("Estado:")}{" "}
              {
                translate((
                  {
                    open: "Abierto",
                    acknowledged: "Reconocido",
                    in_progress: "En atención",
                    resolved: "Resuelto",
                    dismissed: "Descartado",
                  } as Record<string, string>
                )[n.incident_status])
              }
            </p>
          </article>
        ))
      ) : (
        <p>{translate("No tienes avisos disponibles.")}</p>
      )}
    </>
  );
}
