/* Formas de los datos que devuelve sit-ciit-backend.
 *
 * Se derivan del contrato (src/contract/contract.ts) en vez de redefinir
 * tipos ad hoc: los nombres de eventos, severidades, acciones y estados
 * son los mismos que hablan el nodo y el backend.
 *
 * Lo que el contrato NO cubre es lo que agrega el backend al persistir:
 * ids propios, `receivedAt` (reloj del servidor) y los eventos que genera
 * él mismo. Eso se define aquí.
 *
 * Los endpoints todavía no existen; cuando el backend los publique hay
 * que verificar que estas formas coincidan y ajustar aquí, en un solo
 * lugar, en vez de en cada vista.
 */

import type {
  AckStatus,
  CmdAction,
  EventKind,
  EventSeverity,
  IssuerRole,
  NodeMode,
  NodeRole,
} from '../contract/contract';

/** Eventos que genera el backend, no el dispositivo: no viajan por MQTT
 *  y por eso no están en EventKind, pero se guardan en la misma tabla. */
export type BackendEventKind = 'source_failover' | 'sensor_disagreement' | 'weather_risk' | 'signal_lost';

/** Categoría de carga que declara el cliente por unidad — no es un dato
 *  de sensor, se fija desde este dashboard (rol control_center).
 *  'sin_carga' es un estado explícito ("va vacía"), distinto de null
 *  (todavía no se declaró nada). */
export type CargoCategory = 'agricola' | 'construccion' | 'quimico' | 'sin_carga';

/** Rol de autorización del backend/dashboard — distinto de `IssuerRole`
 *  del contrato MQTT (2 valores, quién puede emitir comandos a un nodo).
 *  `cliente` nunca emite comandos, así que no pertenece a ese tipo; se
 *  define aparte aquí, igual que en el backend
 *  (`src/domain/ports/UserRepository.ts`). */
export type UserRole = 'admin' | 'control_center' | 'operator' | 'cliente' | 'technician' | 'auditor';

/** Todo lo que puede aparecer en la vista de Eventos. */
export type AnyEventKind = EventKind | BackendEventKind;

/** Estados por los que pasa un comando. `sent` lo escribe el backend al
 *  publicar; el resto llega por ack del nodo. */
export type CommandStatus = 'sent' | AckStatus;

export interface Unit {
  id: string;
  unitCode: string;
  label: string | null;
  /** Nodo que la unidad está usando ahora mismo; null si ninguno está
   *  online (ver regla de failover en el backend). */
  activeNodeId: string | null;
  /** null si el cliente todavía no la declaró. */
  cargoCategory: CargoCategory | null;
  nodes: Node[];
}

export interface Node {
  id: string;
  nodeCode: string;
  unitId: string;
  role: NodeRole;
  isOnline: boolean;
  /** ISO 8601. null si nunca ha reportado. */
  lastHeartbeatAt: string | null;
  batteryPct: number | null;
  /** Mensajes sin enviar en la cola local del celular. */
  pendingOutbox: number | null;
  samplingMs: number | null;
  mode: NodeMode | null;
  capabilities: string[];
}

export interface TelemetryPoint {
  id: string;
  /** Código del nodo, ej. "unit-01-a" — igual que en el socket, no UUID. */
  nodeCode: string;
  role: NodeRole;
  seq: number;
  /** Reloj del dispositivo: cuándo ocurrió. */
  ts: string;
  /** Reloj del servidor: cuándo llegó. La diferencia con `ts` delata los
   *  mensajes que estuvieron esperando en el outbox. */
  receivedAt: string;
  accelX: number | null;
  accelY: number | null;
  accelZ: number | null;
  gyroX: number | null;
  gyroY: number | null;
  gyroZ: number | null;
  magX?: number | null;
  magY?: number | null;
  magZ?: number | null;
  lux: number | null;
  pressureHpa: number | null;
  gpsLat: number | null;
  gpsLon: number | null;
  gpsSpeedMs: number | null;
  gpsAccuracyM: number | null;
}

export type EventVerdict = 'confirmed' | 'false_alarm' | 'unclear';

