import { t as translate } from '../accessibility/i18n';
/* CRUD de usuarios — solo control_center. La autoridad real la impone el
 * backend (todas las rutas exigen ese rol); aquí solo se oculta la
 * sección para quien no lo tiene, igual que Comandos.tsx oculta acciones.
 */

import { useState } from 'react';
import { UserRound } from 'lucide-react';
import PageBreadcrumbs from '../components/PageBreadcrumbs';
import { PagedRows } from '../components/Pagination';

import { ApiError, api } from '../api/client';
import { useApi } from '../api/useApi';
import type { ManagedUser, UserRole } from '../api/types';
import { useSession } from '../auth/context';
import { AsyncBoundary } from '../components/States';
import { formatDateTime } from '../lib/format';
import { userRoleLabel } from '../lib/labels';
import './tables.css';
import './usuarios.css';

const ROLES: UserRole[] = ['control_center', 'operator', 'cliente'];

export default function Usuarios() {
  const { user } = useSession();
  const usuarios = useApi<ManagedUser[]>(() => api.listUsers(), []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('operator');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  if (user?.role !== 'control_center') {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>{translate("Usuarios")}</h1>
            <p>{translate("Esta sección es solo para el centro de control.")}</p>
          </div>
          <PageBreadcrumbs current="Usuarios" />
        </div>
      </>
    );
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAviso(null);
    setEnviando(true);
    try {
      const creado = await api.createUser({ email, password, role });
      setAviso(`Usuario ${creado.email} creado como ${userRoleLabel(creado.role)}.`);
      setEmail('');
      setPassword('');
      usuarios.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.userMessage : 'No se pudo crear el usuario.');
    } finally {
      setEnviando(false);
    }
  }

  async function cambiarRol(id: string, nuevoRol: UserRole) {
    try {
      await api.updateUser(id, { role: nuevoRol });
      usuarios.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.userMessage : 'No se pudo cambiar el rol.');
    }
  }

  async function borrar(u: ManagedUser) {
    if (!confirm(translate(`¿Borrar a ${u.email}? No se puede deshacer.`))) return;
    try {
      await api.deleteUser(u.id);
      usuarios.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.userMessage : 'No se pudo borrar el usuario.');
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{translate("Usuarios")}</h1>
          <p>{translate("Altas, roles y bajas de quien accede al centro de control.")}</p>
        </div>
        <PageBreadcrumbs current="Usuarios" />
      </div>

      <form className="user-form" onSubmit={crear}>
        <div className="user-fields">
          <label className="field">
            <span>{translate("Correo")}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="off"
            />
          </label>

          <label className="field">
            <span>{translate("Contraseña")}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              autoComplete="new-password"
            />
          </label>

          <label className="field">
            <span>{translate("Rol")}</span>
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {translate(userRoleLabel(r))}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" className="btn btn-primary" disabled={enviando}>
            {translate(enviando ? 'Creando…' : 'Crear usuario')}
          </button>
        </div>

        {error ? <p className="user-error" role="alert">{translate(error)}</p> : null}
        {aviso ? <p className="user-aviso" role="status">{translate(aviso)}</p> : null}
      </form>

      <AsyncBoundary
        state={usuarios}
        empty={{ title: 'No hay usuarios', hint: 'Crea el primero con el formulario de arriba.' }}
      >
        {(lista) => (
          <PagedRows items={lista} label={translate("Personas con acceso")}>{rows => (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{translate("Correo")}</th>
                  <th>{translate("Rol")}</th>
                  <th>{translate("Creado")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <span className="person-cell"><span className="person-avatar" aria-hidden="true"><UserRound size={18} /></span>{translate(u.email)}</span>
                      {u.id === user.id ? <span className="tag">{translate("tú")}</span> : null}
                    </td>
                    <td>
                      <select value={u.role} onChange={(e) => cambiarRol(u.id, e.target.value as UserRole)}>
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {translate(userRoleLabel(r))}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="tabular">{translate(formatDateTime(u.createdAt))}</td>
                    <td>
                      {u.id !== user.id ? (
                        <button type="button" className="btn" onClick={() => borrar(u)}>{translate("Borrar")}</button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}</PagedRows>
        )}
      </AsyncBoundary>
    </>
  );
}
