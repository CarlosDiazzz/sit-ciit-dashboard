import { t as translate, locale } from '../accessibility/i18n';
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import { ArrowRight, Archive, ClipboardList, Download, Eye, FileText, LayoutGrid, Pencil, Plus, RefreshCw, Search, ShieldCheck, UserRound, X } from 'lucide-react';
import { api, ApiError } from "../api/client";
import { useApi, type AsyncState } from "../api/useApi";
import { useSession } from "../auth/context";
import Dialog from '../components/Dialog';
import PageBreadcrumbs from '../components/PageBreadcrumbs';
import { Pagination } from '../components/Pagination';
import { managementGroups, managementUi, normalizeSearch, type ManagementResource } from '../lib/managementUi';
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
  generated?: boolean;
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
  const { resources: definitions } = useOutletContext<{ resources: AsyncState<ManagementResource[]> }>();
  const selected = definitions.data?.find((r) => r.key === resource);
  const { user } = useSession();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Math.floor(Number(params.get('page')) || 1));
  const limit = [10, 25, 50, 100].includes(Number(params.get('limit'))) ? Number(params.get('limit')) : 10;
  const filter = params.get('q') ?? '';
  const archived = params.get('archived') === 'true';
  const [search, setSearch] = useState(filter);
  const [moduleSearch, setModuleSearch] = useState('');
  const detailRequest = useRef(0);
  const [detailLoading, setDetailLoading] = useState(false);
  const updateQuery = useCallback((values: Record<string, string | number | boolean>) => {
    setParams(previous => { const next = new URLSearchParams(previous); for (const [key, value] of Object.entries(values)) { if (value === '' || value === false) next.delete(key); else next.set(key, String(value)); } return next; }, { replace: true });
  }, [setParams]);
  // Keep the editable search draft in sync when the URL filter changes via browser history.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { setSearch(current => current === filter ? current : filter); }, [filter]);
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
      selected
        ? api.managementList(resource, { page, limit, search: filter, archived })
        : { items: [], total: 0, page: 1, limit: 25 },
    [selected?.key, page, limit, filter, archived],
  );
  useEffect(() => {
    if (!data.loading && !data.error && data.data && page > Math.max(1, Math.ceil(data.data.total / limit))) updateQuery({ page: Math.max(1, Math.ceil(data.data.total / limit)) });
  }, [data.data, data.loading, data.error, page, limit, updateQuery]);
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
        !f.generated && (!f.roles || f.roles.includes(String(form.role ?? editing?.role ?? ""))),
    ) ?? [];
  const editable = selected?.canWrite === true;
  function start(row: RecordData | null) {
    setError("");
    setNotice("");
    setEditing(row);
    const next = { ...defaults(selected!), ...(row ?? {}) };
    delete next.password;
    for (const f of selected!.fields) if (f.type === 'date' && next[f.key]) next[f.key] = String(next[f.key]).slice(0, 10);
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
      setDetail(null);
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
      !confirm(translate("¿Archivar este registro? Su historial se conservará."))
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
    const request = ++detailRequest.current;
    setDetail(row);
    setNotes([]);
    setApplications([]);
    setApplyNode('');
    setNote('');
    setEvidence('');
    setReport(null);
    setError("");
    setDetailLoading(true);
    try {
      if (resource === 'incidents') { const result = await api.managementNotes(row.id); if (request === detailRequest.current) setNotes(result); }
      if (resource === 'monitoring-profiles') { const result = await api.managementApplications(row.id); if (request === detailRequest.current) setApplications(result); }
    } catch (e) { if (request === detailRequest.current) setError(message(e)); }
    finally { if (request === detailRequest.current) setDetailLoading(false); }
  }
  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!detail || busy) return;
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
        ? new Date(String(v)).toLocaleString(locale())
        : display(v));
  if (definitions.loading) return <div className="workspace-empty" role="status"><RefreshCw size={28} /><strong>{translate("Cargando módulos…")}</strong></div>;
  if (definitions.error)
    return (
      <div role="alert">
        {translate(definitions.error.userMessage)}
        <button className="btn" onClick={definitions.reload}>{translate("Reintentar")}</button>
      </div>
    );
  if (!resource)
    return (
      <>
        <div className="page-head management-hero">
          <div>
            <span className="management-eyebrow">{translate("CENTRO DE OPERACIONES")}</span>
            <h1>{translate("Gestión logística")}</h1>
            <p>{translate("Administra los recursos y sigue la carga desde la preparación hasta la entrega.")}</p>
          </div>
          <PageBreadcrumbs current="Gestión logística" />
          <div className="management-hero-mark" aria-hidden="true"><LayoutGrid size={48} /></div>
        </div>
        <div className="management-overview"><span><strong>{definitions.data?.length ?? 0}</strong>{translate(" módulos disponibles")}</span><span><ShieldCheck size={16} />{translate(" Acceso según tu rol")}</span><span>{translate("Buscar cualquier pestaña ")}<kbd>{translate("Ctrl K")}</kbd></span></div>
        <label className="module-search"><Search size={18} /><input aria-label={translate("Filtrar módulos")} placeholder={translate("Encuentra un módulo de logística…")} value={moduleSearch} onChange={e => setModuleSearch(e.target.value)} /></label>
        {managementGroups.map(group => {
          const matches = definitions.data?.filter(r => managementUi(r.key).group === group && normalizeSearch(`${r.label} ${managementUi(r.key).description} ${translate(r.label)} ${translate(managementUi(r.key).description)}`).includes(normalizeSearch(moduleSearch))) ?? [];
          if (!matches.length) return null;
          return <section className="management-group" key={group}><h2>{translate(group)}<span>{matches.length}</span></h2><div className="management-cards">
          {matches.map((r) => { const meta = managementUi(r.key); return (
            <Link
              className="management-card"
              key={r.key}
              to={`/gestion/${r.key}`}
            >
              <div className="management-card-top"><span className="module-icon"><meta.icon size={23} /></span><ArrowRight size={18} /></div>
              <strong>{translate(r.label)}</strong>
              <p>{translate(meta.description)}</p>
              <span>
                {translate(r.canWrite ? "Administrar registros" : "Consultar registros")}
              </span>
            </Link>
          ); })}
        </div></section>; })}
        {!definitions.data?.some(r => normalizeSearch(`${r.label} ${managementUi(r.key).description} ${translate(r.label)} ${translate(managementUi(r.key).description)}`).includes(normalizeSearch(moduleSearch))) && <div className="workspace-empty"><Search size={28} /><strong>{translate("No hay módulos con ese nombre")}</strong><button className="btn" onClick={() => setModuleSearch('')}>{translate("Ver todos los módulos")}</button></div>}
          {["admin", "control_center", "auditor"].includes(
            user?.role ?? "",
          ) && (
            <Link className="management-audit-link" to="/auditoria"><ClipboardList size={20} />
              <strong>{translate("Auditoría administrativa")}</strong>
              <span>{translate("Cambios y responsables")}</span>
            </Link>
          )}
      </>
    );
  if (!selected)
    return <p role="alert">{translate("Este módulo no está disponible para tu cuenta.")}</p>;
  const meta = managementUi(resource);
  const preferred: Record<string, string[]> = {
    users: ['email', 'role', 'company_id', 'phone'],
    shipments: ['code', 'name', 'company_id', 'origin_id', 'destination_id', 'weight_kg', 'status'],
    trips: ['code', 'name', 'route_id', 'unit_id', 'planned_departure', 'status'],
    incidents: ['code', 'name', 'unit_id', 'assigned_to', 'severity', 'status'],
    maintenance: ['code', 'name', 'node_id', 'technician_id', 'scheduled_at', 'status'],
    units: ['unit_code', 'label', 'company_id', 'capacity_kg', 'status'],
    containers: ['code', 'name', 'container_type', 'capacity_kg', 'status'],
  };
  const columns = preferred[resource] ? preferred[resource].flatMap(key => selected.fields.filter(f => f.key === key)) : selected.fields.filter(f => f.type !== 'password' && !f.roles).slice(0, 6);
  return (
    <>
      <nav className="management-tabs" aria-label={translate("Pestañas de logística")}><NavLink to="/gestion" end><LayoutGrid size={15} />{translate(" Todos los módulos")}</NavLink>{definitions.data?.map(r => { const Icon = managementUi(r.key).icon; return <NavLink key={r.key} to={`/gestion/${r.key}`}><Icon size={15} />{translate(r.label)}</NavLink>; })}</nav>
      <div className="page-head">
        <div className="management-title"><span className="module-icon"><meta.icon size={25} /></span><div>
          <h1>{translate(selected.label)}</h1>
          <p>{translate(meta.description)}</p>
        </div></div>
        <PageBreadcrumbs current={selected.label} />
        {selected.canCreate && (
          <button className="btn btn-primary" onClick={() => start(null)}>
            <Plus size={17} />{translate(" Nuevo registro")}</button>
        )}
      </div>
      {resource === "nodes" && editable && (
        <p>
          <Link to="/nodos">{translate("Registrar dispositivo y generar secreto →")}</Link>
        </p>
      )}
      {resource === "monitoring-profiles" && (
        <p className="management-hint">{translate("Estos perfiles guardan la configuración deseada. Su aplicación al nodo se confirma mediante comandos y ACK; los límites ambientales internos requieren sensores compatibles.")}</p>
      )}
      {resource === "notification-rules" && (
        <p className="management-hint">{translate("Los avisos de dashboard quedan disponibles en el sistema. Correo, Telegram y SMS requieren integrar sus adaptadores de envío.")}</p>
      )}
      {translate(error && (
        <p className="user-error" role="alert">
          {translate(error)}
        </p>
      ))}
      {translate(notice && (
        <p className="user-aviso" role="status">
          {translate(notice)}
        </p>
      ))}
      {editing !== undefined && (
        <Dialog wide title={translate(`${editing ? 'Editar' : 'Nuevo registro'} · ${selected.label}`)} onClose={() => { if (!busy) setEditing(undefined); }}>
        {translate(error && <p className="user-error" role="alert">{translate(error)}</p>)}
        <form className="user-form" onSubmit={save}>
          <p className="management-form-hint">{translate("Los campos con * son obligatorios.")}{translate(editing && resource === 'users' ? ' Deja la contraseña vacía para conservar la actual.' : '')}</p>
          {references.loading ? (
            <p>{translate("Cargando catálogos…")}</p>
          ) : references.error ? (
            <p role="alert">
              {translate(references.error.userMessage)}
              <button type="button" className="btn" onClick={references.reload}>{translate("Reintentar")}</button>
            </p>
          ) : (
            <div className="management-fields">
              {resource === 'shipments' && <p className="field management-wide-field">{editing ? `Guía: ${editing.code}` : 'El sistema asignará una guía SITCIIT al guardar el envío.'}</p>}
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
                  <label className={`field${f.type === 'boolean' ? ' management-toggle' : ''}${f.type === 'textarea' ? ' management-wide-field' : ''}`} key={f.key}>
                    <span>
                      {translate(f.label)}
                      {translate(f.required ? " *" : "")}
                    </span>
                    {f.type === "boolean" ? (
                      <input
                        aria-label={translate(f.label)}
                        type="checkbox"
                        checked={Boolean(value)}
                        onChange={(e) =>
                          setForm({ ...form, [f.key]: e.target.checked })
                        }
                      />
                    ) : f.type === "textarea" ? (
                      <textarea
                        aria-label={translate(f.label)}
                        value={String(value)}
                        required={f.required}
                        onChange={(e) =>
                          setForm({ ...form, [f.key]: e.target.value })
                        }
                      />
                    ) : ["select", "reference"].includes(f.type) ? (
                      <select
                        aria-label={translate(f.label)}
                        value={String(value)}
                        required={f.required}
                        onChange={(e) =>
                          setForm({ ...form, [f.key]: e.target.value })
                        }
                      >
                        <option value="">{translate("Seleccionar…")}</option>
                        {f.type === "reference"
                          ? (references.data?.[f.resource!] ?? []).map((o) => (
                              <option key={o.id} value={o.id}>
                                {translate(o.label)}
                              </option>
                            ))
                          : f.options?.map((o) => (
                              <option key={o.value} value={o.value}>
                                {translate(o.label)}
                              </option>
                            ))}
                      </select>
                    ) : (
                      <input
                        aria-label={translate(f.label)}
                        type={f.type === "datetime" ? "datetime-local" : f.type}
                        value={String(value)}
                        required={f.required || (f.type === "password" && !editing)}
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
              {translate(busy ? "Guardando…" : "Guardar")}
            </button>
            <button
              className="btn"
              type="button"
              disabled={busy}
              onClick={() => setEditing(undefined)}
            >{translate("Cancelar")}</button>
          </div>
        </form>
        </Dialog>
      )}
      <section className="data-table-panel">
      <form
        className="management-toolbar management-table-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          updateQuery({ page: 1, q: search.trim() });
        }}
      >
        <div className="management-search"><Search size={17} /><input
          aria-label={translate("Buscar registros")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={translate(resource === 'users' ? 'Buscar por nombre o correo…' : 'Buscar por código o nombre…')}
        /></div>
        <button className="btn">{translate("Buscar")}</button>
        {translate(filter && <button className="btn" type="button" onClick={() => { setSearch(''); updateQuery({ q: '', page: 1 }); }}><X size={14} />{translate(" Limpiar")}</button>)}
        <label>
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => {
              updateQuery({ archived: e.target.checked, page: 1 });
            }}
          />{" "}{translate("Incluir archivados")}</label>
        <button className="btn" type="button" disabled={data.loading} onClick={data.reload}>
          <RefreshCw size={15} />{translate(" Actualizar")}</button>
      </form>
      {data.loading ? (
        <div className="workspace-empty" role="status"><RefreshCw size={28} /><strong>{translate("Cargando registros…")}</strong></div>
      ) : data.error ? (
        <div className="workspace-empty" role="alert">
          {translate(data.error.userMessage)}
          <button className="btn" onClick={data.reload}>{translate("Reintentar")}</button>
        </div>
      ) : !data.data?.items.length ? (
        <div className="workspace-empty"><meta.icon size={34} /><strong>{translate("No hay registros para estos filtros.")}</strong><p>{translate(filter ? 'Cambia la búsqueda para encontrar otros registros.' : `Los registros de ${selected.label.toLowerCase()} aparecerán aquí.`)}</p>{filter ? <button className="btn" onClick={() => updateQuery({ q: '', page: 1 })}>{translate("Limpiar búsqueda")}</button> : selected.canCreate && <button className="btn btn-primary" onClick={() => start(null)}><Plus size={16} />{translate(" Crear primer registro")}</button>}</div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {columns.map((f) => (
                  <th scope="col" key={f.key}>{translate(resource === 'users' && f.key === 'email' ? 'Persona' : f.label)}</th>
                ))}
                <th>{translate("Vigencia")}</th>
                <th>{translate("Acciones")}</th>
              </tr>
            </thead>
            <tbody>
              {data.data.items.map((row) => (
                <tr key={row.id}>
                  {columns.map((f) => (
                    <td key={f.key}>
                      {translate(resource === 'users' && f.key === 'email' ? <div className="person-cell"><span className="person-avatar" aria-hidden="true"><UserRound size={19} /></span><span><strong>{translate([row.first_name, row.last_name].filter(Boolean).join(' ') || row.email)}{row.id === user?.id && <span className="tag">{translate("Tú")}</span>}</strong><small>{translate(row.email)}</small></span></div> : ['status', 'severity', 'role'].includes(f.key) ? <span className="record-status" data-status={row[f.key]}>{translate(valueLabel(f, row[f.key]))}</span> : row._labels?.[f.key] ?? valueLabel(f, row[f.key]))}
                    </td>
                  ))}
                  <td><span className="record-status" data-status={row.active ? 'active' : 'archived'}>{translate(row.active ? "Activo" : "Archivado")}</span></td>
                  <td>
                    {resource === "nodes" && (
                      <>
                        <strong>{translate(row.node_code)}</strong>{" "}
                        <Link
                          className="btn"
                          to={`/historial-nodos?nodo=${row.id}`}
                        >{translate("Historial")}</Link>
                      </>
                    )}
                    <div className="management-actions">
                      <button className="btn" onClick={() => void inspect(row)}>
                        <Eye size={14} />{translate(" Detalle")}</button>
                      {resource === "trips" && (
                        <button
                          className="btn"
                          disabled={busy}
                          onClick={() => void loadReport(row)}
                        >
                          <FileText size={14} />{translate(" Reporte")}</button>
                      )}
                      {editable && row.active && (
                        <>
                          <button
                            className="btn"
                            disabled={busy}
                            onClick={() => start(row)}
                          >
                            <Pencil size={14} />{translate(" Editar")}</button>
                          <button
                            className="btn"
                            disabled={busy || row.id === user?.id}
                            onClick={() => void archive(row)}
                          >
                            <Archive size={14} />{translate(" Archivar")}</button>
                        </>
                      )}
                      {editable && !row.active && resource !== "nodes" && (
                        <button
                          className="btn"
                          disabled={busy}
                          onClick={() => void reactivate(row)}
                        >{translate("Reactivar")}</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pageSize={limit} total={data.data?.total ?? 0} disabled={data.loading || !!data.error} onPage={n => updateQuery({ page: n })} onPageSize={n => updateQuery({ page: 1, limit: n })} />
      </section>
      {detail && (
        <Dialog wide title={translate(`Detalle · ${selected.label}`)} onClose={() => { if (!busy) { detailRequest.current++; setDetail(null); } }}>
        {translate(error && <p className="user-error" role="alert">{translate(error)}</p>)}
        <section className="user-form">
          <div className="management-toolbar">
            <h2>{translate("Detalle del registro")}</h2>
            <span className="record-status" data-status={detail.active ? 'active' : 'archived'}>{translate(detail.active ? 'Activo' : 'Archivado')}</span>
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
                  <dt>{translate(f.label)}</dt>
                  <dd>
                    {translate(detail._labels?.[f.key] ?? valueLabel(f, detail[f.key]))}
                  </dd>
                </div>
              ))}
            <div>
              <dt>{translate("Creado")}</dt>
              <dd>
                {translate(new Date(String(detail.created_at)).toLocaleString(locale()))}
              </dd>
            </div>
            {translate(detail.version && (
              <div>
                <dt>{translate("Versión")}</dt>
                <dd>{translate(detail.version)}</dd>
              </div>
            ))}
          </dl>
          {detailLoading && <p role="status">{translate("Cargando historial…")}</p>}
          {resource === "monitoring-profiles" && (
            <>
              <h3>{translate("Aplicaciones al dispositivo")}</h3>
              {["admin", "control_center"].includes(user?.role ?? "") &&
                detail.active && (
                  <form className="management-toolbar" onSubmit={apply}>
                    <select
                      aria-label={translate("Dispositivo para aplicar perfil")}
                      required
                      value={applyNode}
                      onChange={(e) => setApplyNode(e.target.value)}
                    >
                      <option value="">{translate("Selecciona un dispositivo")}</option>
                      {deviceOptions.data?.map((n) => (
                        <option key={n.id} value={n.id}>
                          {translate(n.label)}
                        </option>
                      ))}
                    </select>
                    <button className="btn" disabled={busy}>{translate("Aplicar muestreo y umbral de impacto")}</button>
                  </form>
                )}
              {applications.length ? (
                applications.map((a) => (
                  <article key={a.id} className="management-note">
                    <strong>
                      {translate(a.node_code)}{translate(" · versión ")}{translate(a.profile_version)}
                    </strong>
                    {translate(a.commands.map((c: any) => (
                      <p key={c.cmd_id}>
                        {translate(c.action)} · {translate(c.status)}
                        {translate(c.reason ? " · " + c.reason : "")}
                      </p>
                    )))}
                  </article>
                ))
              ) : (
                <p>{translate("Sin aplicaciones registradas.")}</p>
              )}
              <button className="btn" onClick={() => void inspect(detail)}>{translate("Actualizar confirmaciones")}</button>
            </>
          )}
          {resource === "incidents" && (
            <>
              <h3>{translate("Comentarios y evidencias")}</h3>
              {notes.length ? (
                notes.map((n) => (
                  <article className="management-note" key={n.id}>
                    <strong>
                      {translate(n.author)} ·{" "}
                      {translate(new Date(n.created_at).toLocaleString(locale()))}
                    </strong>
                    <p>{translate(n.body)}</p>
                    {translate(n.evidence_url && (
                      <a href={n.evidence_url} target="_blank" rel="noreferrer">{translate("Abrir evidencia")}</a>
                    ))}
                  </article>
                ))
              ) : (
                <p>{translate("Sin comentarios.")}</p>
              )}
              {editable &&
                !["resolved", "dismissed"].includes(String(detail.status)) && (
                  <form onSubmit={addNote} className="management-fields">
                    <label className="field">{translate("Comentario")}<textarea
                        required
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                      />
                    </label>
                    <label className="field">{translate("Enlace a evidencia")}<input
                        type="url"
                        value={evidence}
                        onChange={(e) => setEvidence(e.target.value)}
                      />
                    </label>
                    <button className="btn" disabled={busy}>{translate("Agregar comentario")}</button>
                  </form>
                )}
            </>
          )}
        </section>
        </Dialog>
      )}
      {translate(report && (
        <Dialog wide title={translate(`Reporte de viaje · ${report.trip.name}`)} onClose={() => setReport(null)}>
        <section className="user-form">
          <h2>{translate("Reporte: ")}{translate(report.trip.name)}</h2>
          <dl className="management-detail">
            <div>
              <dt>{translate("Lecturas reales")}</dt>
              <dd>{translate(report.telemetry.samples)}</dd>
            </div>
            <div>
              <dt>{translate("Lecturas recibidas con más de 30 s de demora")}</dt>
              <dd>{translate(report.telemetry.delayed_samples)}</dd>
            </div>
            <div>
              <dt>{translate("Velocidad promedio")}</dt>
              <dd>
                {translate(report.telemetry.average_speed_kmh == null
                  ? "Sin datos"
                  : `${Number(report.telemetry.average_speed_kmh).toFixed(1)} km/h`)}
              </dd>
            </div>
            <div>
              <dt>{translate("Velocidad máxima")}</dt>
              <dd>
                {translate(report.telemetry.max_speed_kmh == null
                  ? "Sin datos"
                  : `${Number(report.telemetry.max_speed_kmh).toFixed(1)} km/h`)}
              </dd>
            </div>
          </dl>
          <h3>{translate("Envíos")}</h3>
          {translate(report.shipments.map((s: any) => (
            <p key={s.code}>
              {translate(s.code)} · {translate(s.name)} · {translate(s.weight_kg)}{translate(" kg")}</p>
          )))}
          {translate(report.limitations.map((l: string) => (
            <p key={l}>{translate(l)}</p>
          )))}
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
            <Download size={15} />{translate(" Descargar reporte")}</button>
          <button className="btn" onClick={() => setReport(null)}>{translate("Cerrar")}</button>
        </section>
        </Dialog>
      ))}
    </>
  );
}
