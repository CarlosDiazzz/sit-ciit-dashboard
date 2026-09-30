import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "leaflet/dist/leaflet.css";

import Layout from "./components/Layout";
import RequireAuth from "./components/RequireAuth";
import { Loading } from "./components/States";
import { SessionProvider } from "./auth/session";
import Mapa from "./pages/Mapa";
import Unidad from "./pages/Unidad";
import Conectividad from "./pages/Conectividad";
import Eventos from "./pages/Eventos";
import Comandos from "./pages/Comandos";
import Bitacora from "./pages/Bitacora";
import Login from "./pages/Login";
import Avisos from "./pages/Avisos";
import Gestion from "./pages/Gestion";
import Auditoria from "./pages/Auditoria";
import Nodos from "./pages/Nodos";

const PreviewLoadingError = import.meta.env.DEV
  ? lazy(() => import("./pages/PreviewLoadingError"))
  : null;
const PreviewDss = import.meta.env.DEV
  ? lazy(() => import("./pages/PreviewDss"))
  : null;

function GestionUsuarios() {
  return <Navigate to="/gestion/users" replace />;
}

export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          {/* Todas las vistas comparten el armazón (barra lateral +
              encabezado); el login también, para poder volver atrás. */}
          <Route element={<Layout />}>
            <Route path="/login" element={<Login />} />

            {/* Sin sesión → a /login. Con sesión de cliente → mensaje de
                acceso restringido, no las pantallas operativas. */}
            <Route element={<RequireAuth />}>
              <Route path="/" element={<Mapa />} />
              <Route path="/conectividad" element={<Conectividad />} />
              <Route path="/unidad" element={<Unidad />} />
              <Route path="/eventos" element={<Eventos />} />
              {PreviewDss && (
                <Route
                  path="/eventos/vista-previa"
                  element={
                    <Suspense fallback={<Loading />}>
                      <PreviewDss />
                    </Suspense>
                  }
                />
              )}
              {PreviewLoadingError && (
                <Route
                  path="/eventos/prueba-carga"
                  element={
                    <Suspense fallback={<Loading />}>
                      <PreviewLoadingError />
                    </Suspense>
                  }
                />
              )}
              <Route path="/comandos" element={<Comandos />} />
              <Route path="/bitacora" element={<Bitacora />} />
              {/* Usuarios ya se autolimita a control_center adentro. */}
              <Route path="/usuarios" element={<GestionUsuarios />} />
              <Route path="/nodos" element={<Nodos />} />
              <Route path="/gestion" element={<Gestion />} />
              <Route path="/gestion/:resource" element={<Gestion />} />
              <Route path="/auditoria" element={<Auditoria />} />
              <Route path="/avisos" element={<Avisos />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  );
}
