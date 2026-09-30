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
export type BackendEventKind = 'source_failover' | 'sensor_disagreement';

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
  nodeId: string;
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

export interface EventRecord {
  id: string;
  unitId: string;
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
  role: IssuerRole;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
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

/** Los nombres y formas que aún no emite el backend están comentados: se
 *  agregan cuando existan, para no tipar contra algo inventado. */
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
  // event: (event: EventRecord) => void;              // Fase 2
  'command:update': (payload: CommandUpdate) => void;
}
