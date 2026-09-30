/* Guard de rutas: sin sesión no se ve nada del centro de control, y un
 * rol `cliente` no entra a las pantallas operativas (su portal real vive
 * en otro repo, si-ciit-landing) — la autorización fina de cada acción
 * sigue viviendo en el backend (esto solo evita mostrar una pantalla que
 * de todos modos va a rechazar cada petición).
 */

import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from '../auth/context';
import { userRoleLabel } from '../lib/labels';

export default function RequireAuth() {
  const { user } = useSession();

  if (!user) return <Navigate to="/login" replace />;

  if (user.role === 'cliente') {
    return (
      <div className="page-head">
        <div>
          <h1>Acceso restringido</h1>
          <p>
            Tu cuenta es de {userRoleLabel('cliente')}. Este centro de control es para
            personal del corredor (centro de control y operadores) — tu vista de
            seguimiento vive en otro portal.
          </p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
