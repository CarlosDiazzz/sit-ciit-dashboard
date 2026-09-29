/* Inicio de sesión contra POST /auth/login.
 *
 * El formulario ya llama al backend real: mientras el endpoint no exista
 * mostrará el error de conexión, que es justo lo que debe verse.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, api } from '../api/client';
import { useSession } from '../auth/context';
import './login.css';

export default function Login() {
  const { user, signIn, signOut } = useSession();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const { token, user: authUser } = await api.login(email, password);
      signIn(authUser, token);
      navigate('/');
    } catch (err) {
      setError(
        err instanceof ApiError ? err.userMessage : 'No se pudo iniciar sesión.',
      );
    } finally {
      setEnviando(false);
    }
  }

  if (user) {
    return (
      <div className="login">
        <div className="login-card">
          <h1>Sesión iniciada</h1>
          <p className="login-hint">
            {user.email} — {user.role === 'control_center' ? 'Centro de control' : 'Operador'}
          </p>
          <button type="button" className="btn" onClick={signOut}>
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={onSubmit}>
        <h1>Iniciar sesión</h1>
        <p className="login-hint">
          Los usuarios se dan de alta desde el backend con <code>npm run create-user</code>.
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

        <button type="submit" className="btn btn-primary" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
