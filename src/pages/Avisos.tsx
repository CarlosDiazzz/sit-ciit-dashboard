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
          <h1>Mis avisos</h1>
          <p>Notificaciones de incidentes dentro de tu ámbito de acceso.</p>
        </div>
        <PageBreadcrumbs current="Mis avisos" />
        <button className="btn" onClick={notices.reload}>
          Actualizar
        </button>
      </div>
      {notices.loading ? (
        <p role="status">Cargando avisos…</p>
      ) : notices.error ? (
        <p role="alert">{notices.error.userMessage}</p>
      ) : notices.data?.length ? (
        notices.data.map((n) => (
          <article className="management-note" key={n.id}>
            <h2>{n.title}</h2>
            <p>
              {new Date(n.created_at).toLocaleString("es-MX")} ·{" "}
              {
                (
                  {
                    info: "Información",
                    warning: "Advertencia",
                    critical: "Crítico",
                  } as Record<string, string>
                )[n.severity]
              }
            </p>
            <p>
              Estado:{" "}
              {
                (
                  {
                    open: "Abierto",
                    acknowledged: "Reconocido",
                    in_progress: "En atención",
                    resolved: "Resuelto",
                    dismissed: "Descartado",
                  } as Record<string, string>
                )[n.incident_status]
              }
            </p>
          </article>
        ))
      ) : (
        <p>No tienes avisos disponibles.</p>
      )}
    </>
  );
}
