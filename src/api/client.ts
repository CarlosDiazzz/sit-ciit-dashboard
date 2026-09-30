/* Cliente HTTP contra sit-ciit-backend.
 *
 * Los endpoints todavía no existen: mientras tanto estas llamadas fallan
 * con ApiError y las vistas muestran ese error tal cual. Eso es
 * deliberado — el proyecto prohíbe inventar datos de relleno cuando el
 * backend no responde (ver CLAUDE.md).
 */

import type {
  CargoCategory,
  Command,
  CommandLogEntry,
  EventRecord,
  IssueCommandRequest,
  LoginResponse,
  RiskRule,
  TelemetryPoint,
  Unit,
  WeatherLatestResponse,
  WeatherReading,
} from './types';

const BASE_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3000';

/** Distingue el tipo de fallo para poder explicarlo en pantalla:
 *  que el backend no esté levantado no es lo mismo que un 403. */
export type ApiErrorKind = 'network' | 'auth' | 'http' | 'parse';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }

  /** Mensaje para mostrar al usuario, en español y sin jerga. */
  get userMessage(): string {
    switch (this.kind) {
      case 'network':
        return 'No hay conexión con el servidor. Verifica que sit-ciit-backend esté corriendo.';
      case 'auth':
        return 'Tu sesión expiró o no tienes permiso para esta acción.';
      case 'parse':
        return 'El servidor respondió algo que no se pudo interpretar.';
      default:
        return this.message;
    }
  }
}

const TOKEN_KEY = 'sitciit.token';

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
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
  } catch (cause) {
    // fetch solo rechaza por fallo de red, no por códigos 4xx/5xx.
    throw new ApiError('network', String(cause));
  }

  if (response.status === 401 || response.status === 403) {
    throw new ApiError('auth', 'No autorizado', response.status);
  }

  if (!response.ok) {
    // El backend puede devolver { message } o texto plano; se intenta lo
    // primero y se cae a lo segundo.
    let detail = `Error ${response.status}`;
    try {
      const body: unknown = await response.json();
      if (body && typeof body === 'object' && 'message' in body) {
        detail = String((body as { message: unknown }).message);
      }
    } catch {
      // respuesta sin JSON: se queda el detalle genérico
    }
    throw new ApiError('http', detail, response.status);
  }

  if (response.status === 204) return undefined as T;

  try {
    return (await response.json()) as T;
  } catch (cause) {
    throw new ApiError('parse', String(cause));
  }
}

export const api = {
  health: () => request<{ status: string }>('/health'),

  login: (email: string, password: string) =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  listUnits: () => request<Unit[]>('/units'),

  getUnit: (unitId: string) => request<Unit>(`/units/${unitId}`),

  /** Serie de telemetría de un nodo, para las gráficas de la vista Unidad. */
  listTelemetry: (nodeId: string, limit = 200) =>
    request<TelemetryPoint[]>(`/nodes/${nodeId}/telemetry?limit=${limit}`),

  listEvents: (params?: { unitId?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.unitId) q.set('unitId', params.unitId);
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return request<EventRecord[]>(`/events${qs ? `?${qs}` : ''}`);
  },

  acknowledgeEvent: (eventId: string) =>
    request<EventRecord>(`/events/${eventId}/ack`, { method: 'POST' }),

  listCommands: (params?: { limit?: number }) => {
    const qs = params?.limit ? `?limit=${params.limit}` : '';
    return request<Command[]>(`/commands${qs}`);
  },

  issueCommand: (body: IssueCommandRequest) =>
    request<Command>('/commands', {
      method: 'POST',
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
    request<{ cargoCategory: CargoCategory }>(`/units/${unitId}/cargo-category`, {
      method: 'PATCH',
      body: JSON.stringify({ category }),
    }),

  /** Tabla de referencia: todas las reglas de riesgo (activas o no), con
   *  su umbral declarado y su fuente — dato estático, no depende de una
   *  unidad en particular. */
  listRiskRules: () => request<RiskRule[]>('/risk-rules'),
};
