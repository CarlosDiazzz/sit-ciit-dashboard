/* Cliente HTTP contra sit-ciit-backend.
 *
 * Los endpoints todavía no existen: mientras tanto estas llamadas fallan
 * con ApiError y las vistas muestran ese error tal cual. Eso es
 * deliberado — el proyecto prohíbe inventar datos de relleno cuando el
 * backend no responde (ver CLAUDE.md).
 */

import type {
  HistoryNode,
  NodeHistoryPage,
  CargoCategory,
  Command,
  CommandLogEntry,
  CreateNodeRequest,
  CreateUserRequest,
  EventRecord,
  EventVerdict,
  EventWindow,
  TrackDefectsResponse,
  IssueCommandRequest,
  LoginResponse,
  ManagedUser,
  NodeCredentialRecord,
  NodeSecretResponse,
  RiskRule,
  TelemetryPoint,
  Unit,
  UpdateUserRequest,
  WeatherLatestResponse,
  WeatherReading,
} from "./types";

const BASE_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:3000";

/** Distingue el tipo de fallo para poder explicarlo en pantalla:
 *  que el backend no esté levantado no es lo mismo que un 403. */
export type ApiErrorKind = "network" | "auth" | "http" | "parse";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }

  /** Mensaje para mostrar al usuario, en español y sin jerga. */
  get userMessage(): string {
    switch (this.kind) {
      case "network":
        return "No hay conexión con el servidor. Verifica que sit-ciit-backend esté corriendo.";
      case "auth":
        return "Tu sesión expiró o no tienes permiso para esta acción.";
      case "parse":
        return "El servidor respondió algo que no se pudo interpretar.";
      default:
        return this.message;
    }
  }
}

const TOKEN_KEY = "sitciit.token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    // Modo privado o almacenamiento bloqueado: se opera sin sesión
    // persistida en vez de romper la app.
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token === null) localStorage.removeItem(TOKEN_KEY);
    else localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Ignorado a propósito: ver getToken.
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        // Solo si hay body: Fastify rechaza con 400 ("body no puede
        // estar vacío") una petición sin body que de todos modos declara
        // Content-Type: application/json — pasaba en regenerate-secret,
        // ack de eventos y los DELETE, que no mandan body.
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
  } catch (cause) {
    // fetch solo rechaza por fallo de red, no por códigos 4xx/5xx.
    throw new ApiError("network", String(cause));
  }

  if (response.status === 401 || response.status === 403) {
    throw new ApiError("auth", "No autorizado", response.status);
  }

  if (!response.ok) {
    // El backend puede devolver { message } o texto plano; se intenta lo
    // primero y se cae a lo segundo.
    let detail = `Error ${response.status}`;
    try {
      const body: unknown = await response.json();
      if (
        body &&
        typeof body === "object" &&
        ("message" in body || "error" in body)
      ) {
        detail = String(
          (body as { message?: unknown; error?: unknown }).message ??
            (body as { error?: unknown }).error,
        );
      }
    } catch {
      // respuesta sin JSON: se queda el detalle genérico
    }
    throw new ApiError("http", detail, response.status);
  }

  if (response.status === 204) return undefined as T;

  try {
    return (await response.json()) as T;
  } catch (cause) {
    throw new ApiError("parse", String(cause));
  }
}

