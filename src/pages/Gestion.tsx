import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useApi } from "../api/useApi";
import { useSession } from "../auth/context";
import "./tables.css";
import "./usuarios.css";
import "./gestion.css";
type Value = string | number | boolean | null;
type RecordData = Record<string, any> & { id: string; active: boolean };
interface Field {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  resource?: string;
  min?: number;
  max?: number;
  roles?: string[];
}
interface Resource {
  key: string;
  label: string;
  fields: Field[];
  canWrite: boolean;
  canCreate: boolean;
}
interface Page {
  items: RecordData[];
  total: number;
  page: number;
  limit: number;
}
interface Option {
  id: string;
  label: string;
}
interface Note {
  id: string;
  body: string;
  evidence_url: string | null;
  author: string;
  created_at: string;
}
const message = (e: unknown) =>
  e instanceof ApiError ? e.userMessage : String(e);
const defaults = (resource: Resource) =>
  Object.fromEntries(
    resource.fields.map((f) => [
      f.key,
      f.type === "boolean"
        ? [
            "accelerometer_enabled",
            "gyroscope_enabled",
            "gps_enabled",
            "notification_email",
            "final_leg",
          ].includes(f.key)
        : f.type === "select" && f.required
          ? (f.options?.[0]?.value ?? "")
          : "",
    ]),
  );
