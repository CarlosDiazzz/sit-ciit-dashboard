/* Conexión Socket.IO con el backend, para telemetría y eventos en vivo.
 *
 * Hay un solo socket compartido por toda la app (no uno por vista): el
 * backend emite los mismos eventos a todas las pantallas y abrir varias
 * conexiones solo multiplica el tráfico.
 */

import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { getToken } from './client';
import type { ServerToClientEvents } from './types';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3000';

export type ConnectionStatus = 'connecting' | 'online' | 'offline';

type AppSocket = Socket<ServerToClientEvents>;

let socket: AppSocket | null = null;

export function getSocket(): AppSocket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: true,
      // Reintenta solo: el corredor tiene tramos sin cobertura y la
      // laptop del centro de control también puede perder la red.
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      auth: (cb) => cb({ token: getToken() }),
    });
  }
  return socket;
}

/** Cierra el socket; se usa al cerrar sesión para no seguir recibiendo
 *  datos con un token que ya no vale. */
export function closeSocket(): void {
  socket?.close();
  socket = null;
}

/** Estado de la conexión, para el indicador del encabezado. */
export function useConnectionStatus(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>(() =>
    getSocket().connected ? 'online' : 'connecting',
  );

  useEffect(() => {
    const s = getSocket();
    const onConnect = () => setStatus('online');
    const onDisconnect = () => setStatus('offline');
    const onError = () => setStatus('offline');

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('connect_error', onError);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('connect_error', onError);
    };
  }, []);

  return status;
}

/** Suscribe un manejador a un evento del servidor mientras el componente
 *  esté montado. */
export function useSocketEvent<K extends keyof ServerToClientEvents>(
  event: K,
  handler: ServerToClientEvents[K],
): void {
  useEffect(() => {
    const s = getSocket();
    // socket.io tipa on() de forma estricta; el cast mantiene la firma
    // pública del hook simple sin perder el tipado de ServerToClientEvents.
    s.on(event, handler as never);
    return () => {
      s.off(event, handler as never);
    };
  }, [event, handler]);
}
