/* Guard de rutas: sin sesión no se ve nada del centro de control, y un
 * rol `cliente` no entra a las pantallas operativas (su portal real vive
 * en otro repo, si-ciit-landing) — la autorización fina de cada acción
 * sigue viviendo en el backend (esto solo evita mostrar una pantalla que
 * de todos modos va a rechazar cada petición).
 */

import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSession } from "../auth/context";

export default function RequireAuth() {
  const { user } = useSession();
  const { pathname } = useLocation();

  if (!user) return <Navigate to="/login" replace />;

  if (
    user.role === "cliente" &&
    !pathname.startsWith("/gestion") &&
    pathname !== "/avisos"
  )
    return <Navigate to="/gestion" replace />;
  return <Outlet />;
}
