/* Paleta de las gráficas.
 *
 * Los slots categóricos (azul / naranja / verde) pasan contraste y
 * discriminación por daltonismo tanto en claro como en oscuro. Se usan
 * para series que son categorías entre sí — los ejes x/y/z de un vector.
 *
 * Una magnitud derivada de esas series (|a| respecto de x/y/z) NO es una
 * cuarta categoría: se pinta con tinta neutra para no sugerir que es del
 * mismo tipo que las otras tres.
 *
 * El resto de la interfaz usa los tokens de index.css; estos valores
 * existen aparte porque Recharts necesita colores resueltos, no
 * variables CSS.
 */

export interface ChartPalette {
  surface: string;
  textPrimary: string;
  textSecondary: string;
  muted: string;
  grid: string;
  axis: string;
  seriesX: string;
  seriesY: string;
  seriesZ: string;
  /** Velocidad (gps.speedMs). Vive en su propia gráfica (otra unidad,
   *  otro eje, nunca junto a x/y/z) — violeta deliberadamente distinto
   *  de blue/orange/green para que no lea como parte de ese grupo (antes
   *  reusaba seriesX, que sí sugiere esa relación sin ser cierta). */
  seriesSpeed: string;
  /** Temperatura y humedad ambiental (clima, no sensores del celular).
   *  Slot propio (ámbar/violeta), validado con scripts/validate_palette.js
   *  del skill de dataviz — no reusa x/y/z/speed para no sugerir que es
   *  el mismo tipo de dato. */
  seriesTemp: string;
  seriesHumidity: string;
}

/* Alineados con los tokens de superficie y texto de index.css. */
const DARK: ChartPalette = {
  surface: '#121715',
  textPrimary: '#f5f0e4',
  textSecondary: '#d4d0c5',
  muted: '#918f86',
  grid: '#29332f',
  axis: '#3b4943',
  seriesX: '#d55f5c',
  seriesY: '#f39a48',
  seriesZ: '#55bde9',
  seriesSpeed: '#49c79c',
  seriesTemp: '#a8842a',
  seriesHumidity: '#7a63c9',
};

const LIGHT: ChartPalette = {
  surface: '#fcfcfb',
  textPrimary: '#0b0b0b',
  textSecondary: '#52514e',
  muted: '#898781',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  seriesX: '#2a78d6',
  seriesY: '#eb6834',
  seriesZ: '#1baf7a',
  seriesSpeed: '#4a3aa7',
  seriesTemp: '#a8791b',
  seriesHumidity: '#6a4fc4',
};

/** La interfaz es oscura por defecto (ver index.css). Cuando se agregue
 *  el cambio de tema, esta función leerá el tema activo en vez de la
 *  preferencia del sistema. */
export function chartPalette(dark = true): ChartPalette {
  return dark ? DARK : LIGHT;
}