function display(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return String(value);
}
export default function Gestion() {
  const { resource } = useParams();
  return <GestionModule key={resource ?? "index"} resource={resource ?? ""} />;
}
function GestionModule({ resource }: { resource: string }) {
  const definitions = useApi<Resource[]>(() => api.managementResources(), []);
  const selected = definitions.data?.find((r) => r.key === resource);
  const { user } = useSession();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [archived, setArchived] = useState(false);
  const [editing, setEditing] = useState<RecordData | null | undefined>(
    undefined,
  );
  const [form, setForm] = useState<Record<string, Value>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [detail, setDetail] = useState<RecordData | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [note, setNote] = useState("");
  const [evidence, setEvidence] = useState("");
  const [report, setReport] = useState<any>(null);
  const [applyNode, setApplyNode] = useState("");
  const [applications, setApplications] = useState<any[]>([]);
  const deviceOptions = useApi<Option[]>(
    () =>
      resource === "monitoring-profiles" &&
      ["admin", "control_center"].includes(user?.role ?? "")
        ? api.managementOptions("nodes")
        : Promise.resolve([]),
    [resource, user?.role],
  );
  const data = useApi<Page>(
    async () =>
      resource
        ? api.managementList(resource, { page, search: filter, archived })
        : { items: [], total: 0, page: 1, limit: 25 },
    [resource, page, filter, archived],
  );
  const references = useApi<Record<string, Option[]>>(async () => {
    if (!selected || !selected.canWrite) return {};
    const keys = [
      ...new Set(
        selected.fields.filter((f) => f.resource).map((f) => f.resource!),
      ),
    ];
    const results = await Promise.all(
      keys.map(async (key) => [key, await api.managementOptions(key)] as const),
    );
    return Object.fromEntries(results);
  }, [selected?.key, selected?.canWrite]);
  const fields =
    selected?.fields.filter(
      (f) =>
        !f.roles || f.roles.includes(String(form.role ?? editing?.role ?? "")),
    ) ?? [];
  const editable = selected?.canWrite === true;
  function start(row: RecordData | null) {
    setError("");
    setNotice("");
    setEditing(row);
    const next = { ...defaults(selected!), ...(row ?? {}) };
    delete next.password;
    setForm(next);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload: Record<string, Value> = {};
      for (const f of fields) {
        const v = form[f.key];
        if (f.type === "password" && !v) continue;
        if (v === "" || v === undefined) {
          if (!f.required) payload[f.key] = null;
          continue;
        }
        payload[f.key] =
          f.type === "number"
            ? Number(v)
            : f.type === "datetime"
              ? new Date(String(v)).toISOString()
              : v;
      }
      if (editing) await api.managementUpdate(resource, editing.id, payload);
      else await api.managementCreate(resource, payload);
      setEditing(undefined);
      setNotice("Registro guardado.");
      data.reload();
      references.reload();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function archive(row: RecordData) {
    if (
      busy ||
      !confirm("¿Archivar este registro? Su historial se conservará.")
    )
      return;
    setBusy(true);
    setError("");
    try {
      await api.managementArchive(resource, row.id);
      setNotice("Registro archivado.");
      data.reload();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function inspect(row: RecordData) {
    setDetail(row);
    setNotes([]);
    setReport(null);
    setError("");
    if (resource === "incidents") {
      try {
        setNotes(await api.managementNotes(row.id));
      } catch (e) {
        setError(message(e));
      }
    }
    if (resource === "monitoring-profiles") {
      try {
        setApplications(await api.managementApplications(row.id));
      } catch (e) {
        setError(message(e));
      }
    }
  }
  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!detail) return;
    setBusy(true);
    setError("");
    try {
      await api.managementAddNote(detail.id, {
        body: note,
        evidence_url: evidence || null,
      });
      setNote("");
      setEvidence("");
      setNotes(await api.managementNotes(detail.id));
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function loadReport(row: RecordData) {
    setBusy(true);
    setError("");
    try {
      setReport(await api.managementReport(row.id));
      setDetail(null);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function reactivate(row: RecordData) {
    setBusy(true);
    setError("");
    try {
      await api.managementUpdate(resource, row.id, { active: true });
      data.reload();
      setNotice("Registro reactivado.");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function apply(e: React.FormEvent) {
    e.preventDefault();
    if (!detail) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.managementApply(detail.id, applyNode);
      setNotice(
        "Configuración enviada. Revisa los ACK en Comandos. " +
          result.limitations.join(" "),
      );
      setApplications(await api.managementApplications(detail.id));
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const valueLabel = (f: Field, v: Value | undefined) =>
    f.options?.find((o) => o.value === v)?.label ??
    references.data?.[f.resource ?? ""]?.find((o) => o.id === v)?.label ??
    (f.type === "reference" && v
      ? "Registro relacionado"
      : f.type === "datetime" && v
        ? new Date(String(v)).toLocaleString("es-MX")
        : display(v));
  if (definitions.loading) return <p role="status">Cargando módulos…</p>;
  if (definitions.error)
    return (
      <div role="alert">
        {definitions.error.userMessage}
        <button className="btn" onClick={definitions.reload}>
          Reintentar
        </button>
      </div>
    );
  if (!resource)
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Gestión logística</h1>
            <p>
              Administra los recursos y sigue la carga desde la preparación
              hasta la entrega.
            </p>
          </div>
        </div>
        <div className="management-cards">
          {definitions.data?.map((r) => (
            <Link
              className="management-card"
              key={r.key}
              to={`/gestion/${r.key}`}
            >
              <strong>{r.label}</strong>
              <span>
                {r.canWrite ? "Administrar registros" : "Consultar registros"}
              </span>
            </Link>
          ))}
          {["admin", "control_center", "auditor"].includes(
            user?.role ?? "",
          ) && (
            <Link className="management-card" to="/auditoria">
              <strong>Auditoría administrativa</strong>
              <span>Cambios y responsables</span>
            </Link>
          )}
        </div>
      </>
    );
  if (!selected)
    return <p role="alert">Este módulo no está disponible para tu cuenta.</p>;
  const columns = selected.fields
    .filter((f) => f.type !== "password" && !f.roles)
    .slice(0, 5);
  return (
    <>
      <div className="page-head">
        <div>
          <Link to="/gestion">← Módulos</Link>
          <h1>{selected.label}</h1>
          <p>
            {editable
              ? "Altas, edición y archivo con conservación del historial."
              : "Consulta de registros dentro de tu ámbito de acceso."}
          </p>
        </div>
        {selected.canCreate && (
          <button className="btn btn-primary" onClick={() => start(null)}>
            Nuevo registro
          </button>
        )}
      </div>
      {resource === "nodes" && editable && (
        <p>
          <Link to="/nodos">Registrar dispositivo y generar secreto →</Link>
        </p>
      )}
      {resource === "monitoring-profiles" && (
        <p className="management-hint">
          Estos perfiles guardan la configuración deseada. Su aplicación al nodo
          se confirma mediante comandos y ACK; los límites ambientales internos
          requieren sensores compatibles.
        </p>
      )}
      {resource === "notification-rules" && (
        <p className="management-hint">
          Los avisos de dashboard quedan disponibles en el sistema. Correo,
          Telegram y SMS requieren integrar sus adaptadores de envío.
        </p>
      )}
      {error && (
        <p className="user-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="user-aviso" role="status">
          {notice}
        </p>
      )}
      {editing !== undefined && (
        <form className="user-form" onSubmit={save}>
          <h2>{editing ? "Editar registro" : "Nuevo registro"}</h2>
          {references.loading ? (
            <p>Cargando catálogos…</p>
          ) : references.error ? (
            <p role="alert">
              {references.error.userMessage}
              <button type="button" className="btn" onClick={references.reload}>
                Reintentar
              </button>
            </p>
          ) : (
            <div className="management-fields">
              {fields.map((f) => {
                let value = form[f.key] ?? "";
                if (f.type === "datetime" && value) {
                  const d = new Date(String(value));
                  if (!Number.isNaN(d.getTime()))
                    value = new Date(
                      d.getTime() - d.getTimezoneOffset() * 60000,
                    )
                      .toISOString()
                      .slice(0, 16);
                }
                return (
                  <label className="field" key={f.key}>
                    <span>
                      {f.label}
                      {f.required ? " *" : ""}
                    </span>
                    {f.type === "boolean" ? (
                      <input
                        aria-label={f.label}
                        type="checkbox"
                        checked={Boolean(value)}
                        onChange={(e) =>
                          setForm({ ...form, [f.key]: e.target.checked })
                        }
                      />
                    ) : f.type === "textarea" ? (
                      <textarea
                        aria-label={f.label}
                        value={String(value)}
                        required={f.required}
                        onChange={(e) =>
                          setForm({ ...form, [f.key]: e.target.value })
                        }
                      />
                    ) : ["select", "reference"].includes(f.type) ? (
                      <select
                        aria-label={f.label}
                        value={String(value)}
                        required={f.required}
                        onChange={(e) =>
                          setForm({ ...form, [f.key]: e.target.value })
                        }
                      >
                        <option value="">Seleccionar…</option>
                        {f.type === "reference"
                          ? (references.data?.[f.resource!] ?? []).map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.label}
                              </option>
                            ))
                          : f.options?.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                      </select>
                    ) : (
                      <input
                        aria-label={f.label}
                        type={f.type === "datetime" ? "datetime-local" : f.type}
                        value={String(value)}
                        required={
                          f.required || (f.type === "password" && !editing)
                        }
                        min={f.min}
                        max={f.max}
                        step={
                          f.type === "number"
                            ? ["position", "sampling_ms"].includes(f.key)
                              ? 1
                              : "any"
                            : undefined
                        }
                        minLength={f.type === "password" ? 8 : undefined}
                        autoComplete={
                          f.type === "password" ? "new-password" : "off"
                        }
                        onChange={(e) =>
                          setForm({ ...form, [f.key]: e.target.value })
                        }
                      />
                    )}
                  </label>
                );
              })}
            </div>
          )}
          <div className="management-actions">
            <button
              className="btn btn-primary"
              disabled={busy || references.loading || !!references.error}
            >
              {busy ? "Guardando…" : "Guardar"}
            </button>
            <button
              className="btn"
              type="button"
              disabled={busy}
              onClick={() => setEditing(undefined)}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
      <form
        className="management-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setFilter(search);
        }}
      >
        <input
          aria-label="Buscar registros"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por código o nombre…"
        />
        <button className="btn">Buscar</button>
        <label>
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => {
              setArchived(e.target.checked);
              setPage(1);
            }}
          />{" "}
          Incluir archivados
        </label>
        <button className="btn" type="button" onClick={data.reload}>
          Actualizar
        </button>
      </form>
      {data.loading ? (
        <p role="status">Cargando registros…</p>
      ) : data.error ? (
        <p role="alert">
          {data.error.userMessage}
          <button className="btn" onClick={data.reload}>
            Reintentar
          </button>
        </p>
      ) : !data.data?.items.length ? (
        <p>No hay registros para estos filtros.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {columns.map((f) => (
                  <th key={f.key}>{f.label}</th>
                ))}
                <th>Vigencia</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.data.items.map((row) => (
                <tr key={row.id}>
                  {columns.map((f) => (
                    <td key={f.key}>
                      {row._labels?.[f.key] ?? valueLabel(f, row[f.key])}
                    </td>
                  ))}
                  <td>{row.active ? "Activo" : "Archivado"}</td>
                  <td>
                    {resource === "nodes" && <strong>{row.node_code}</strong>}
                    <div className="management-actions">
                      <button className="btn" onClick={() => void inspect(row)}>
                        Detalle
                      </button>
                      {resource === "trips" && (
                        <button
                          className="btn"
                          disabled={busy}
                          onClick={() => void loadReport(row)}
                        >
                          Reporte
                        </button>
                      )}
                      {editable && row.active && (
                        <>
                          <button
                            className="btn"
                            disabled={busy}
                            onClick={() => start(row)}
                          >
                            Editar
                          </button>
                          <button
                            className="btn"
                            disabled={busy || row.id === user?.id}
                            onClick={() => void archive(row)}
                          >
                            Archivar
                          </button>
                        </>
                      )}
                      {editable && !row.active && resource !== "nodes" && (
                        <button
                          className="btn"
                          disabled={busy}
                          onClick={() => void reactivate(row)}
                        >
                          Reactivar
                        </button>
                      )}
                    </div>
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
          disabled={page === 1 || data.loading}
          onClick={() => setPage(page - 1)}
        >
          Anterior
        </button>
        <span>
          Página {page} · {data.data?.total ?? 0} registros
        </span>
        <button
          className="btn"
          disabled={data.loading || page * 25 >= (data.data?.total ?? 0)}
          onClick={() => setPage(page + 1)}
        >
          Siguiente
        </button>
      </div>
      {detail && (
        <section className="user-form">
          <div className="management-toolbar">
            <h2>Detalle del registro</h2>
            <button className="btn" onClick={() => setDetail(null)}>
              Cerrar
            </button>
          </div>
          <dl className="management-detail">
            {selected.fields
              .filter(
                (f) =>
                  f.type !== "password" &&
                  (!f.roles || f.roles.includes(String(detail.role ?? ""))),
              )
              .map((f) => (
                <div key={f.key}>
                  <dt>{f.label}</dt>
                  <dd>
                    {detail._labels?.[f.key] ?? valueLabel(f, detail[f.key])}
                  </dd>
                </div>
              ))}
            <div>
              <dt>Creado</dt>
              <dd>
                {new Date(String(detail.created_at)).toLocaleString("es-MX")}
              </dd>
            </div>
            {detail.version && (
              <div>
                <dt>Versión</dt>
                <dd>{detail.version}</dd>
              </div>
            )}
          </dl>
          {resource === "monitoring-profiles" && (
            <>
              <h3>Aplicaciones al dispositivo</h3>
              {["admin", "control_center"].includes(user?.role ?? "") &&
                detail.active && (
                  <form className="management-toolbar" onSubmit={apply}>
                    <select
                      aria-label="Dispositivo para aplicar perfil"
                      required
                      value={applyNode}
                      onChange={(e) => setApplyNode(e.target.value)}
                    >
                      <option value="">Selecciona un dispositivo</option>
                      {deviceOptions.data?.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.label}
                        </option>
                      ))}
                    </select>
                    <button className="btn" disabled={busy}>
                      Aplicar muestreo y umbral de impacto
                    </button>
                  </form>
                )}
              {applications.length ? (
                applications.map((a) => (
                  <article key={a.id} className="management-note">
                    <strong>
                      {a.node_code} · versión {a.profile_version}
                    </strong>
                    {a.commands.map((c: any) => (
                      <p key={c.cmd_id}>
                        {c.action} · {c.status}
                        {c.reason ? " · " + c.reason : ""}
                      </p>
                    ))}
                  </article>
                ))
              ) : (
                <p>Sin aplicaciones registradas.</p>
              )}
              <button className="btn" onClick={() => void inspect(detail)}>
                Actualizar confirmaciones
              </button>
            </>
          )}
          {resource === "incidents" && (
            <>
              <h3>Comentarios y evidencias</h3>
              {notes.length ? (
                notes.map((n) => (
                  <article className="management-note" key={n.id}>
                    <strong>
                      {n.author} ·{" "}
                      {new Date(n.created_at).toLocaleString("es-MX")}
                    </strong>
                    <p>{n.body}</p>
                    {n.evidence_url && (
                      <a href={n.evidence_url} target="_blank" rel="noreferrer">
                        Abrir evidencia
                      </a>
                    )}
                  </article>
                ))
              ) : (
                <p>Sin comentarios.</p>
              )}
              {editable &&
                !["resolved", "dismissed"].includes(String(detail.status)) && (
                  <form onSubmit={addNote} className="management-fields">
                    <label className="field">
                      Comentario
                      <textarea
                        required
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                      />
                    </label>
                    <label className="field">
                      Enlace a evidencia
                      <input
                        type="url"
                        value={evidence}
                        onChange={(e) => setEvidence(e.target.value)}
                      />
                    </label>
                    <button className="btn" disabled={busy}>
                      Agregar comentario
                    </button>
                  </form>
                )}
            </>
          )}
        </section>
      )}
      {report && (
        <section className="user-form">
          <h2>Reporte: {report.trip.name}</h2>
          <dl className="management-detail">
            <div>
              <dt>Lecturas reales</dt>
              <dd>{report.telemetry.samples}</dd>
            </div>
            <div>
              <dt>Lecturas recibidas con más de 30 s de demora</dt>
              <dd>{report.telemetry.delayed_samples}</dd>
            </div>
            <div>
              <dt>Velocidad promedio</dt>
              <dd>
                {report.telemetry.average_speed_kmh == null
                  ? "Sin datos"
                  : `${Number(report.telemetry.average_speed_kmh).toFixed(1)} km/h`}
              </dd>
            </div>
            <div>
              <dt>Velocidad máxima</dt>
              <dd>
                {report.telemetry.max_speed_kmh == null
                  ? "Sin datos"
                  : `${Number(report.telemetry.max_speed_kmh).toFixed(1)} km/h`}
              </dd>
            </div>
          </dl>
          <h3>Envíos</h3>
          {report.shipments.map((s: any) => (
            <p key={s.code}>
              {s.code} · {s.name} · {s.weight_kg} kg
            </p>
          ))}
          {report.limitations.map((l: string) => (
            <p key={l}>{l}</p>
          ))}
          <button
            className="btn"
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob([JSON.stringify(report, null, 2)], {
                  type: "application/json",
                }),
              );
              const a = document.createElement("a");
              a.href = url;
              a.download = `reporte-${report.trip.code}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Descargar reporte
          </button>
          <button className="btn" onClick={() => setReport(null)}>
            Cerrar
          </button>
        </section>
      )}
    </>
  );
}
