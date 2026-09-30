/* Armazón del centro de control: barra lateral de navegación, encabezado
 * con estado de conexión y sesión, y el área de contenido.
 */

import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useConnectionStatus } from '../api/socket';
import { useSession } from '../auth/context';
import { useColorMode } from '../hooks/useColorMode';
import AztecOrnament from './AztecOrnament';
import './layout.css';
import './decision.css';
import './theme.css';

const NAV = [
  { to: '/', label: 'Ruta', deity: 'Quetzalcóatl', domain: 'Ubicación, recorrido y ETA', glyph: 'Q', theme: 'quetzal', end: true },
  { to: '/conectividad', label: 'Conectividad', deity: 'Tláloc', domain: 'Nodos y disponibilidad', glyph: 'Tl', theme: 'tlaloc', end: false },
  { to: '/unidad', label: 'Estado general', deity: 'Tonatiuh', domain: 'Unidad y telemetría', glyph: 'T', theme: 'tonatiuh', end: false },
  { to: '/eventos', label: 'Movimiento y eventos', deity: 'Ehécatl', domain: 'Impactos y estabilidad', glyph: 'E', theme: 'ehecatl', end: false },
  { to: '/bitacora', label: 'Auditoría', deity: 'Tezcatlipoca', domain: 'Historial de intervenciones', glyph: 'Tz', theme: 'tezcatlipoca', end: false },
  { to: '/comandos', label: 'Comandos', deity: 'Control operativo', domain: 'Seguimiento de órdenes', glyph: 'C', theme: 'control', end: false },
] as const;
const ROLE_LABEL: Record<string, string> = {
  control_center: 'Centro de control',
  operator: 'Operador',
};

function ConnectionIndicator() {
  const status = useConnectionStatus();
  const label =
    status === 'online'
      ? 'Canal en vivo conectado'
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
  const { mode, toggle } = useColorMode();
  const location = useLocation();
  const current = NAV.find((item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to),
  ) ?? NAV[0];

  return (
    <div className="shell" data-theme={current.theme} data-color-mode={mode}>
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
              <span className="nav-glyph" aria-hidden="true">{item.glyph}</span>
              <span className="nav-copy">
                <strong>{item.label}</strong>
                <small>{item.deity} · {item.domain}</small>
              </span>
            </NavLink>
          ))}
        </nav>

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
                <strong>{current.deity}</strong>
                <small>{current.domain}</small>
              </span>
            </div>

            <div className="topbar-right">
              <button
                type="button"
                className="theme-toggle"
                onClick={toggle}
                aria-label={mode === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'}
                title={mode === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'}
              >
                <span className="theme-toggle-icon" aria-hidden="true">
                  {mode === 'light' ? '☾' : '☀'}
                </span>
                <span>{mode === 'light' ? 'Oscuro' : 'Claro'}</span>
              </button>
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
