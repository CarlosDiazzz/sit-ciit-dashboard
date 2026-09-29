import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';

import Mapa from './pages/Mapa';
import Unidad from './pages/Unidad';
import Eventos from './pages/Eventos';
import Comandos from './pages/Comandos';
import Bitacora from './pages/Bitacora';
import Login from './pages/Login';

// Navegación mínima de andamiaje. Ocultar rutas según el rol del usuario
// se implementa junto con el login real (Fase 6).
function Nav() {
  return (
    <nav>
      <Link to="/">Mapa</Link>
      <Link to="/unidad">Unidad</Link>
      <Link to="/eventos">Eventos</Link>
      <Link to="/comandos">Comandos</Link>
      <Link to="/bitacora">Bitácora</Link>
      <Link to="/login">Login</Link>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/" element={<Mapa />} />
        <Route path="/unidad" element={<Unidad />} />
        <Route path="/eventos" element={<Eventos />} />
        <Route path="/comandos" element={<Comandos />} />
        <Route path="/bitacora" element={<Bitacora />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </BrowserRouter>
  );
}
