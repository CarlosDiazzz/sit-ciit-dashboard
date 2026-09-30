import { Link, useLocation } from "react-router-dom";
import { useSession } from "../auth/context";

export default function PageBreadcrumbs({ current }: { current: string }) {
  const { user } = useSession();
  const location = useLocation();
  const management = location.pathname.startsWith("/gestion/");
  const home = ["cliente", "technician"].includes(user?.role ?? "")
    ? "/gestion"
    : "/";

  return (
    <nav className="page-breadcrumbs" aria-label="Migajas de pan">
      <Link to={home}>Inicio</Link>
      <span aria-hidden="true">/</span>
      {management && <><Link to="/gestion">Gestión logística</Link><span aria-hidden="true">/</span></>}
      <span aria-current="page">{current}</span>
    </nav>
  );
}
