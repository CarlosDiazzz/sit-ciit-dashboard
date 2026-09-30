import { BrowserRouter, Route, Routes } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';

import Layout from './components/Layout';
import { Loading } from './components/States';
import { SessionProvider } from './auth/session';
import Mapa from './pages/Mapa';
import Unidad from './pages/Unidad';
import Eventos from './pages/Eventos';
import Comandos from './pages/Comandos';
import Bitacora from './pages/Bitacora';
import Login from './pages/Login';

export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          {/* Todas las vistas comparten el armazón (barra lateral +
              encabezado); el login también, para poder volver atrás. */}
          <Route element={<Layout />}>
            <Route path="/" element={<Mapa />} />
            <Route path="/unidad" element={<Unidad />} />
            <Route path="/eventos" element={<Eventos />} />
            {import.meta.env.DEV && <Route path="/eventos/prueba-carga" element={<><div className="page-head"><div><h1>Prueba de carga</h1><p>Vista de prueba · La animación permanece activa hasta salir.</p></div></div><Loading label="Cargando eventos…" /></>} />}
            <Route path="/comandos" element={<Comandos />} />
            <Route path="/bitacora" element={<Bitacora />} />
            <Route path="/login" element={<Login />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  );
}
