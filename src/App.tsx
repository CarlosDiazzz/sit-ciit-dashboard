import { BrowserRouter, Route, Routes } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';

import Layout from './components/Layout';
import RequireAuth from './components/RequireAuth';
import { SessionProvider } from './auth/session';
import Mapa from './pages/Mapa';
import Unidad from './pages/Unidad';
import Eventos from './pages/Eventos';
import Comandos from './pages/Comandos';
import Bitacora from './pages/Bitacora';
import Login from './pages/Login';
import Usuarios from './pages/Usuarios';
import Nodos from './pages/Nodos';

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
              <Route path="/unidad" element={<Unidad />} />
              <Route path="/eventos" element={<Eventos />} />
              <Route path="/comandos" element={<Comandos />} />
              <Route path="/bitacora" element={<Bitacora />} />
              {/* Usuarios ya se autolimita a control_center adentro. */}
              <Route path="/usuarios" element={<Usuarios />} />
              <Route path="/nodos" element={<Nodos />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  );
}
