/* Estados de carga, error y vacío.
 *
 * Son componentes de primera clase, no un detalle: mientras el backend no
 * exista es lo único que se ve, y el proyecto prohíbe rellenar la
 * pantalla con datos inventados cuando no hay respuesta.
 */

import type { ReactNode } from 'react';
import type { ApiError } from '../api/client';
import './states.css';

export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <span className="state-spinner" aria-hidden="true" />
      <p className="state-text">{label}</p>
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: ApiError;
  onRetry?: () => void;
}) {
  return (
    <div className="state state-error" role="alert">
      <p className="state-title">No se pudieron cargar los datos</p>
      <p className="state-text">{error.userMessage}</p>
      {error.status ? <p className="state-detail mono">HTTP {error.status}</p> : null}
      {onRetry ? (
        <button type="button" className="btn" onClick={onRetry}>
          Reintentar
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
}: {
  title: string;
  hint?: ReactNode;
}) {
  return (
    <div className="state">
      <p className="state-title">{title}</p>
      {hint ? <p className="state-text">{hint}</p> : null}
    </div>
  );
}

/** Elige qué mostrar según el estado de una carga. Centraliza el orden
 *  correcto (error antes que vacío) para no repetirlo en cada vista. */
export function AsyncBoundary<T>({
  state,
  empty,
  children,
}: {
  state: { data: T | null; loading: boolean; error: ApiError | null; reload: () => void };
  empty: { title: string; hint?: ReactNode };
  children: (data: T) => ReactNode;
}) {
  if (state.loading && state.data === null) return <Loading />;
  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} />;
  if (state.data === null || (Array.isArray(state.data) && state.data.length === 0)) {
    return <EmptyState title={empty.title} hint={empty.hint} />;
  }
  return <>{children(state.data)}</>;
}