export interface EventRecord {
  id: string;
  unitId: string;
  /** Codigo del contrato ("unit-01"). El unitId de arriba es el UUID de
   *  la base, que sirve para agrupar pero no se muestra: un operador no
   *  reconoce 63898a12-ff5e-42ca-8a50-4758d4e4b96a. */
  unitCode?: string | null;
  nodeCode?: string | null;
  /** null en eventos a nivel unidad (failover, disagreement): comparan
   *  primary contra backup, no pertenecen a un solo nodo. */
  nodeId: string | null;
  kind: AnyEventKind;
  severity: EventSeverity;
  value: number | null;
  threshold: number | null;
  gpsLat: number | null;
  gpsLon: number | null;
  ts: string;
  receivedAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  /** Si la deteccion acerto, segun el operador. null mientras nadie lo
   *  haya juzgado: no se infiere una etiqueta que no se dio. */
  verdict?: EventVerdict | null;
  verdictNote?: string | null;
  /** Detalle estructurado — hoy solo lo llena weather_risk (temperatura,
   *  humedad, lluvia y qué reglas dispararon, con su fuente citada). */
  details: Record<string, unknown> | null;
}

export interface Command {
  id: string;
  cmdId: string;
  /** Código del nodo destino en el contrato, ej. "unit-01-a". */
  targetNodeCode: string;
  /** Correo de quien lo emitió. */
  issuedByEmail: string;
  /** Rol con el que se emitió, no el rol actual del usuario. */
  issuedByRole: IssuerRole;
  action: CmdAction;
  params: Record<string, unknown>;
  status: CommandStatus;
  /** Motivo del rechazo, cuando status es 'rejected'. */
  reason: string | null;
  issuedAt: string;
  sentAt: string;
  deliveredAt: string | null;
  executedAt: string | null;
  rejectedAt: string | null;
}

