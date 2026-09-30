import { useEffect, useState } from 'react';
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
    <div className="page-head"><div><span className="dss-kicker">TLÁLOC / CONECTIVIDAD</span><h1>Conectividad</h1><p>Disponibilidad de los nodos, batería y datos pendientes de envío.</p></div><PageBreadcrumbs current="Conectividad" /><button className="btn" onClick={state.reload} disabled={state.loading}>Actualizar consulta</button></div>
    <DecisionBrief title="Comprueba la disponibilidad de la información" evidence="El estado corresponde a la última consulta. La antigüedad del reporte ayuda a reconocer cuándo un nodo dejó de enviar información." action="Revisa el nodo de respaldo y la batería cuando falten reportes. Una cola pendiente puede explicar la llegada tardía de datos." to="/unidad" linkLabel="Consultar estado general" />
    <AsyncBoundary state={state} empty={{title:'Sin unidades registradas',hint:'Los nodos aparecerán cuando estén registrados en el servidor.'}}>{units => <>
      <div className="dss-metrics"><article><span>Nodos registrados</span><strong>{units.flatMap(u => u.nodes).length}</strong><small>En la consulta actual</small></article><article><span>Nodos conectados</span><strong>{units.flatMap(u => u.nodes).filter(n => n.isOnline).length}</strong><small>Estado informado por el servidor</small></article><article><span>Nodos desconectados</span><strong>{units.flatMap(u => u.nodes).filter(n => !n.isOnline).length}</strong><small>Revisar el último reporte</small></article><article><span>Unidades sin fuente activa</span><strong>{units.filter(u => !u.activeNodeId).length}</strong><small>Requieren revisar disponibilidad</small></article></div>
      <PagedRows items={units.flatMap(u => u.nodes.map(n => ({ unit: u, node: n })))} label="Estado de nodos">{rows => <div className="table-wrap"><table className="table"><thead><tr><th>Unidad / nodo</th><th>Función</th><th>Conexión</th><th>Último reporte</th><th>Batería</th><th>Cola pendiente</th></tr></thead><tbody>{rows.map(({ unit: u, node: n }) => <tr key={n.id}><td>{u.label ?? u.unitCode}<br /><small>{n.nodeCode}</small></td><td>{n.role === 'primary' ? 'Principal' : 'Respaldo'}{u.activeNodeId === n.id ? ' · Activo' : ''}</td><td><ConnectionBadge online={n.isOnline} /></td><td>{n.lastHeartbeatAt ? formatAgo(n.lastHeartbeatAt) : 'Sin reporte'}</td><td>{n.batteryPct === null ? 'Sin dato' : `${n.batteryPct} %`}</td><td>{n.pendingOutbox ?? 'Sin dato'}</td></tr>)}</tbody></table></div>}</PagedRows>
    </>}</AsyncBoundary>
  </>;
}
