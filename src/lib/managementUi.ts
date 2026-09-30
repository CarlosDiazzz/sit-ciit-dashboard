import { Bell, Box, Building2, ClipboardCheck, Container, MapPin, Package, Route, Settings2, ShieldAlert, Smartphone, TrainFront, Users, Waypoints, Wrench, type LucideIcon } from 'lucide-react';

export interface ManagementField {
  key: string; label: string; type: string; required?: boolean;
  options?: { value: string; label: string }[]; resource?: string;
  min?: number; max?: number; roles?: string[]; generated?: boolean;
}
export interface ManagementResource {
  key: string; label: string; fields: ManagementField[]; canWrite: boolean; canCreate: boolean;
}
export const managementGroups = ['Operación', 'Recursos y personas', 'Configuración y cuidado'] as const;
const modules: Record<string, { icon: LucideIcon; description: string; group: typeof managementGroups[number] }> = {
  shipments: { icon: Package, description: 'Prepara la carga y sigue cada envío hasta su entrega.', group: 'Operación' },
  trips: { icon: TrainFront, description: 'Programa recorridos, asigna unidades y consulta reportes.', group: 'Operación' },
  'trip-shipments': { icon: Container, description: 'Organiza los envíos y contenedores de cada viaje.', group: 'Operación' },
  assignments: { icon: ClipboardCheck, description: 'Asigna personas, funciones y horarios a los viajes.', group: 'Operación' },
  incidents: { icon: ShieldAlert, description: 'Atiende incidentes y documenta su resolución.', group: 'Operación' },
  companies: { icon: Building2, description: 'Directorio de clientes, empresas y contactos.', group: 'Recursos y personas' },
  users: { icon: Users, description: 'Gestiona personas, roles y acceso a la operación.', group: 'Recursos y personas' },
  units: { icon: TrainFront, description: 'Controla la disponibilidad y capacidad de la flota.', group: 'Recursos y personas' },
  nodes: { icon: Smartphone, description: 'Consulta y administra los dispositivos de monitoreo.', group: 'Recursos y personas' },
  containers: { icon: Container, description: 'Administra contenedores, propietarios y capacidades.', group: 'Recursos y personas' },
  locations: { icon: MapPin, description: 'Puertos, estaciones, terminales y almacenes.', group: 'Recursos y personas' },
  routes: { icon: Route, description: 'Define el origen, destino y distancia de los recorridos.', group: 'Configuración y cuidado' },
  'route-checkpoints': { icon: Waypoints, description: 'Ordena las escalas y puntos de control de cada ruta.', group: 'Configuración y cuidado' },
  'cargo-types': { icon: Box, description: 'Establece requisitos de manejo por tipo de mercancía.', group: 'Configuración y cuidado' },
  'monitoring-profiles': { icon: Settings2, description: 'Configura sensores, muestreo y umbrales de monitoreo.', group: 'Configuración y cuidado' },
  'notification-rules': { icon: Bell, description: 'Define destinatarios, canales y prioridades de avisos.', group: 'Configuración y cuidado' },
  maintenance: { icon: Wrench, description: 'Programa revisiones y registra el trabajo técnico.', group: 'Configuración y cuidado' },
};
export const managementUi = (key: string) => modules[key] ?? { icon: Box, description: 'Consulta y administra los registros de este módulo.', group: 'Recursos y personas' as const };
export const normalizeSearch = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
