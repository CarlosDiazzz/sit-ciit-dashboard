import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { EventRecord } from '../api/types';
import { EventWorkspace } from './Eventos';

// Datos sintéticos exclusivos de la vista previa solicitada por el usuario.
// Esta página se importa únicamente en desarrollo y no escribe en la API.
function sampleEvents(): EventRecord[] {
  const now = Date.now();
  const ago = (minutes: number) => new Date(now - minutes * 60000).toISOString();
  const scenarios: { kind: EventRecord['kind']; severity: EventRecord['severity']; unit: string; minutes: number; value: number | null; threshold: number | null; confirmed?: boolean; delayed?: boolean }[] = [
    { kind: 'rollover', severity: 'critical', unit: 'DEMO-Z014', minutes: 2, value: null, threshold: null },
    { kind: 'door_open', severity: 'critical', unit: 'DEMO-Z021', minutes: 5, value: null, threshold: null },
    { kind: 'sensor_disagreement', severity: 'warning', unit: 'DEMO-Z014', minutes: 8, value: null, threshold: null },
    { kind: 'threshold_exceeded', severity: 'warning', unit: 'DEMO-Z008', minutes: 18, value: 740, threshold: 600, delayed: true },
    { kind: 'source_failover', severity: 'warning', unit: 'DEMO-Z032', minutes: 12, value: null, threshold: null },
    { kind: 'door_closed', severity: 'info', unit: 'DEMO-Z021', minutes: 1, value: null, threshold: null },
    { kind: 'impact', severity: 'critical', unit: 'DEMO-Z008', minutes: 45, value: 2.9, threshold: 2.5, confirmed: true },
    { kind: 'door_closed', severity: 'info', unit: 'DEMO-Z032', minutes: 30, value: null, threshold: null, confirmed: true },
  ];
  return scenarios.map((s, index) => ({
    id: `preview-${index}`, unitId: s.unit,
    nodeId: s.kind === 'sensor_disagreement' || s.kind === 'source_failover' ? null : `${s.unit}-A`,
    kind: s.kind, severity: s.severity, value: s.value, threshold: s.threshold,
    gpsLat: null, gpsLon: null, ts: ago(s.minutes), receivedAt: ago(s.delayed ? 3 : s.minutes - 0.05),
    acknowledgedAt: s.confirmed ? ago(s.minutes - 3) : null,
    acknowledgedBy: s.confirmed ? 'Operador de demostración' : null,
    details: null,
  }));
}

export default function PreviewDss() {
  const [events, setEvents] = useState(sampleEvents);
  return <>
    <section className="preview-banner" role="note"><div><strong>VISTA PREVIA · DATOS FICTICIOS</strong><p>Escenarios ilustrativos para evaluar el diseño. No representan unidades reales ni deben usarse para tomar decisiones operativas.</p></div><Link to="/eventos">Salir de la vista previa →</Link></section>
    <div className="page-head"><div><span className="dss-kicker">EHÉCATL / MOVIMIENTO Y EVENTOS</span><h1>Movimiento y seguridad</h1><p>Revisa movimientos bruscos, posibles volcaduras y eventos que requieren verificación.</p></div><button className="btn" onClick={() => setEvents(sampleEvents())}>Reiniciar ejemplos ↻</button></div>
    <div className="dss-context"><span>8 eventos ficticios · 4 unidades de demostración</span><span>Los enlaces de telemetría y comandos salen a las vistas reales</span></div>
    <EventWorkspace events={events} />
  </>;
}
