/* Contexto y hook de sesión, separados del provider para no romper el
 * fast refresh de Vite (un archivo con componentes no debe exportar
 * también hooks). */

import { createContext, useContext } from 'react';
import type { AuthUser } from '../api/types';
import type { CmdAction } from '../contract/contract';

export interface SessionValue {
  user: AuthUser | null;
  signIn: (user: AuthUser, token: string) => void;
  signOut: () => void;
  /** Si el rol de la sesión puede emitir esta acción. */
  can: (action: CmdAction) => boolean;
}

export const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSession debe usarse dentro de <SessionProvider>');
  }
  return value;
}
