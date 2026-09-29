/* Armazón del centro de control: barra lateral de navegación, encabezado
 * con estado de conexión y sesión, y el área de contenido.
 */

import { NavLink, Outlet } from 'react-router-dom';
import { useConnectionStatus } from '../api/socket';
import { useSession } from '../auth/context';
import './layout.css';

const NAV = [
  { to: '/', label: 'Mapa', end: true },
  { to: '/unidad', label: 'Unidad' },
  { to: '/eventos', label: 'Eventos' },
  { to: '/comandos', label: 'Comandos' },
  { to: '/bitacora', label: 'Bitácora' },
];

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

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">SIT</span>
          <span className="brand-name">
            CIIT
            <small>Corredor Interoceánico</small>
          </span>
        </div>

        <nav className="nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link${isActive ? ' is-active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="main">
        <header className="topbar">
          <ConnectionIndicator />

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
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
