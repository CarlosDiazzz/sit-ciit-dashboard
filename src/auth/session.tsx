/* Sesión del usuario y permisos por rol.
 *
 * La autoridad real la impone el backend antes de publicar en MQTT (y el
 * nodo revalida). Aquí solo se oculta lo que el rol no puede hacer, para
 * no ofrecer botones que van a ser rechazados.
 *
 * El contexto y el hook viven en context.ts; este archivo solo exporta el
 * componente proveedor.
 */

import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { setToken } from "../api/client";
import { closeSocket } from "../api/socket";
import type { AuthUser } from "../api/types";
import { isActionAllowedForRole, type CmdAction } from "../contract/contract";
import { SessionContext } from "./context";

const USER_KEY = "sitciit.user";

function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    // Almacenamiento bloqueado o JSON corrupto: se arranca sin sesión.
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readStoredUser);

  const signIn = useCallback((nextUser: AuthUser, token: string) => {
    closeSocket();
    setToken(token);
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    } catch {
      // La sesión vive en memoria si no se puede persistir.
    }
    setUser(nextUser);
  }, []);

  const signOut = useCallback(() => {
    setToken(null);
    try {
      localStorage.removeItem(USER_KEY);
    } catch {
      // Ignorado: ver signIn.
    }
    // El socket se autentica con el token; hay que cerrarlo para que no
    // siga recibiendo datos con una sesión que ya terminó.
    closeSocket();
    setUser(null);
  }, []);

  const can = useCallback(
    (action: CmdAction) => {
      if (!user || !["admin", "control_center", "operator"].includes(user.role))
        return false;
      // Descartado 'cliente' arriba: user.role solo puede ser
      // control_center|operator aquí, que es lo que pide IssuerRole.
      return isActionAllowedForRole(
        action,
        user.role === "admin"
          ? "control_center"
          : (user.role as "control_center" | "operator"),
      );
    },
    [user],
  );

  const value = useMemo(
    () => ({ user, signIn, signOut, can }),
    [user, signIn, signOut, can],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}
