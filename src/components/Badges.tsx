/* Insignias de severidad, conexión y estado de comando.
 *
 * Concentran la traducción de los valores del contrato a texto en español
 * y a color. Una sola definición evita que "critical" se pinte de rojos
 * distintos en cada vista.
 */

import type { EventSeverity } from '../contract/contract';
import type { CommandStatus } from '../api/types';
import './badges.css';

const SEVERITY_LABEL: Record<EventSeverity, string> = {
  info: 'Info',
  warning: 'Advertencia',
  critical: 'Crítico',
};

export function SeverityBadge({ severity }: { severity: EventSeverity }) {
  return (
    <span className={`badge badge-${severity}`}>{SEVERITY_LABEL[severity]}</span>
  );
}

export function ConnectionBadge({ online }: { online: boolean }) {
  return (
    <span className={`badge ${online ? 'badge-online' : 'badge-offline'}`}>
      <span className="badge-dot" aria-hidden="true" />
      {online ? 'En línea' : 'Sin conexión'}
    </span>
  );
}

const STATUS_LABEL: Record<CommandStatus, string> = {
  sent: 'Enviado',
  delivered: 'Entregado',
  executed: 'Ejecutado',
  rejected: 'Rechazado',
};

export function CommandStatusBadge({ status }: { status: CommandStatus }) {
  return <span className={`badge badge-cmd-${status}`}>{STATUS_LABEL[status]}</span>;
}

/** Marca los mensajes que llegaron tarde: se generaron sin señal y
 *  esperaron en el outbox del celular. El retraso es la diferencia entre
 *  el reloj del dispositivo (ts) y el del servidor (receivedAt). */
export function LateBadge({ ts, receivedAt }: { ts: string; receivedAt: string }) {
  const delayMs = new Date(receivedAt).getTime() - new Date(ts).getTime();
  // Umbral generoso: por debajo de 10 s la diferencia es latencia normal
  // o desfase de relojes, no un mensaje represado.
  if (!Number.isFinite(delayMs) || delayMs < 10_000) return null;

  return (
    <span className="badge badge-late" title={`Recibido ${formatDelay(delayMs)} después`}>
      Tardío +{formatDelay(delayMs)}
    </span>
  );
}

function formatDelay(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  return `${(m / 60).toFixed(1)} h`;
}
