import { setPreferences, usePreferences } from '../accessibility/preferences';
import AccessibilityPanel from '../accessibility/AccessibilityPanel';
import { t as translate } from '../accessibility/i18n';
/* Armazón del centro de control: barra lateral de navegación, encabezado
 * con estado de conexión y sesión, y el área de contenido.
 */

import { useEffect, useRef } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Activity,
  ClipboardList,
  DoorOpen,
  Languages,
  Map as MapIcon,
  Moon,
  Radio,
  ShieldAlert,
  Smartphone,
  Sun,
  Users,
  Wifi,
  UserRound,
} from "lucide-react";
import { useConnectionStatus } from "../api/socket";
import { useSession } from "../auth/context";
import { useColorMode } from "../hooks/useColorMode";
import { userRoleLabel } from "../lib/labels";
import AztecOrnament from "./AztecOrnament";
import NavigationSearch from './NavigationSearch';
import { useApi } from '../api/useApi';
import { api } from '../api/client';
import { managementUi, type ManagementResource } from '../lib/managementUi';
import "./layout.css";
import "./decision.css";
import "./theme.css";

const NAV = [
  {
    to: "/",
    label: "Ruta",
    deity: "Quetzalcóatl",
    domain: "Ubicación, recorrido y ETA",
    icon: MapIcon,
    theme: "quetzal",
    end: true,
  },
  {
    to: "/conectividad",
    label: "Conectividad",
    deity: "Tláloc",
    domain: "Nodos y disponibilidad",
    icon: Wifi,
    theme: "tlaloc",
    end: false,
  },
  {
    to: "/unidad",
    label: "Estado general",
    deity: "Tonatiuh",
    domain: "Unidad y telemetría",
    icon: Activity,
    theme: "tonatiuh",
    end: false,
  },
  {
    to: "/eventos",
    label: "Movimiento y eventos",
    deity: "Ehécatl",
    domain: "Impactos y estabilidad",
    icon: ShieldAlert,
    theme: "ehecatl",
    end: false,
  },
  {
    to: "/bitacora",
    label: "Auditoría",
    deity: "Tezcatlipoca",
    domain: "Historial de intervenciones",
    icon: ClipboardList,
    theme: "tezcatlipoca",
    end: false,
  },
  {
    to: "/comandos",
    label: "Comandos",
    deity: "Control operativo",
    domain: "Seguimiento de órdenes",
    icon: Radio,
    theme: "comandos",
    end: false,
  },
] as const;

// Solo visible para control_center: son cuentas de otras personas, no
// algo que un operador o cliente deba ni siquiera ver en el nav.
const USUARIOS_NAV = {
  to: "/gestion/users",
  label: "Usuarios",
  deity: "Acceso",
  domain: "Cuentas del centro de control",
  icon: Users,
  theme: "tlaloc",
  end: false,
} as const;

const NODOS_NAV = {
  to: "/nodos",
  label: "Nodos",
  deity: "Acceso",
  domain: "Identidad y secretos de campo",
  icon: Smartphone,
  theme: "tonatiuh",
  end: false,
} as const;

const AUDITORIA_NAV = {
  to: "/auditoria",
  label: "Auditoría administrativa",
  deity: "Seguimiento",
  domain: "Cambios y responsables",
  icon: ClipboardList,
  theme: "ehecatl",
  end: false,
} as const;

function ConnectionIndicator() {
  const status = useConnectionStatus();
  const label =
    status === "online"
      ? "Canal en vivo conectado"
      : status === "connecting"
        ? "Conectando…"
        : "Sin conexión";

  return (
    <span className={`conn conn-${status}`} title={translate(`WebSocket: ${status}`)}>
      <span className="conn-dot" aria-hidden="true" />
      {translate(label)}
    </span>
  );
}

