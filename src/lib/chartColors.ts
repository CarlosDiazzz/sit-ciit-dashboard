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
}

/* Alineados con los tokens de superficie y texto de index.css. */
const DARK: ChartPalette = {
  surface: '#161b22',
  textPrimary: '#f0f6fc',
  textSecondary: '#c9d1d9',
  muted: '#8b949e',
  grid: '#2a313c',
  axis: '#3a434f',
  seriesX: '#3987e5',
  seriesY: '#d95926',
  seriesZ: '#199e70',
  seriesSpeed: '#9085e9',
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
};

/** La interfaz es oscura por defecto (ver index.css). Cuando se agregue
 *  el cambio de tema, esta función leerá el tema activo en vez de la
 *  preferencia del sistema. */
export function chartPalette(dark = true): ChartPalette {
  return dark ? DARK : LIGHT;
}
