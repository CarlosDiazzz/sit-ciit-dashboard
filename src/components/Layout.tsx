/* Armazón del centro de control: barra lateral de navegación, encabezado
 * con estado de conexión y sesión, y el área de contenido.
 */

import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Activity, ClipboardList, CloudSun, Map as MapIcon, Radio, ShieldAlert } from 'lucide-react';
import { useConnectionStatus } from '../api/socket';
import { useSession } from '../auth/context';
import AztecOrnament from './AztecOrnament';
import './layout.css';

const NAV = [
  // Quetzalcóatl — Mapa: Ruta
  { to: '/', label: 'Mapa', domain: 'Ruta', icon: MapIcon, theme: 'quetzal', end: true },
  // Tonatiuh — Unidad: Estado general
  { to: '/unidad', label: 'Unidad', domain: 'Estado general', icon: Activity, theme: 'tonatiuh', end: false },
  // Tezcatlipoca — Eventos: Seguridad
  { to: '/eventos', label: 'Eventos', domain: 'Seguridad', icon: ShieldAlert, theme: 'tezcatlipoca', end: false },
  // Ehécatl — Comandos: Movimiento
  { to: '/comandos', label: 'Comandos', domain: 'Movimiento', icon: Radio, theme: 'ehecatl', end: false },
  // Tezcatlipoca — Bitácora: Incidencias
  { to: '/bitacora', label: 'Bitácora', domain: 'Incidencias', icon: ClipboardList, theme: 'tezcatlipoca', end: false },
] as const;

// Tláloc — módulo Ambiente, próximamente.
const TLALOC = { domain: 'Ambiente', icon: CloudSun };

const ROLE_LABEL: Record<string, string> = {
  control_center: 'Centro de control',
  operator: 'Operador',
};

function ConnectionIndicator() {
  const status = useConnectionStatus();
  const label =
    status === 'online'
      ? 'Datos en vivo'
      : status === 'connecting'
        ? 'Conectando…'
        : 'Sin conexión';

  return (
    <span className={`conn conn-${status}`} title={`WebSocket: ${status}`}>
      <span className="conn-dot" aria-hidden="true" />
      {label}
    </span>
  );
}

export default function Layout() {
  const { user, signOut } = useSession();
  const location = useLocation();
  const current = NAV.find((item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to),
  ) ?? NAV[0];

  return (
    <div className="shell" data-theme={current.theme}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <img src="/zenda-logo-dark.png" alt="" />
          </span>
          <span className="brand-name">
            Zenda
            <small>Centro de monitoreo</small>
          </span>
        </div>

        <p className="sidebar-kicker">Corredor Interoceánico · Línea Z</p>

        <nav className="nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link${isActive ? ' is-active' : ''}`}
              data-nav-theme={item.theme}
            >
              <span className="nav-glyph" aria-hidden="true"><item.icon size={18} strokeWidth={1.8} /></span>
              <span className="nav-copy">
                <strong>{item.label}</strong>
                <small>{item.domain}</small>
              </span>
            </NavLink>
          ))}
        </nav>

        <div className="coming-soon" aria-label="Módulo ambiente próximamente">
          <span className="nav-glyph" aria-hidden="true"><TLALOC.icon size={18} strokeWidth={1.8} /></span>
          <span className="nav-copy">
            <strong>{TLALOC.domain}</strong>
            <small>Próximamente</small>
          </span>
        </div>

        <footer className="sidebar-foot">
          <span className="mini-glyph" aria-hidden="true">◆</span>
          Telemetría ferroviaria
        </footer>
      </aside>

      <div className="main">
        <header className="topbar">
          <AztecOrnament kind="feathers" />
          <div className="topbar-content">
            <div className="topbar-context">
              <ConnectionIndicator />
              <span className="context-divider" aria-hidden="true" />
              <span className="section-context">
                <small>{current.domain}</small>
              </span>
            </div>

            <div className="topbar-right">
              {user ? (
                <>
                  <span className="user">
                    {user.email}
                    <small>{ROLE_LABEL[user.role] ?? user.role}</small>
                  </span>
                  <button type="button" className="btn" onClick={signOut}>
                    Salir
                  </button>
                </>
              ) : (
                <NavLink to="/login" className="btn btn-primary">
                  Iniciar sesión
                </NavLink>
              )}
            </div>
          </div>
          <AztecOrnament kind="serpent" />
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
