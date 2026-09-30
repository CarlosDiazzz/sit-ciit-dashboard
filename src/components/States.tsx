import { t as translate } from '../accessibility/i18n';
/* Estados de carga, error y vacío.
 *
 * Son componentes de primera clase, no un detalle: mientras el backend no
 * exista es lo único que se ve, y el proyecto prohíbe rellenar la
 * pantalla con datos inventados cuando no hay respuesta.
 */

import type { ReactNode } from 'react';
import type { ApiError } from '../api/client';
import './states.css';
import StatusTrain from './StatusTrain';

export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="state state-loading" role="status" aria-live="polite" aria-busy="true">
      <span className="state-eyebrow">{translate("SINCRONIZANDO INFORMACIÓN")}</span><StatusTrain />
      <p className="state-title">{translate(label)}</p><p className="state-text">{translate("Estamos consultando los datos de la operación.")}</p><span className="state-progress" aria-hidden="true" />
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
    <div className="state state-error" role="alert"><span className="state-eyebrow">{translate("INFORMACIÓN NO DISPONIBLE")}</span>
      <p className="state-title">{translate("No se pudieron cargar los datos")}</p>
      <p className="state-text">{translate(error.kind === 'network' ? 'No pudimos conectar con el servidor. Comprueba tu conexión y vuelve a intentarlo.' : error.userMessage)}</p><p className="state-guidance">{translate("No es posible evaluar el estado de la operación con esta consulta.")}</p>
      {error.status ? <p className="state-detail mono">{translate("HTTP ")}{error.status}</p> : null}
      {onRetry ? (
        <button type="button" className="btn state-retry" onClick={onRetry}>{translate("Reintentar")}</button>
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
      <p className="state-title">{translate(title)}</p>
      {hint ? <p className="state-text">{translate(hint)}</p> : null}
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
  if (state.loading) return <Loading />;
  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} />;
  if (state.data === null || (Array.isArray(state.data) && state.data.length === 0)) {
    return <EmptyState title={translate(empty.title)} hint={empty.hint} />;
  }
  return <>{translate(children(state.data))}</>;
}
