import { t as translate } from '../accessibility/i18n';
import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '../api/client';
import { useApi } from '../api/useApi';
import { AsyncBoundary } from '../components/States';
import { ConnectionBadge } from '../components/Badges';
import DecisionBrief from '../components/DecisionBrief';
import PageBreadcrumbs from '../components/PageBreadcrumbs';
import { PagedRows } from '../components/Pagination';
import { formatAgo } from '../lib/format';
import './tables.css';

export default function Conectividad() {
  const state = useApi(() => api.listUnits());
  const [, tick] = useState(0);
  useEffect(() => { const timer = setInterval(() => tick(n => n + 1), 10000); return () => clearInterval(timer); }, []);
  return <>
    <div className="page-head">
      <div>
        <span className="dss-kicker">{translate("TLÁLOC / CONECTIVIDAD")}</span>
        <h1>{translate("Conectividad")}</h1>
        <p>{translate("Disponibilidad de los nodos, batería y datos pendientes de envío.")}</p>
      </div>
      <div className="page-head-actions">
        <PageBreadcrumbs current="Conectividad" />
        <button className="btn page-refresh-btn" onClick={state.reload} disabled={state.loading}>
          <RefreshCw size={15} aria-hidden="true" />
          {translate("Actualizar consulta")}
        </button>
      </div>
    </div>
    <DecisionBrief title={translate("Comprueba la disponibilidad de la información")} evidence={translate("El estado corresponde a la última consulta. La antigüedad del reporte ayuda a reconocer cuándo un nodo dejó de enviar información.")} action={translate("Revisa el nodo de respaldo y la batería cuando falten reportes. Una cola pendiente puede explicar la llegada tardía de datos.")} to="/unidad" linkLabel={translate("Consultar estado general")} />
    <AsyncBoundary state={state} empty={{title:'Sin unidades registradas',hint:'Los nodos aparecerán cuando estén registrados en el servidor.'}}>{units => <>
      <div className="dss-metrics"><article><span>{translate("Nodos registrados")}</span><strong>{units.flatMap(u => u.nodes).length}</strong><small>{translate("En la consulta actual")}</small></article><article><span>{translate("Nodos conectados")}</span><strong>{units.flatMap(u => u.nodes).filter(n => n.isOnline).length}</strong><small>{translate("Estado informado por el servidor")}</small></article><article><span>{translate("Nodos desconectados")}</span><strong>{units.flatMap(u => u.nodes).filter(n => !n.isOnline).length}</strong><small>{translate("Revisar el último reporte")}</small></article><article><span>{translate("Unidades sin fuente activa")}</span><strong>{units.filter(u => !u.activeNodeId).length}</strong><small>{translate("Requieren revisar disponibilidad")}</small></article></div>
      <PagedRows items={units.flatMap(u => u.nodes.map(n => ({ unit: u, node: n })))} label={translate("Estado de nodos")}>{rows => <div className="table-wrap"><table className="table"><thead><tr><th>{translate("Unidad / nodo")}</th><th>{translate("Función")}</th><th>{translate("Conexión")}</th><th>{translate("Último reporte")}</th><th>{translate("Batería")}</th><th>{translate("Cola pendiente")}</th></tr></thead><tbody>{rows.map(({ unit: u, node: n }) => <tr key={n.id}><td>{translate(u.label ?? u.unitCode)}<br /><small>{translate(n.nodeCode)}</small></td><td>{translate(n.role === 'primary' ? 'Principal' : 'Respaldo')}{translate(u.activeNodeId === n.id ? ' · Activo' : '')}</td><td><ConnectionBadge online={n.isOnline} /></td><td>{translate(n.lastHeartbeatAt ? formatAgo(n.lastHeartbeatAt) : 'Sin reporte')}</td><td>{translate(n.batteryPct === null ? 'Sin dato' : `${n.batteryPct} %`)}</td><td>{translate(n.pendingOutbox ?? 'Sin dato')}</td></tr>)}</tbody></table></div>}</PagedRows>
    </>}</AsyncBoundary>
  </>;
}
