import { t as translate } from '../accessibility/i18n';
/* Historial de eventos: severidad, confirmación y marca de tardíos.
 *
 * Los eventos nuevos llegan por Socket.IO y se anteponen a la lista
 * cargada: un centro de control no puede pedirle al operador que
 * recargue para enterarse de un impacto.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import PageBreadcrumbs from '../components/PageBreadcrumbs';
import { useSocketEvent } from '../api/socket';
import { useApi } from '../api/useApi';
import type { EventBroadcast, EventRecord, EventVerdict } from '../api/types';
import { AsyncBoundary, EmptyState } from '../components/States';
import { LateBadge, SeverityBadge } from '../components/Badges';
import { eventKindLabel, eventValueUnit } from '../lib/labels';
import { medicionResumida, retrasoResumido, ubicacionResumida } from '../lib/guidance';
import EventSignal from '../components/EventSignal';
import EventVerdictPanel from '../components/EventVerdict';
import { eventGuidance, prioritizeEvents } from '../lib/decisions';
import { formatAgo, formatDateTime } from '../lib/format';
import './tables.css';

export function EventWorkspace({ events }: { events: EventRecord[] }) {
  const [filter, setFilter] = useState('all');
  const [unit, setUnit] = useState('');
  const [kind, setKind] = useState('all');
  // ?evento=<id> abre esa deteccion ya seleccionada. Lo usa el enlace
  // desde un defecto del mapa: sin esto el operador aterrizaba en la
  // lista y tenia que buscar cual de cien estaba revisando.
  const [params] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(params.get('evento'));
  /** Veredictos dados en esta sesion, superpuestos a la lista cargada:
   *  evita recargarla entera y que el operador pierda su posicion. */
  const [veredictos, setVeredictos] = useState<
    Record<string, { verdict: EventVerdict; note: string | null }>
  >({});
  const [, tick] = useState(0);
  useEffect(() => { const timer = setInterval(() => tick(n => n + 1), 10000); return () => clearInterval(timer); }, []);
  const sorted = prioritizeEvents(events);
  const pending = events.filter(e => !e.acknowledgedAt);
  const visible = sorted.filter(e => (filter === 'all' || (filter === 'pending' ? !e.acknowledgedAt : e.severity === filter)) && (!unit || e.unitId === unit) && (kind === 'all' || (kind === 'movement' ? ['impact', 'rollover', 'hard_brake', 'curve_overspeed', 'dynamic_impact', 'track_irregularity'].includes(e.kind) : e.kind === kind)));
  // Se busca primero en TODOS los eventos y no solo en los visibles: al
  // llegar desde un defecto del mapa, un filtro activo lo ocultaria y se
  // mostraria otro distinto sin avisar.
  const selected =
    (selectedId ? events.find(e => e.id === selectedId) : undefined) ??
    visible.find(e => e.id === selectedId) ??
    visible[0];
  const critical = pending.filter(e => e.severity === 'critical').length;
  return <>
    <div className="dss-metrics">
      <article><span>{translate("Críticos sin confirmar")}</span><strong className={critical ? 'dss-critical' : ''}>{critical}</strong><small>{translate("Primera prioridad de revisión")}</small></article>
      <article><span>{translate("Pendientes de confirmar")}</span><strong>{pending.length}</strong><small>{translate("Confirmar no equivale a resolver")}</small></article>
      <article><span>{translate("Unidades con pendientes")}</span><strong>{new Set(pending.map(e => e.unitId)).size}</strong><small>{translate("Dentro de la consulta actual")}</small></article>
      <article><span>{translate("Alertas de posible volcadura")}</span><strong>{pending.filter(e => e.kind === 'rollover').length}</strong><small>{translate("Sin confirmar · No son incidentes verificados")}</small></article>
    </div>
    <div className="dss-workspace">
      <section className="dss-panel">
        <div className="dss-panel-head"><div><span className="dss-kicker">{translate("01 / PRIORIZAR")}</span><h2>{translate("Detecciones de la unidad")}</h2></div><span className="dss-count">{visible.length}{translate(" eventos")}</span></div>
        <div className="dss-filters"><label>{translate("Prioridad")}<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">{translate("Todos los eventos")}</option><option value="pending">{translate("Sin confirmar")}</option><option value="critical">{translate("Críticos")}</option><option value="warning">{translate("Advertencias")}</option><option value="info">{translate("Informativos")}</option></select></label><label>{translate("Detección")}<select value={kind} onChange={e => setKind(e.target.value)}><option value="all">{translate("Todos los tipos")}</option><option value="movement">{translate("Movimientos bruscos")}</option><option value="rollover">{translate("Posible volcadura")}</option><option value="impact">{translate("Impactos")}</option><option value="hard_brake">{translate("Frenado brusco")}</option><option value="curve_overspeed">{translate("Exceso en curva")}</option><option value="dynamic_impact">{translate("Golpe dinámico")}</option><option value="track_irregularity">{translate("Irregularidad de vía")}</option></select></label><label>{translate("Unidad")}<select value={unit} onChange={e => setUnit(e.target.value)}><option value="">{translate("Todas las unidades")}</option>{[...new Map(events.map(e => [e.unitId, e.unitCode ?? e.unitId.slice(0, 8)])).entries()].map(([id, label]) => <option key={id} value={id}>{translate(label)}</option>)}</select></label></div>
        <p className="dss-caption">{translate("Sin confirmar primero, después severidad y fecha más reciente.")}</p>
        <div className="dss-event-list">{visible.map(e => <button className={`dss-event ${selected?.id === e.id ? 'is-selected' : ''}`} key={e.id} onClick={() => setSelectedId(e.id)} aria-pressed={selected?.id === e.id}><span className="dss-event-top"><strong>{translate(eventKindLabel(e.kind))}</strong><SeverityBadge severity={e.severity} /></span><span className="dss-event-unit">{translate(e.unitCode ?? `Unidad ${e.unitId.slice(0, 8)}`)}</span><span className="dss-event-bottom"><span>{translate(formatAgo(e.ts))}</span><span>{translate(e.acknowledgedAt ? 'Confirmado' : 'Sin confirmar')} →</span></span></button>)}</div>
        {!visible.length && <EmptyState title={translate("Sin coincidencias")} hint="Prueba otra prioridad o unidad." />}
      </section>
      <aside className="dss-panel dss-evidence" aria-label={translate("Detalle del evento seleccionado")}>
        <div className="dss-panel-head"><div><span className="dss-kicker">{translate("02 / COMPRENDER")}</span><h2>{translate("Evidencia y contexto")}</h2></div></div>
        {selected ? <div key={selected.id}>
          <div className="dss-detail-title"><SeverityBadge severity={selected.severity} /><h3>{translate(eventKindLabel(selected.kind))}</h3><p>{translate(selected.unitCode ?? `Unidad ${selected.unitId.slice(0, 8)}`)}</p></div>
                    {(selected.kind === 'rollover' || selected.kind === 'impact') && <section className="movement-assessment">
            <span className="dss-kicker">{translate("INTERPRETACIÓN DEL MOVIMIENTO")}</span>
            <h3>{translate(selected.kind === 'rollover' ? 'Alerta de posible pérdida de estabilidad' : 'Impacto o movimiento brusco detectado')}</h3>
            <p>{translate(selected.kind === 'rollover' ? 'El nodo reportó una posible volcadura. Requiere corroboración con otras lecturas y verificación del operador.' : 'Un impacto no equivale a una volcadura ni confirma un descarrilamiento.')}</p>
            <dl><div><dt>{translate("Giroscopio X / Y / Z del evento")}</dt><dd>{translate("No adjunto al registro")}</dd></div><div><dt>{translate("Descarrilamiento")}</dt><dd>{translate("No determinado")}</dd></div></dl>
            <small>{translate("La confirmación de lectura de la alerta no verifica físicamente el incidente.")}</small>
          </section>}
          <dl className="dss-facts"><div><dt>{translate("Lectura registrada")}</dt><dd>{translate(selected.value === null ? 'No disponible' : String(selected.value) + ' ' + eventValueUnit(selected.kind))}</dd></div><div><dt>{translate("Umbral del evento")}</dt><dd>{translate(selected.threshold === null ? 'No disponible' : String(selected.threshold) + ' ' + eventValueUnit(selected.kind))}</dd></div><div><dt>{translate("Ocurrió")}</dt><dd>{translate(formatDateTime(selected.ts))}<small>{translate(formatAgo(selected.ts))}</small></dd></div><div><dt>{translate("Recibido")}</dt><dd>{translate(formatDateTime(selected.receivedAt))} <LateBadge ts={selected.ts} receivedAt={selected.receivedAt} /></dd></div><div><dt>{translate("Fuente")}</dt><dd>{translate(selected.nodeId ?? 'Comparación a nivel unidad')}</dd></div><div><dt>{translate("Confirmación")}</dt><dd>{translate(selected.acknowledgedAt ? formatDateTime(selected.acknowledgedAt) : 'Pendiente')}</dd></div></dl>
          <EventVerdictPanel
            eventId={selected.id}
            actual={veredictos[selected.id]?.verdict ?? selected.verdict}
            nota={veredictos[selected.id]?.note ?? selected.verdictNote}
            onGuardado={(veredicto, nota) =>
              setVeredictos((prev) => ({
                ...prev,
                [selected.id]: { verdict: veredicto, note: nota },
              }))
            }
          />
          <EventSignal eventId={selected.id} />
          <p className="dss-caption">{translate(eventValueUnit(selected.kind) ? 'Unidad de medida indicada según el contrato. ' : 'El registro no especifica la unidad de medida. ')}{translate("La severidad proviene del evento; no confirma por sí sola el estado actual de la carga.")}</p>
          <section className="dss-recommendation">
            <span className="dss-kicker">{translate("03 / DECIDIR")}</span>
            <h3>{translate("Acción sugerida")}</h3>
            <p>{translate(eventGuidance[selected.kind] ?? 'Verifica la evidencia con el operador antes de actuar.')}</p>
            {/* Las cifras del propio evento, para no obligar a ir a
                buscarlas: cuánto se midió, dónde y si llegó tarde. */}
            {[medicionResumida(selected), ubicacionResumida(selected), retrasoResumido(selected)]
              .filter((f): f is string => f !== null)
              .map((frase) => (
                <p key={frase} className="dss-evidence-line">{translate(frase)}</p>
              ))}
            <div className="dss-actions">
              {/* Con el nodo en el enlace, la vista abre centrada en él
                  en vez de dejar al operador buscándolo. */}
              <Link
                to={selected.nodeCode ? `/unidad?nodo=${selected.nodeCode}` : '/unidad'}
                className="btn"
              >{translate("Consultar telemetría ↗")}</Link>
              <Link to={selected.nodeCode ? `/comandos?nodo=${selected.nodeCode}` : '/comandos'}>{translate("Seguimiento de comandos →")}</Link>
            </div>
            <small>{translate("Orientación para revisión humana. No ejecuta acciones automáticas.")}</small>
          </section>
        </div> : <p className="dss-caption">{translate("Selecciona un evento para revisar su evidencia.")}</p>}
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
          <h1>{translate("Eventos")}</h1>
          <p>{translate("Detecciones de los nodos y eventos generados por el backend.")}</p>
        </div>
        <PageBreadcrumbs current="Eventos" />
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
