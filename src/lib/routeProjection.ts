/* Proyección de un punto sobre la polilínea real de la Línea Z y
 * avance a lo largo de ella — sin librería de geometría nueva (no hay
 * turf/geolib en package.json y no hace falta para una ruta de este
 * tamaño). Reusa distanceMeters() de mapData.ts, misma aproximación
 * plana ya establecida ahí.
 *
 * Sirve para dos cosas, ambas sin ML, puro distancia/velocidad:
 * - estimar dónde va un nodo mientras está sin señal (posicionEstimada
 *   en LiveMapLayers.tsx), a partir de su última velocidad real.
 * - calcular el ETA real a la próxima zona de cobertura conocida
 *   (OpenCelliD), como distancia restante / esa misma velocidad real.
 */

import { distanceMeters, type MapCoordinate } from './mapData';

/** Distancia acumulada en cada vértice de la ruta, empezando en 0. */
export function distanciasAcumuladas(ruta: MapCoordinate[]): number[] {
  const acumuladas: number[] = [0];
  for (let i = 1; i < ruta.length; i++) {
    acumuladas.push(acumuladas[i - 1]! + distanceMeters(ruta[i - 1]!, ruta[i]!));
  }
  return acumuladas;
}

export interface ProyeccionRuta {
  /** Distancia acumulada sobre la ruta hasta el punto proyectado. */
  distanciaAcumulada: number;
  /** Qué tan lejos (m) está el punto real del punto sobre la ruta —
   *  para saber si la proyección es razonable o el punto está muy
   *  lejos de la vía como para confiar en ella. */
  distanciaALaRuta: number;
}

/** Punto más cercano de la polilínea a un lat/lon dado, como distancia
 *  acumulada sobre la ruta. Proyecta sobre cada segmento (no solo sobre
 *  los vértices) para no perder precisión en tramos largos. */
export function proyectarSobreRuta(
  ruta: MapCoordinate[],
  punto: MapCoordinate,
  acumuladas = distanciasAcumuladas(ruta),
): ProyeccionRuta | null {
  if (ruta.length < 2) return null;

  let mejor: ProyeccionRuta | null = null;
  for (let i = 0; i < ruta.length - 1; i++) {
    const a = ruta[i]!;
    const b = ruta[i + 1]!;
    // Proyección plana local (igual aproximación que distanceMeters):
    // convierte a metros relativos a `a` para poder usar producto punto.
    const escalaLon = Math.cos(((a[0] + b[0]) / 2 * Math.PI) / 180);
    const ax = 0;
    const ay = 0;
    const bx = (b[1] - a[1]) * 111_320 * escalaLon;
    const by = (b[0] - a[0]) * 111_320;
    const px = (punto[1] - a[1]) * 111_320 * escalaLon;
    const py = (punto[0] - a[0]) * 111_320;

    const largoSegmento2 = (bx - ax) ** 2 + (by - ay) ** 2;
    const t = largoSegmento2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / largoSegmento2));
    const proyX = ax + t * (bx - ax);
    const proyY = ay + t * (by - ay);
    const distanciaALaRuta = Math.hypot(px - proyX, py - proyY);
    const distanciaAcumulada = acumuladas[i]! + t * distanceMeters(a, b);

    if (!mejor || distanciaALaRuta < mejor.distanciaALaRuta) {
      mejor = { distanciaAcumulada, distanciaALaRuta };
    }
  }
  return mejor;
}

/** Inverso de proyectarSobreRuta: de una distancia acumulada a un
 *  lat/lon real sobre la ruta. Recorta a los extremos si se pasa. */
export function puntoADistancia(
  ruta: MapCoordinate[],
  distanciaObjetivo: number,
  acumuladas = distanciasAcumuladas(ruta),
): MapCoordinate | null {
  if (ruta.length === 0) return null;
  const total = acumuladas[acumuladas.length - 1]!;
  const distancia = Math.max(0, Math.min(total, distanciaObjetivo));

  for (let i = 1; i < acumuladas.length; i++) {
    if (distancia <= acumuladas[i]!) {
      const desdeInicioSegmento = distancia - acumuladas[i - 1]!;
      const largoSegmento = acumuladas[i]! - acumuladas[i - 1]!;
      const t = largoSegmento === 0 ? 0 : desdeInicioSegmento / largoSegmento;
      const a = ruta[i - 1]!;
      const b = ruta[i]!;
      return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
    }
  }
  return ruta[ruta.length - 1]!;
}

/** Puntos muestreados sobre la ruta cada `pasoM` metros — lo que manda
 *  el dashboard a GET /coverage/towers en vez de que el backend tenga
 *  que conocer la geometría real de la vía. */
export function muestrearRuta(ruta: MapCoordinate[], pasoM: number): MapCoordinate[] {
  if (ruta.length === 0) return [];
  const acumuladas = distanciasAcumuladas(ruta);
  const total = acumuladas[acumuladas.length - 1]!;
  const puntos: MapCoordinate[] = [];
  for (let d = 0; d <= total; d += pasoM) {
    const p = puntoADistancia(ruta, d, acumuladas);
    if (p) puntos.push(p);
  }
  return puntos;
}