export interface ConnectivityEvent {
  id: string; kind: 'signal_lost' | 'signal_recovered'; ts: string;
  gpsLat: number | null; gpsLon: number | null; positionTs: string | null;
}
export const api = {
  nodeConnectivity: (nodeId: string, from: string, to: string) =>
    request<{items: ConnectivityEvent[]; hasMore: boolean}>(`/node-history/connectivity?${new URLSearchParams({nodeId,from,to,limit:'200'})}`),
  listHistoryNodes: () => request<HistoryNode[]>("/node-history/nodes"),
  nodeHistory: (params: {
    nodeId: string;
    from: string;
    to: string;
    limit: number;
    cursor?: string;
  }) => {
    const q = new URLSearchParams({
      nodeId: params.nodeId,
      from: params.from,
      to: params.to,
      limit: String(params.limit),
    });
    if (params.cursor) q.set("cursor", params.cursor);
    return request<NodeHistoryPage>(`/node-history?${q}`);
  },
  managementMyNotifications: () =>
    request<any[]>("/management/my-notifications"),
  managementApply: (id: string, node_id: string) =>
    request<any>(`/management/monitoring-profiles/${id}/apply`, {
      method: "POST",
      body: JSON.stringify({ node_id }),
    }),
  managementApplications: (id: string) =>
    request<any[]>(`/management/monitoring-profiles/${id}/applications`),
  managementResources: () => request<any[]>("/management/resources"),
  managementList: (
    resource: string,
    params: { page: number; limit?: number; search?: string; archived?: boolean },
  ) =>
    request<any>(
      `/management/${resource}?${new URLSearchParams({ page: String(params.page), limit: String(params.limit ?? 25), search: params.search ?? "", archived: String(params.archived ?? false) })}`,
    ),
  managementOptions: (resource: string) =>
    request<{ id: string; label: string }[]>(`/management/options/${resource}`),
  managementCreate: (resource: string, body: unknown) =>
    request<any>(`/management/${resource}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  managementUpdate: (resource: string, id: string, body: unknown) =>
    request<any>(`/management/${resource}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  managementArchive: (resource: string, id: string) =>
    request<void>(`/management/${resource}/${id}`, { method: "DELETE" }),
  managementNotes: (id: string) =>
    request<any[]>(`/management/incidents/${id}/notes`),
  managementAddNote: (id: string, body: unknown) =>
    request<any>(`/management/incidents/${id}/notes`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  managementReport: (id: string) =>
    request<any>(`/management/reports/trips/${id}`),
  managementAudit: (params: { page: number; limit?: number; search?: string }) =>
    request<any>(
      `/management/audit?${new URLSearchParams({ page: String(params.page), limit: String(params.limit ?? 25), search: params.search ?? "" })}`,
    ),
  managementDeliveries: () =>
    request<any[]>("/management/notification-deliveries"),
  health: () => request<{ status: string }>("/health"),

  login: (email: string, password: string) =>
    request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  listUnits: () => request<Unit[]>("/units"),

  getUnit: (unitId: string) => request<Unit>(`/units/${unitId}`),

  /** Historia real de telemetría de una unidad (hasta 500, más reciente
   *  primero) — para rellenar la vista Unidad al abrirla, no solo con lo
   *  que llegue por socket desde ese momento. `unitCode` es el mismo
   *  código que unitCode en /units, ej. "unit-01". */
  listTelemetry: (unitCode: string) =>
    request<TelemetryPoint[]>(
      `/telemetry?unitId=${encodeURIComponent(unitCode)}`,
    ),

  /** Defectos de via confirmados por repeticion entre unidades. */
  trackDefects: (days = 90) =>
    request<TrackDefectsResponse>(`/track-defects?days=${days}`),

  listEvents: (params?: { unitId?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.unitId) q.set("unitId", params.unitId);
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return request<EventRecord[]>(`/events${qs ? `?${qs}` : ""}`);
  },

  /** Señal alrededor de un evento: lo que permite distinguir un golpe
   *  de via de un frenon, que pueden tener el mismo pico. */
  eventWindow: (eventId: string, seconds = 4) =>
    request<EventWindow>(`/events/${eventId}/window?seconds=${seconds}`),

  /** Registra si la deteccion acerto. Cada veredicto es un ejemplo
   *  etiquetado para afinar umbrales mas adelante. */
  setEventVerdict: (eventId: string, verdict: EventVerdict, note?: string) =>
    request<{ verdict: EventVerdict; note: string | null }>(`/events/${eventId}/verdict`, {
      method: 'POST',
      body: JSON.stringify({ verdict, note }),
    }),

  acknowledgeEvent: (eventId: string) =>
    request<EventRecord>(`/events/${eventId}/ack`, { method: "POST" }),

  listCommands: (params?: { limit?: number }) => {
    const qs = params?.limit ? `?limit=${params.limit}` : "";
    return request<Command[]>(`/commands${qs}`);
  },

  issueCommand: (body: IssueCommandRequest) =>
    request<Command>("/commands", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /** Bitácora: historial completo de transiciones de comandos. */
  listCommandLog: (limit = 200) =>
    request<CommandLogEntry[]>(`/command-log?limit=${limit}`),

  /** Clima real en la última posición conocida de la unidad + reglas de
   *  riesgo activas para su categoría de carga. */
  getWeatherLatest: (unitId: string) =>
    request<WeatherLatestResponse>(`/units/${unitId}/weather/latest`),

  getWeatherHistory: (unitId: string, from: string, to: string) =>
    request<WeatherReading[]>(
      `/units/${unitId}/weather/history?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),

  setCargoCategory: (unitId: string, category: CargoCategory) =>
    request<{ cargoCategory: CargoCategory }>(
      `/units/${unitId}/cargo-category`,
      {
        method: "PATCH",
        body: JSON.stringify({ category }),
      },
    ),

  /** Tabla de referencia: todas las reglas de riesgo (activas o no), con
   *  su umbral declarado y su fuente — dato estático, no depende de una
   *  unidad en particular. */
  listRiskRules: () => request<RiskRule[]>("/risk-rules"),

  /** CRUD de usuarios — el backend exige rol control_center para las
   *  cuatro; aquí no se repite ese chequeo, solo se refleja en la UI. */
  listUsers: () => request<ManagedUser[]>("/users"),

  createUser: (body: CreateUserRequest) =>
    request<ManagedUser>("/users", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateUser: (id: string, body: UpdateUserRequest) =>
    request<ManagedUser>(`/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deleteUser: (id: string) =>
    request<void>(`/users/${id}`, { method: "DELETE" }),

  /** CRUD de nodos — el secreto solo viaja en la respuesta de create/
   *  regenerateNodeSecret, nunca en listNodes. */
  listNodes: () => request<NodeCredentialRecord[]>("/nodes"),

  createNode: (body: CreateNodeRequest) =>
    request<NodeCredentialRecord & NodeSecretResponse>("/nodes", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  reactivateNode: (id: string) =>
    request<NodeSecretResponse>(`/nodes/${id}/reactivate`, { method: "POST" }),
  regenerateNodeSecret: (id: string) =>
    request<NodeSecretResponse>(`/nodes/${id}/regenerate-secret`, {
      method: "POST",
    }),

  deleteNode: (id: string) =>
    request<void>(`/nodes/${id}`, { method: "DELETE" }),
};
