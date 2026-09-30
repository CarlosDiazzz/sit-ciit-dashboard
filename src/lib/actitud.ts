/* Actitud del contenedor a partir de la telemetria.
 *
 * Vive fuera del componente para no romper el fast refresh de Vite: un
 * archivo que exporta componentes no debe exportar tambien funciones.
 */

import type { TelemetryBroadcast } from '../api/types';

export interface Actitud {
  /** Alabeo: inclinación lateral, en grados. Positivo a la derecha. */
  alabeo: number;
  /** Cabeceo: morro arriba o abajo, en grados. */
  cabeceo: number;
  /** Magnitud de la velocidad angular, en rad/s. */
  rotacion: number | null;
}

/**
 * Calcula la actitud a partir de la última telemetría.
 *
 * Con el dispositivo plano, la gravedad cae toda sobre el eje Z. Lo que
 * aparece en X e Y es lo que se inclinó, y de ahí salen los ángulos.
 */
export function actitudDesde(t: TelemetryBroadcast | undefined): Actitud | null {
  if (!t?.accel) return null;
  const { x, y, z } = t.accel;

  const alabeo = (Math.atan2(x, Math.sqrt(y * y + z * z)) * 180) / Math.PI;
  const cabeceo = (Math.atan2(y, Math.sqrt(x * x + z * z)) * 180) / Math.PI;

  const g = t.gyro;
  const rotacion = g ? Math.sqrt(g.x * g.x + g.y * g.y + g.z * g.z) : null;

  return { alabeo, cabeceo, rotacion };
}