export default function Layout() {
  const { user, signOut } = useSession();
  const { mode, toggle } = useColorMode();
  const preferences = usePreferences();
  const location = useLocation();
  const topbarRef = useRef<HTMLElement>(null);
  const previousPath = useRef(location.pathname);

  useEffect(() => {
    if (previousPath.current === location.pathname) return;
    previousPath.current = location.pathname;
    const topbar = topbarRef.current;
    if (!topbar) return;
    topbar.classList.remove("topbar-shine");
    // Reinicia el barrido incluso si se cambia de sección rápidamente.
    void topbar.offsetWidth;
    topbar.classList.add("topbar-shine");
    const timer = window.setTimeout(() => topbar.classList.remove("topbar-shine"), 450);
    return () => window.clearTimeout(timer);
  }, [location.pathname]);
  const resources = useApi<ManagementResource[]>(() => api.managementResources(), [user?.id]);
  // cliente no tiene nada que hacer aquí (RequireAuth ya le bloquea las
  // rutas): mostrarle links que van a rebotar solo confunde.
  const managementNav = {
    to: "/gestion",
    label: user?.role === "cliente" ? "Mis envíos" : "Gestión logística",
    deity: "Operación",
    domain: "Recursos, envíos y viajes",
    icon: ClipboardList,
    theme: "quetzal",
    end: false,
  };
  const nav =
    user?.role === "cliente" || user?.role === "technician"
      ? [managementNav]
      : ["admin", "control_center"].includes(user?.role ?? "")
        ? [...NAV, managementNav, USUARIOS_NAV, NODOS_NAV, AUDITORIA_NAV]
        : [...NAV, managementNav];
  if (user?.role !== "cliente")
    nav.push({
      to: "/historial-nodos",
      label: "Historial de nodos",
      deity: "Consulta",
      domain: "Lecturas guardadas por dispositivo",
      icon: ClipboardList,
      theme: "control",
      end: false,
    });
  nav.push({
    to: "/avisos",
    label: "Mis avisos",
    deity: "Alertas",
    domain: "Incidentes de tu operación",
    icon: ShieldAlert,
    theme: "tezcatlipoca",
    end: false,
  });
  if (user?.role === 'auditor') nav.push(AUDITORIA_NAV);
  const current =
    [...nav].sort((a, b) => b.to.length - a.to.length).find((item) =>
      item.end
        ? location.pathname === item.to
        : location.pathname.startsWith(item.to),
    ) ?? NAV[0];
  const entries = [
    ...nav.filter(n => n.to !== '/gestion/users').map(n => ({ to: n.to, label: n.label, description: n.domain, group: 'Secciones', icon: n.icon })),
    ...(resources.data ?? []).map(r => ({ to: `/gestion/${r.key}`, label: r.label, description: managementUi(r.key).description, group: `Logística · ${managementUi(r.key).group}`, icon: managementUi(r.key).icon })),
  ];

  return (
    <div className="shell" data-theme={current.theme} data-color-mode={mode}>
      <a className="skip-link" href="#main-content">{translate("Saltar al contenido")}</a>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <img
              src={mode === "light" ? "/LogoClaro.png" : "/zenda-logo-dark.png"}
              alt={""}
            />
          </span>
          <span className="brand-name">
            Zenda
            <small>Control</small>
          </span>
        </div>

        <p className="sidebar-kicker">
          <span className="sidebar-corridor">{translate("Corredor Interoceánico · Línea Z")}</span>
          <span className="sidebar-greca" aria-hidden="true" />
        </p>

        <nav className="nav" aria-label={translate("Navegación principal")}>
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `nav-link${isActive && (item.to !== '/gestion' || location.pathname !== '/gestion/users') ? " is-active" : ""}`
              }
              data-nav-theme={item.theme}
            >
              <span className="nav-glyph" aria-hidden="true">
                <item.icon size={20} strokeWidth={2} />
              </span>
              <span className="nav-copy">
                <strong>{translate(item.label)}</strong>
                <small>{translate(item.domain)}</small>
              </span>
            </NavLink>
          ))}
        </nav>

        <footer className="sidebar-foot">
          <span className="mini-glyph" aria-hidden="true">
            ◆
          </span>{translate("Telemetría ferroviaria")}<AccessibilityPanel /></footer>
      </aside>

      <div className="main">
        <header className="topbar" ref={topbarRef}>
          <AztecOrnament kind="feathers" />
          <div className="topbar-content">
            <div className="topbar-context">
              <ConnectionIndicator />
              <span className="context-divider" aria-hidden="true" />
              <span className="section-context">
                <strong>{translate(current.deity)}</strong>
                <small>{translate(current.domain)}</small>
              </span>
            </div>

            <div className="topbar-right">
              <NavigationSearch entries={entries} loading={resources.loading} error={resources.error?.userMessage} retry={resources.reload} />
              {user ? (
                <>
                  <span className="person-avatar" aria-hidden="true"><UserRound size={18} /></span>
                  <span className="user">
                    {translate(user.email)}
                    <small>{translate(userRoleLabel(user.role))}</small>
                  </span>
                  <div className="account-actions">
                    <button
                      type="button"
                      className="icon-action"
                      onClick={toggle}
                      aria-label={translate(mode === "light" ? "Activar modo oscuro" : "Activar modo claro")}
                      title={translate(mode === "light" ? "Activar modo oscuro" : "Activar modo claro")}
                    >
                      {mode === "light" ? <Moon size={18} /> : <Sun size={18} />}
                    </button>
                    <button
                      type="button"
                      className="icon-action"
                      onClick={() => setPreferences({ language: preferences.language === 'es' ? 'en' : 'es' })}
                      aria-label={preferences.language === 'es' ? 'Switch to English' : 'Cambiar a español'}
                      title={preferences.language === 'es' ? 'Switch to English' : 'Cambiar a español'}
                    ><Languages size={18} /></button>
                    <button
                      type="button"
                      className="icon-action signout-action"
                      onClick={signOut}
                      aria-label={translate("Cerrar sesión")}
                      title={translate("Cerrar sesión")}
                    >
                      <DoorOpen size={18} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="icon-action"
                    onClick={toggle}
                    aria-label={translate(mode === "light" ? "Activar modo oscuro" : "Activar modo claro")}
                    title={translate(mode === "light" ? "Activar modo oscuro" : "Activar modo claro")}
                  >
                    {mode === "light" ? <Moon size={18} /> : <Sun size={18} />}
                  </button>
                  <NavLink to="/login" className="btn btn-primary">{translate("Iniciar sesión")}</NavLink>
                </>
              )}
            </div>
          </div>
          <AztecOrnament kind="serpent" />
        </header>

        <main className="content" id="main-content" tabIndex={-1}>
          {location.pathname === "/historial-nodos" && <nav className="breadcrumbs" aria-label={translate("Migajas de pan")}><Link to="/"><span aria-hidden="true">⌂</span>{translate(" Inicio")}</Link><span aria-hidden="true">›</span><span aria-current="page">{translate("Historial de nodos")}</span></nav>}
          <Outlet context={{ resources }} />
        </main>
      </div>
    </div>
  );
}
