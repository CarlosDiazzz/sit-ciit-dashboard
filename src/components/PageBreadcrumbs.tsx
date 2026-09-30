import { t as translate } from '../accessibility/i18n';
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
    <nav className="page-breadcrumbs" aria-label={translate("Migajas de pan")}>
      <Link to={home}>{translate("Inicio")}</Link>
      <span aria-hidden="true">/</span>
      {management && <><Link to="/gestion">{translate("Gestión logística")}</Link><span aria-hidden="true">/</span></>}
      <span aria-current="page">{translate(current)}</span>
    </nav>
  );
}
