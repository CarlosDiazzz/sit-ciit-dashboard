/* Historial de eventos: severidad, confirmación y marca de tardíos.
 *
 * Los eventos nuevos llegan por Socket.IO y se anteponen a la lista
 * cargada: un centro de control no puede pedirle al operador que
 * recargue para enterarse de un impacto.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useSocketEvent } from '../api/socket';
import { useApi } from '../api/useApi';
import type { EventBroadcast, EventRecord } from '../api/types';
import { AsyncBoundary, EmptyState } from '../components/States';
import { LateBadge, SeverityBadge } from '../components/Badges';
import { eventKindLabel, eventValueUnit } from '../lib/labels';
import { eventGuidance, prioritizeEvents } from '../lib/decisions';
import { formatAgo, formatDateTime } from '../lib/format';
import './tables.css';

export function EventWorkspace({ events }: { events: EventRecord[] }) {
  const [filter, setFilter] = useState('all');
  const [unit, setUnit] = useState('');
  const [kind, setKind] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [, tick] = useState(0);
  useEffect(() => { const timer = setInterval(() => tick(n => n + 1), 10000); return () => clearInterval(timer); }, []);
  const sorted = prioritizeEvents(events);
  const pending = events.filter(e => !e.acknowledgedAt);
  const visible = sorted.filter(e => (filter === 'all' || (filter === 'pending' ? !e.acknowledgedAt : e.severity === filter)) && (!unit || e.unitId === unit) && (kind === 'all' || (kind === 'movement' ? ['impact', 'rollover', 'hard_brake', 'curve_overspeed', 'dynamic_impact', 'track_irregularity'].includes(e.kind) : e.kind === kind)));
  const selected = visible.find(e => e.id === selectedId) ?? visible[0];
  const critical = pending.filter(e => e.severity === 'critical').length;
  return <>
    <div className="dss-metrics">
      <article><span>Críticos sin confirmar</span><strong className={critical ? 'dss-critical' : ''}>{critical}</strong><small>Primera prioridad de revisión</small></article>
      <article><span>Pendientes de confirmar</span><strong>{pending.length}</strong><small>Confirmar no equivale a resolver</small></article>
      <article><span>Unidades con pendientes</span><strong>{new Set(pending.map(e => e.unitId)).size}</strong><small>Dentro de la consulta actual</small></article>
      <article><span>Alertas de posible volcadura</span><strong>{pending.filter(e => e.kind === 'rollover').length}</strong><small>Sin confirmar · No son incidentes verificados</small></article>
    </div>
    <div className="dss-workspace">
      <section className="dss-panel">
        <div className="dss-panel-head"><div><span className="dss-kicker">01 / PRIORIZAR</span><h2>Detecciones de la unidad</h2></div><span className="dss-count">{visible.length} eventos</span></div>
        <div className="dss-filters"><label>Prioridad<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Todos los eventos</option><option value="pending">Sin confirmar</option><option value="critical">Críticos</option><option value="warning">Advertencias</option><option value="info">Informativos</option></select></label><label>Detección<select value={kind} onChange={e => setKind(e.target.value)}><option value="all">Todos los tipos</option><option value="movement">Movimientos bruscos</option><option value="rollover">Posible volcadura</option><option value="impact">Impactos</option><option value="hard_brake">Frenado brusco</option><option value="curve_overspeed">Exceso en curva</option><option value="dynamic_impact">Golpe dinámico</option><option value="track_irregularity">Irregularidad de vía</option></select></label><label>Unidad<select value={unit} onChange={e => setUnit(e.target.value)}><option value="">Todas las unidades</option>{[...new Map(events.map(e => [e.unitId, e.unitCode ?? e.unitId.slice(0, 8)])).entries()].map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label></div>
        <p className="dss-caption">Sin confirmar primero, después severidad y fecha más reciente.</p>
        <div className="dss-event-list">{visible.map(e => <button className={`dss-event ${selected?.id === e.id ? 'is-selected' : ''}`} key={e.id} onClick={() => setSelectedId(e.id)} aria-pressed={selected?.id === e.id}><span className="dss-event-top"><strong>{eventKindLabel(e.kind)}</strong><SeverityBadge severity={e.severity} /></span><span className="dss-event-unit">{e.unitCode ?? `Unidad ${e.unitId.slice(0, 8)}`}</span><span className="dss-event-bottom"><span>{formatAgo(e.ts)}</span><span>{e.acknowledgedAt ? 'Confirmado' : 'Sin confirmar'} →</span></span></button>)}</div>
        {!visible.length && <EmptyState title="Sin coincidencias" hint="Prueba otra prioridad o unidad." />}
      </section>
      <aside className="dss-panel dss-evidence" aria-label="Detalle del evento seleccionado">
        <div className="dss-panel-head"><div><span className="dss-kicker">02 / COMPRENDER</span><h2>Evidencia y contexto</h2></div></div>
        {selected ? <div key={selected.id}>
          <div className="dss-detail-title"><SeverityBadge severity={selected.severity} /><h3>{eventKindLabel(selected.kind)}</h3><p>{selected.unitCode ?? `Unidad ${selected.unitId.slice(0, 8)}`}</p></div>
                    {(selected.kind === 'rollover' || selected.kind === 'impact') && <section className="movement-assessment">
            <span className="dss-kicker">INTERPRETACIÓN DEL MOVIMIENTO</span>
            <h3>{selected.kind === 'rollover' ? 'Alerta de posible pérdida de estabilidad' : 'Impacto o movimiento brusco detectado'}</h3>
            <p>{selected.kind === 'rollover' ? 'El nodo reportó una posible volcadura. Requiere corroboración con otras lecturas y verificación del operador.' : 'Un impacto no equivale a una volcadura ni confirma un descarrilamiento.'}</p>
            <dl><div><dt>Giroscopio X / Y / Z del evento</dt><dd>No adjunto al registro</dd></div><div><dt>Descarrilamiento</dt><dd>No determinado</dd></div></dl>
            <small>La confirmación de lectura de la alerta no verifica físicamente el incidente.</small>
          </section>}
          <dl className="dss-facts"><div><dt>Lectura registrada</dt><dd>{selected.value === null ? 'No disponible' : String(selected.value) + ' ' + eventValueUnit(selected.kind)}</dd></div><div><dt>Umbral del evento</dt><dd>{selected.threshold === null ? 'No disponible' : String(selected.threshold) + ' ' + eventValueUnit(selected.kind)}</dd></div><div><dt>Ocurrió</dt><dd>{formatDateTime(selected.ts)}<small>{formatAgo(selected.ts)}</small></dd></div><div><dt>Recibido</dt><dd>{formatDateTime(selected.receivedAt)} <LateBadge ts={selected.ts} receivedAt={selected.receivedAt} /></dd></div><div><dt>Fuente</dt><dd>{selected.nodeId ?? 'Comparación a nivel unidad'}</dd></div><div><dt>Confirmación</dt><dd>{selected.acknowledgedAt ? formatDateTime(selected.acknowledgedAt) : 'Pendiente'}</dd></div></dl>
          <p className="dss-caption">{eventValueUnit(selected.kind) ? 'Unidad de medida indicada según el contrato. ' : 'El registro no especifica la unidad de medida. '}La severidad proviene del evento; no confirma por sí sola el estado actual de la carga.</p>
          <section className="dss-recommendation"><span className="dss-kicker">03 / DECIDIR</span><h3>Acción sugerida</h3><p>{eventGuidance[selected.kind] ?? 'Verifica la evidencia con el operador antes de actuar.'}</p><div className="dss-actions"><Link to="/unidad" className="btn">Consultar telemetría ↗</Link><Link to="/comandos">Seguimiento de comandos →</Link></div><small>Orientación para revisión humana. No ejecuta acciones automáticas.</small></section>
        </div> : <p className="dss-caption">Selecciona un evento para revisar su evidencia.</p>}
      </aside>
    </div>
  </>;
}

export default function Eventos() {
  const state = useApi<EventRecord[]>(() => api.listEvents({ limit: 100 }));
  /** Eventos llegados por socket desde la última carga. Se mantienen
   *  aparte en vez de recargar la lista entera en cada uno. */
  const [enVivo, setEnVivo] = useState<EventRecord[]>([]);

  useSocketEvent(
    'event',
    useCallback((ev: EventBroadcast) => {
      // El socket emite la forma del mensaje MQTT, no la de la fila: no
      // trae el id de la base ni el estado de confirmación. Se completa
      // con lo que la vista necesita y se marca como recién llegado.
      const fila: EventRecord = {
        id: `vivo-${ev.nodeId}-${ev.ts}`,
        unitId: ev.unitId,
        nodeId: ev.nodeId,
        kind: ev.kind,
        severity: ev.severity,
        value: ev.value ?? null,
        threshold: ev.threshold ?? null,
        gpsLat: ev.gps?.lat ?? null,
        gpsLon: ev.gps?.lon ?? null,
        ts: new Date(ev.ts).toISOString(),
        // Recién recibido: sin retraso apreciable entre ambos relojes.
        receivedAt: new Date().toISOString(),
        acknowledgedAt: null,
        acknowledgedBy: null,
        // El socket no manda el detalle estructurado (solo lo tiene la
        // fila guardada); llega al recargar desde /events.
        details: null,
      };
      setEnVivo((prev) => [fila, ...prev].slice(0, 100));
    }, []),
  );

  // Se combinan antes de decidir qué mostrar: con la lista guardada
  // vacía, AsyncBoundary pintaría el estado vacío y esconderia un
  // evento que acaba de llegar.
  const combinados: EventRecord[] | null =
    state.data === null && enVivo.length === 0 ? null : [...enVivo, ...(state.data ?? [])];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Eventos</h1>
          <p>Detecciones de los nodos y eventos generados por el backend.</p>
        </div>
      </div>

      <AsyncBoundary
        state={{ ...state, data: combinados }}
        empty={{
          title: 'Sin eventos registrados',
          hint: 'Aparecerán aquí en cuanto un nodo detecte un impacto, apertura de puerta o volcadura.',
        }}
      >
        {(eventos) => <EventWorkspace events={eventos} />}
      </AsyncBoundary>
    </>
  );
}