export interface CommandLogEntry {
  id: string;
  commandId: string;
  cmdId: string;
  action: CmdAction;
  targetNodeCode: string;
  issuedByEmail: string;
  status: CommandStatus;
  reason: string | null;
  occurredAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

/** Fila del CRUD de usuarios — misma forma que AuthUser más createdAt,
 *  nunca incluye el hash de la contraseña. */
export interface ManagedUser {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  role: UserRole;
}

/** Ambos campos opcionales: mandar solo lo que se quiere cambiar. */
export interface UpdateUserRequest {
  role?: UserRole;
  password?: string;
}

/** Clima ambiental real (Open-Meteo) en la última posición GPS conocida de
 *  la unidad — NO la temperatura/humedad dentro del contenedor (el
 *  celular no puede medir eso). Ver sit-ciit-backend/src/domain/riskThresholds.ts. */
export interface WeatherReading {
  ts: string;
  lat: number;
  lon: number;
  tempC: number;
  humidityPct: number;
  precipMm: number;
}

export type WeatherVariable = 'tempC' | 'humidityPct' | 'precipMm';

/** Condición declarativa (no una función): el mismo umbral que evalúa el
 *  backend se puede mostrar tal cual — "bajo qué valor y qué norma". */
export interface Condition {
  variable: WeatherVariable;
  op: '>=' | '<=' | '>' | '<';
  value: number;
}

export interface RiskRule {
  id: string;
  category: CargoCategory;
  severity: EventSeverity;
  message: string;
  /** Cita exacta de la norma/guía real que respalda el umbral. */
  source: string;
  /** true = no hay cifra oficial confirmada, es criterio del equipo —
   *  mostrar como tal, no ocultarlo. */
  isAssumption: boolean;
  /** Se cumplen todas (AND) para que la regla se considere activa. */
  conditions: Condition[];
}

export interface WeatherLatestResponse {
  cargoCategory: CargoCategory | null;
  weather: WeatherReading;
  activeRules: RiskRule[];
}

/** Cuerpo de POST /commands. El backend valida la autoridad del rol antes
 *  de publicar en MQTT (primera línea de defensa) y el nodo revalida. */
export interface IssueCommandRequest {
  targetNodeId: string;
  action: CmdAction;
  params?: Record<string, unknown>;
}

/* --- Eventos de Socket.IO (nombre -> payload) ---------------------------
 *
 * Ojo: lo que llega por el socket NO tiene la forma de las filas de la
 * BD. El backend reemite el mensaje MQTT que acaba de guardar, así que
 * conserva la forma del contrato: `nodeId`/`unitId` son los códigos del
 * dispositivo ("unit-01-a"), no UUIDs, los tiempos son epoch en
 * milisegundos, y los vectores vienen anidados.
 *
 * La fuente de verdad de esta forma es
 * sit-ciit-backend/src/domain/ports/TelemetryBroadcaster.ts.
 */

export interface TelemetryBroadcast {
  /** Código del nodo en el contrato, ej. "unit-01-a". */
  nodeId: string;
  /** Código de la unidad en el contrato, ej. "unit-01". */
  unitId: string;
  role: NodeRole;
  seq: number;
  /** epoch ms, reloj del dispositivo. */
  ts: number;
  /** epoch ms, reloj del servidor. */
  receivedAt: number;
  accel?: { x: number; y: number; z: number };
  gyro?: { x: number; y: number; z: number };
  mag?: { x: number; y: number; z: number };
  lux?: number;
  pressureHpa?: number;
  gps?: { lat: number; lon: number; speedMs?: number; accuracyM?: number };
}

/** Reemisión de un evento recién guardado (impacto/puerta/volcadura del
 *  dispositivo, o weather_risk/failover generados por el backend). Misma
 *  salvedad que TelemetryBroadcast: unitId/nodeId son códigos, no UUIDs,
 *  y ts es epoch ms — no la forma de fila de /events. nodeId es null en
 *  eventos de unidad (weather_risk, source_failover: comparan primary
 *  contra backup, o evalúan clima, y no pertenecen a un solo nodo). */
export interface EventBroadcast {
  unitId: string;
  nodeId: string | null;
  kind: AnyEventKind;
  severity: EventSeverity;
  value?: number;
  threshold?: number;
  gps?: { lat: number; lon: number };
  /** epoch ms, reloj del dispositivo. */
  ts: number;
}

/** Avance de un comando, emitido al aplicar un ack del nodo. */
export interface CommandUpdate {
  cmdId: string;
  nodeId: string;
  status: Exclude<CommandStatus, 'sent'>;
  reason: string | null;
  /** epoch ms */
  occurredAt: number;
}

export interface ServerToClientEvents {
  telemetry: (payload: TelemetryBroadcast) => void;
  event: (payload: EventBroadcast) => void;
  'command:update': (payload: CommandUpdate) => void;
  /** La unidad cambio de fuente activa (failover o recuperacion). Los
   *  ids son codigos del contrato, no UUIDs de la base. */
  'unit:active-node': (payload: {
    unitId: string;
    activeNodeId: string | null;
    reason: 'failover' | 'recovered' | 'no_nodes_online';
  }) => void;
}

/** Fila del CRUD de nodos. El secreto NUNCA aparece aquí — solo en la
 *  respuesta de creación/regeneración, una sola vez. */
export interface NodeCredentialRecord {
  id: string;
  nodeCode: string;
  unitCode: string;
  role: NodeRole;
  hasSecret: boolean;
  active: boolean;
  isOnline: boolean;
  createdAt: string;
}

export interface CreateNodeRequest {
  nodeCode: string;
  unitCode: string;
  role: NodeRole;
}

/** El secreto en texto plano, mostrado una sola vez — igual que un API
 *  key, no se puede volver a consultar después de esto. */
export interface NodeSecretResponse {
  secret: string;
}

/** Lecturas alrededor de un evento, para ver la forma de la señal y no
 *  solo su pico. Las da GET /events/:id/window. */
export interface EventWindowSample {
  ts: string;
  nodeCode: string;
  /** Milisegundos respecto al instante del evento: negativo antes. */
  offsetMs: number;
  accel: { x: number; y: number; z: number } | null;
  gyro: { x: number; y: number; z: number } | null;
  speedKmh: number | null;
}

export interface EventWindow {
  event: { id: string; kind: string; ts: string; value: number | null; threshold: number | null };
  windowSeconds: number;
  samples: EventWindowSample[];
}

/** Nivel de confianza de un defecto agrupado. Lo decide la
 *  independencia de las observaciones, no el numero de detecciones:
 *  tres unidades distintas confirman, una sola no. */
export type DefectConfidence = 'confirmado' | 'probable' | 'indicio';

export interface TrackDefect {
  lat: number;
  lon: number;
  /** Radio que cubre las detecciones agrupadas, en metros. Refleja la
   *  incertidumbre del GPS, no el tamaño del defecto. */
  radiusM: number;
  kind: AnyEventKind;
  confidence: DefectConfidence;
  /** Por que se le asigno ese nivel, en una frase. */
  reason: string;
  distinctUnits: number;
  distinctNodes: number;
  passes: number;
  detections: number;
  averageValue: number | null;
  firstSeen: string;
  lastSeen: string;
  eventIds: string[];
}

export interface TrackDefectsResponse {
  windowDays: number;
  analyzed: number;
  defects: TrackDefect[];
}
