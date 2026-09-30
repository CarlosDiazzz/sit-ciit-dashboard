/* Carga de datos con estado explícito de cargando / error / vacío.
 *
 * Las tres situaciones se modelan por separado a propósito: la regla del
 * proyecto es mostrar el estado real cuando el backend no responde, así
 * que "cargando", "falló" y "no hay nada" no pueden colapsarse en una
 * lista vacía.
 */

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from './client';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  /** Vuelve a pedir los datos; útil para el botón "Reintentar". */
  reload: () => void;
}

export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    // Evita aplicar la respuesta de una petición que quedó obsoleta
    // (cambio de unidad seleccionada, desmontaje, recarga).
    let vigente = true;

    setLoading(true);
    setError(null);

    // Límite de espera visual: una consulta bloqueada debe terminar en error.
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new ApiError('http', 'El servidor tardó demasiado en responder. Vuelve a intentarlo.')), 15000);
    });
    Promise.race([Promise.resolve().then(fetcher), timeout])
      .then((result) => {
        if (vigente) setData(result);
      })
      .catch((err: unknown) => {
        if (!vigente) return;
        setError(
          err instanceof ApiError ? err : new ApiError('http', String(err)),
        );
      })
      .finally(() => {
        clearTimeout(timeoutId);
        if (vigente) setLoading(false);
      });

    return () => {
      vigente = false;
      clearTimeout(timeoutId);
    };
    // El fetcher se recrea en cada render; las dependencias reales las
    // declara quien llama al hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, loading, error, reload };
}
