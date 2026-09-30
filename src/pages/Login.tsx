/* Inicio de sesión contra POST /auth/login.
 *
 * El formulario ya llama al backend real: mientras el endpoint no exista
 * mostrará el error de conexión, que es justo lo que debe verse.
 */

import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ApiError, api } from '../api/client';
import { useSession } from '../auth/context';
import { useColorMode } from '../hooks/useColorMode';
import './login.css';

export default function Login() {
  const { user, signIn } = useSession();
  const { mode, toggle } = useColorMode();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const canSubmit = /\S+@\S+\.\S+/.test(email.trim()) && password.length > 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || enviando) return;
    setError(null);
    setEnviando(true);
    try {
      const { token, user: authUser } = await api.login(email, password);
      signIn(authUser, token);
      navigate(['cliente','technician'].includes(authUser.role)?'/gestion':'/');
    } catch (err) {
      setError(
        err instanceof ApiError ? err.userMessage : 'No se pudo iniciar sesión.',
      );
    } finally {
      setEnviando(false);
    }
  }

  if (user) {
    return <Navigate to={["cliente", "technician"].includes(user.role) ? "/gestion" : "/"} replace />;
  }

  return (
    <div className="login" data-color-mode={mode}>
      <button
        type="button"
        className="login-mode-toggle"
        onClick={toggle}
        aria-label={mode === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
      >
        <span aria-hidden="true">{mode === 'dark' ? '☀' : '☾'}</span>
        {mode === 'dark' ? 'Modo claro' : 'Modo oscuro'}
      </button>
      <form className="login-card" onSubmit={onSubmit}>
        <h1>Iniciar sesión</h1>
        <p className="login-hint">
          Usa la cuenta que te asignó el administrador.
        </p>

        <label className="field">
          <span>Correo</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
        </label>

        <label className="field">
          <span>Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>

        {error ? (
          <p className="login-error" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" className="btn btn-primary" disabled={!canSubmit || enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
