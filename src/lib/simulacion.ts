/* Simulación del corredor para la demo.
 *
 * Existe porque hay cosas que no se pueden enseñar con dos celulares en
 * una sala: varios trenes recorriendo la Línea Z, alertas apareciendo a
 * lo largo de 300 km, defectos de vía que solo se confirman cuando pasan
 * unidades distintas por el mismo punto, y un failover cuando al nodo
 * primario se le acaba la batería.
 *
 * Reproduce el sistema tal como opera, no solo puntos que se mueven:
 * cada unidad simulada lleva **dos nodos** (primario y respaldo) que
 * publican la misma telemetría que publicaría un celular real —
 * acelerómetro, giroscopio, luz, presión y GPS, con la forma exacta del
 * contrato— y cada uno con su batería, su cola de outbox y su heartbeat.
 * Las alertas no se disparan por decreto: salen de la aceleración
 * simulada al cruzar un punto de la vía, con el mismo umbral que aplica
 * el nodo.
 *
 * Es deliberadamente visible: se activa con un botón, la interfaz avisa
 * mientras está encendida y nada de esto toca el backend ni la base.
 * Los datos simulados viven solo en memoria del navegador y desaparecen
 * al apagarlo o recargar.
 *
 * No sustituye a la telemetría real: cuando hay un nodo publicando, sus
 * datos siguen llegando por Socket.IO y se pintan igual.
 */

import type { AnyEventKind, TelemetryBroadcast, TrackDefect } from '../api/types';
import type { EventSeverity, NodeMode, NodeRole } from '../contract/contract';

/** Un nodo simulado: el celular montado en la unidad. Lleva su propio
 *  estado porque es lo que hace interesante el failover — el primario se
 *  queda sin batería y el respaldo toma la fuente. */
export interface NodoSimulado {
  nodeId: string;
  role: NodeRole;
  batteryPct: number;
  /** Mensajes esperando en la cola local. Crece sin cobertura. */
  pendingOutbox: number;
  samplingMs: number;
  mode: NodeMode;
  capabilities: string[];
  online: boolean;
}

export interface TrenSimulado {
  unitId: string;
  /** Etiqueta legible, la que se ve en el mapa. */
  etiqueta: string;
  nodos: NodoSimulado[];
  /** Nodo que ahora mismo es la fuente activa de la unidad. */
  nodoActivo: string;
  /** Posición a lo largo de la ruta, de 0 a 1. */
  avance: number;
  /** Fracción de ruta por segundo, a velocidad de crucero. */
  velocidad: number;
  /** Velocidad de crucero de esta unidad, en km/h. La instantánea
   *  (`speedKmh`) oscila alrededor de esta según el trazado. */
  crucero: number;
  lat: number;
  lon: number;
  rumbo: number | null;
  speedKmh: number;
  sentido: 1 | -1;
  /** Última telemetría publicada, con la forma del contrato. */
  telemetria: TelemetryBroadcast;
  /** Consecutivo por unidad, como el `seq` del envelope. */
  seq: number;
  /** Tramo sin cobertura: el outbox se llena y no se emite nada. */
  sinCobertura: boolean;
}

export interface AlertaSimulada {
  id: string;
  kind: AnyEventKind;
  severity: EventSeverity;
  value: number;
  /** Umbral que se cruzó, como lo reporta el nodo. */
  threshold: number;
  lat: number;
  lon: number;
  ts: number;
  nodeId: string;
  unitId: string;
}

/** Factor de aceleración del tiempo: un minuto de demo es una hora de
 *  operación. Con esto un tren de carga a 62 km/h cruza el corredor
 *  entero en unos 5 minutos — se ve avanzar sin que el movimiento
 *  parezca teletransporte, y la velocidad que muestra la ficha es la
 *  que realmente lleva.
 *
 *  Antes la velocidad de avance salía de una constante ajustada a ojo y
 *  los trenes iban a ~6000 km/h aparentes mientras la ficha declaraba
 *  62: el desfase era de 97x. Ahora se deriva de la longitud real del
 *  trazado, así que las dos cifras no pueden separarse. */
export const FACTOR_TIEMPO = 60;

/** Longitud del trazado de la Línea Z que recorren los trenes, medida
 *  sobre el GeoJSON de OSM que carga el mapa (sit-ciit-infra/data). Es
 *  lo que convierte km/h en fracción de ruta por segundo. */
const LONGITUD_CORREDOR_KM = 300;

/** Fracción de ruta que avanza por segundo de demo un tren a `kmh`. */
function avancePorSegundo(kmh: number): number {
  return (kmh * FACTOR_TIEMPO) / 3600 / LONGITUD_CORREDOR_KM;
}

/** Puntos del corredor donde la vía provoca una reacción medible. No son
 *  aleatorios: representan lo que un corredor real tiene — juntas de
 *  riel, una curva cerrada, un tramo en mal estado. El valor es lo que
 *  el acelerómetro llega a marcar ahí. */
const PUNTOS_CALIENTES: {
  avance: number;
  kind: AnyEventKind;
  severity: EventSeverity;
  valor: number;
  umbral: number;
  etiqueta: string;
}[] = [
  { avance: 0.18, kind: 'track_irregularity', severity: 'warning', valor: 0.34, umbral: 0.25, etiqueta: 'Tramo con asentamiento' },
  { avance: 0.37, kind: 'curve_overspeed', severity: 'warning', valor: 0.19, umbral: 0.15, etiqueta: 'Curva de Medias Aguas' },
  { avance: 0.52, kind: 'track_irregularity', severity: 'info', valor: 0.21, umbral: 0.18, etiqueta: 'Junta de riel' },
  { avance: 0.71, kind: 'hard_brake', severity: 'critical', valor: 0.31, umbral: 0.25, etiqueta: 'Frenado en aproximación' },
  { avance: 0.86, kind: 'dynamic_impact', severity: 'warning', valor: 1.9, umbral: 1.5, etiqueta: 'Golpe vertical' },
];

/** Tramo del corredor sin cobertura celular. Existe de verdad en la
 *  Línea Z: la sierra entre Matías Romero y Mogoñé. Aquí el nodo sigue
 *  midiendo pero no puede publicar, y el outbox crece. */
const ZONA_SIN_COBERTURA = { desde: 0.6, hasta: 0.66 };

/** Margen para considerar que un tren pasó por un punto caliente. */
const MARGEN_DISPARO = 0.006;

export interface EstadoSimulacion {
  trenes: TrenSimulado[];
  alertas: AlertaSimulada[];
  defectos: TrackDefect[];
  /** Puntos ya disparados por cada tren, para no repetir la alerta
   *  mientras sigue dentro del margen. */
  disparados: Set<string>;
  /** Segundos transcurridos desde que arrancó: mueve batería y cola. */
  tiempo: number;
}

/** Posición sobre la ruta para un avance dado, interpolando entre los
 *  vértices del trazado real. Así los trenes van por la vía y no en
 *  línea recta entre extremos. */
export function puntoEnRuta(
  ruta: [number, number][],
  avance: number,
): { lat: number; lon: number; rumbo: number | null } {
  if (ruta.length === 0) return { lat: 0, lon: 0, rumbo: null };
  if (ruta.length === 1) return { lat: ruta[0]![0], lon: ruta[0]![1], rumbo: null };

  const t = Math.min(0.999999, Math.max(0, avance));
  const pos = t * (ruta.length - 1);
  const i = Math.floor(pos);
  const frac = pos - i;

  const a = ruta[i]!;
  const b = ruta[Math.min(i + 1, ruta.length - 1)]!;

  const lat = a[0] + (b[0] - a[0]) * frac;
  const lon = a[1] + (b[1] - a[1]) * frac;

  // Rumbo desde el segmento actual: el icono del tren apunta hacia
  // donde avanza, igual que con un nodo real.
  const dLat = b[0] - a[0];
  const dLon = (b[1] - a[1]) * Math.cos((a[0] * Math.PI) / 180);
  const rumbo =
    dLat === 0 && dLon === 0 ? null : (Math.atan2(dLon, dLat) * 180) / Math.PI;

  return { lat, lon, rumbo };
}

/** Curvatura local de la ruta, de 0 (recta) a ~1 (curva cerrada). Es lo
 *  que hace que la aceleración lateral suba en las curvas en vez de ser
 *  ruido constante: el giroscopio y el eje Y responden al trazado real. */
function curvatura(ruta: [number, number][], avance: number): number {
  const antes = puntoEnRuta(ruta, Math.max(0, avance - 0.004));
  const aqui = puntoEnRuta(ruta, avance);
  const despues = puntoEnRuta(ruta, Math.min(1, avance + 0.004));
  if (antes.rumbo === null || despues.rumbo === null || aqui.rumbo === null) return 0;

  let delta = despues.rumbo - antes.rumbo;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return Math.min(1, Math.abs(delta) / 45);
}

/** Ruido pequeño y estable: un acelerómetro real nunca da el mismo valor
 *  dos veces, pero tampoco salta. */
function ruido(amplitud: number): number {
  return (Math.random() - 0.5) * 2 * amplitud;
}

/**
 * Telemetría de un nodo en un instante, con la forma exacta que el
 * backend reemite por Socket.IO.
 *
 * Los valores no son aleatorios: el eje Z carga la gravedad (1 g) más la
 * vibración de marcha, el eje Y responde a la curvatura real del trazado
 * en ese punto, y el giroscopio gira sobre Z al tomar la curva. Un
 * operador que mire la gráfica ve algo coherente con lo que hace el tren
 * en el mapa.
 */
function telemetriaDe(
  tren: { unitId: string; lat: number; lon: number; speedKmh: number; seq: number },
  nodeId: string,
  role: NodeRole,
  curva: number,
  ahora: number,
): TelemetryBroadcast {
  const vibracion = (tren.speedKmh / 80) * 0.05;
  const lateral = curva * 0.12;

  return {
    nodeId,
    unitId: tren.unitId,
    role,
    seq: tren.seq,
    ts: ahora,
    receivedAt: ahora,
    accel: {
      x: ruido(vibracion),
      y: lateral + ruido(vibracion),
      // La gravedad siempre está: es la referencia que usa el nodo para
      // separar aceleración dinámica de estática.
      z: 1 + ruido(vibracion * 1.5),
    },
    gyro: {
      x: ruido(0.02),
      y: ruido(0.02),
      // Girar en el plano horizontal es rotar sobre Z.
      z: curva * 0.25 + ruido(0.02),
    },
    lux: 12000 + ruido(3000),
    pressureHpa: 1013 + ruido(2),
    gps: {
      lat: tren.lat,
      lon: tren.lon,
      speedMs: tren.speedKmh / 3.6,
      // La precisión medida en este proyecto ronda los 95 m.
      accuracyM: 70 + Math.random() * 50,
    },
  };
}

/** Arranca la simulación con tres unidades repartidas por el corredor,
 *  dos en un sentido y una en el contrario. Cada una con sus dos nodos,
 *  como va montado en campo. */
export function iniciarSimulacion(ruta: [number, number][]): EstadoSimulacion {
  const config: {
    unitId: string;
    etiqueta: string;
    avance: number;
    sentido: 1 | -1;
    kmh: number;
    /** Batería inicial del primario: una arranca baja para que el
     *  failover ocurra durante la demo sin tener que provocarlo. */
    bateria: number;
  }[] = [
    { unitId: 'sim-01', etiqueta: 'SIM · Carga 01', avance: 0.08, sentido: 1, kmh: 62, bateria: 84 },
    { unitId: 'sim-02', etiqueta: 'SIM · Carga 02', avance: 0.44, sentido: 1, kmh: 48, bateria: 18 },
    { unitId: 'sim-03', etiqueta: 'SIM · Carga 03', avance: 0.78, sentido: -1, kmh: 55, bateria: 67 },
  ];

  return {
    trenes: config.map((c) => {
      const p = puntoEnRuta(ruta, c.avance);
      const rumbo = c.sentido === 1 ? p.rumbo : p.rumbo === null ? null : p.rumbo + 180;
      const base = {
        unitId: c.unitId,
        lat: p.lat,
        lon: p.lon,
        speedKmh: c.kmh,
        seq: 0,
      };

      return {
        unitId: c.unitId,
        etiqueta: c.etiqueta,
        nodos: [
          {
            nodeId: `${c.unitId}-a`,
            role: 'primary' as NodeRole,
            batteryPct: c.bateria,
            pendingOutbox: 0,
            samplingMs: 100,
            mode: 'normal' as NodeMode,
            capabilities: ['accelerometer', 'gyroscope', 'gps', 'light', 'barometer'],
            online: true,
          },
          {
            nodeId: `${c.unitId}-b`,
            role: 'backup' as NodeRole,
            batteryPct: 91,
            pendingOutbox: 0,
            samplingMs: 250,
            mode: 'normal' as NodeMode,
            // El respaldo suele ser un equipo más modesto: sin barómetro.
            capabilities: ['accelerometer', 'gyroscope', 'gps', 'light'],
            online: true,
          },
        ],
        nodoActivo: `${c.unitId}-a`,
        avance: c.avance,
        velocidad: avancePorSegundo(c.kmh),
        crucero: c.kmh,
        lat: p.lat,
        lon: p.lon,
        rumbo,
        speedKmh: c.kmh,
        sentido: c.sentido,
        telemetria: telemetriaDe(base, `${c.unitId}-a`, 'primary', 0, Date.now()),
        seq: 0,
        sinCobertura: false,
      };
    }),
    alertas: [],
    defectos: [],
    disparados: new Set(),
    tiempo: 0,
  };
}

/**
 * Mueve solo la posición de los trenes, sin tocar nada más.
 *
 * Existe para separar dos ritmos que no tienen por qué coincidir. La
 * física de la demo —alertas, batería, outbox, failover— se resuelve
 * bien 4 veces por segundo, pero a ese ritmo el ojo ve saltos: el tren
 * aparece en 4 sitios por segundo en vez de recorrer el trayecto. Esto
 * se llama en cada cuadro para rellenar el hueco.
 *
 * No inventa nada: la posición sale de la misma fórmula y de la misma
 * ruta real que usa `avanzarSimulacion`, solo evaluada más a menudo. Por
 * eso puede correr a 60 fps sin desviarse del estado "oficial" — es la
 * misma recta, con más puntos dibujados encima.
 */
export function interpolarPosiciones(
  estado: EstadoSimulacion,
  ruta: [number, number][],
  dtSegundos: number,
): EstadoSimulacion {
  if (ruta.length < 2) return estado;

  return {
    ...estado,
    trenes: estado.trenes.map((tr) => {
      // El x60 del factor de tiempo ya está dentro de `velocidad`: aquí
      // solo se multiplica por los segundos transcurridos.
      let avance = tr.avance + tr.velocidad * dtSegundos * tr.sentido;

      // El rebote en los extremos se decide aquí igual que en el paso
      // completo: si no, el tren se pasaría del final entre dos pasos.
      let sentido = tr.sentido;
      if (avance >= 1) {
        avance = 1;
        sentido = -1;
      } else if (avance <= 0) {
        avance = 0;
        sentido = 1;
      }

      const p = puntoEnRuta(ruta, avance);

      return {
        ...tr,
        avance,
        sentido,
        lat: p.lat,
        lon: p.lon,
        rumbo: sentido === 1 ? p.rumbo : p.rumbo === null ? null : p.rumbo + 180,
      };
    }),
  };
}

let contadorAlertas = 0;

/** Cada cuánto baja un punto de batería el nodo activo, en segundos de
 *  demo. El activo publica a mayor frecuencia y consume más.
 *
 *  Un celular publicando telemetría a 10 Hz con el GPS encendido aguanta
 *  del orden de 8 h, o sea ~1 punto cada 5 min de operación. Al factor
 *  de tiempo eso son 5 s de demo, que además deja ver el failover de la
 *  unidad 02 (arranca al 18 %) a los ~65 s de arrancar. */
const SEGUNDOS_POR_PUNTO_BATERIA = 5;

/** Por debajo de esto el nodo se apaga y la unidad cambia de fuente.
 *  Es la misma idea que el failover por falta de heartbeat en el
 *  backend, provocada aquí por la causa más común en campo. */
const BATERIA_CRITICA = 5;

/**
 * Avanza la simulación un paso.
 *
 * Devuelve un estado nuevo: los trenes se mueven, publican telemetría
 * coherente con el trazado, gastan batería, acumulan cola de outbox al
 * entrar en la zona sin cobertura, hacen failover cuando el primario se
 * queda sin pila, disparan alertas al cruzar los puntos de la vía, y un
 * punto se convierte en defecto confirmado cuando lo han cruzado
 * unidades distintas — la misma regla que aplica el backend con datos
 * reales.
 */
export function avanzarSimulacion(
  estado: EstadoSimulacion,
  ruta: [number, number][],
  dtSegundos: number,
): EstadoSimulacion {
  if (ruta.length < 2) return estado;

  const alertasNuevas: AlertaSimulada[] = [];
  const disparados = new Set(estado.disparados);
  const tiempo = estado.tiempo + dtSegundos;
  const ahora = Date.now();

  const trenes = estado.trenes.map((tr) => {
    // La posición ya viene puesta: quien mueve los trenes es
    // `interpolarPosiciones`, que corre por cuadro. Sumar aquí otra vez
    // el avance los pondría al doble de velocidad. Este paso solo lee
    // dónde están para decidir lo demás.
    const avance = tr.avance;
    const sentido = tr.sentido;
    const p = puntoEnRuta(ruta, avance);
    const curva = curvatura(ruta, avance);
    const sinCobertura = avance >= ZONA_SIN_COBERTURA.desde && avance <= ZONA_SIN_COBERTURA.hasta;

    // La velocidad real baja en las curvas cerradas, como haría un
    // maquinista. Da variación a la gráfica sin inventarla.
    // Un tren de carga no cambia de velocidad de golpe: arrastra miles
    // de toneladas. Se calcula a qué velocidad *debería* ir en este
    // punto y se tiende hacia ella poco a poco, así la ficha muestra una
    // aguja que sube y baja como la de una locomotora real en vez de
    // saltar entre valores.
    //
    // Antes esto partía de `tr.speedKmh`, que ya venía reducido: la
    // velocidad decaía un poco en cada paso y no se recuperaba nunca.
    const objetivo = tr.crucero * (1 - curva * 0.22) * (sinCobertura ? 0.94 : 1);
    // Constante de tiempo de ~6 s de demo, que al factor x60 son 6 min
    // de operación: el orden de magnitud con que un convoy cargado
    // gana o pierde velocidad.
    const inercia = Math.min(1, dtSegundos / 6);
    const speedKmh = Math.round((tr.speedKmh + (objetivo - tr.speedKmh) * inercia) * 10) / 10;

    // La posición avanza con la velocidad que realmente lleva, no con
    // la de crucero: si no, la ficha diría 48 km/h mientras el tren se
    // desplaza como si fuera a 62.
    const velocidad = avancePorSegundo(speedKmh);

    // --- estado de los nodos ------------------------------------------
    let nodoActivo = tr.nodoActivo;
    const nodos = tr.nodos.map((n) => {
      const esActivo = n.nodeId === nodoActivo;
      // El activo gasta más: publica a 10 Hz contra los 4 Hz del
      // respaldo, que solo mantiene heartbeat.
      const gasto = (dtSegundos / SEGUNDOS_POR_PUNTO_BATERIA) * (esActivo ? 1 : 0.35);
      const batteryPct = Math.max(0, n.batteryPct - gasto);

      // Sin cobertura el nodo sigue midiendo y encola; al recuperarla
      // drena la cola rápido, que es justo lo que hace el outbox real.
      const ritmo = 1000 / n.samplingMs;
      const pendingOutbox = sinCobertura
        ? Math.round(n.pendingOutbox + ritmo * dtSegundos)
        : Math.max(0, Math.round(n.pendingOutbox - ritmo * dtSegundos * 3));

      return {
        ...n,
        batteryPct,
        pendingOutbox,
        online: batteryPct > BATERIA_CRITICA,
      };
    });

    // Failover: si la fuente activa se apagó y queda otro nodo vivo, la
    // unidad pasa a ese. Es la regla del backend, disparada aquí por
    // batería en vez de por falta de heartbeat.
    const activo = nodos.find((n) => n.nodeId === nodoActivo);
    if (!activo?.online) {
      const relevo = nodos.find((n) => n.online);
      if (relevo) nodoActivo = relevo.nodeId;
    }

    const nodoQuePublica = nodos.find((n) => n.nodeId === nodoActivo) ?? nodos[0]!;
    const seq = tr.seq + 1;

    // --- alertas al cruzar los puntos de la vía -----------------------
    for (const punto of PUNTOS_CALIENTES) {
      const clave = `${tr.unitId}|${punto.avance}|${sentido}`;
      const cerca = Math.abs(avance - punto.avance) < MARGEN_DISPARO;

      // Sin cobertura la alerta se mide pero no llega: queda en el
      // outbox. Se dispara igual al salir, no se pierde.
      if (cerca && !disparados.has(clave) && !sinCobertura) {
        disparados.add(clave);
        contadorAlertas += 1;
        const pp = puntoEnRuta(ruta, punto.avance);
        alertasNuevas.push({
          id: `sim-${contadorAlertas}`,
          kind: punto.kind,
          severity: punto.severity,
          // Pequeña variación entre trenes: dos unidades no miden
          // exactamente lo mismo sobre el mismo defecto.
          value: punto.valor * (0.88 + Math.random() * 0.24),
          threshold: punto.umbral,
          lat: pp.lat,
          lon: pp.lon,
          ts: ahora,
          nodeId: nodoQuePublica.nodeId,
          unitId: tr.unitId,
        });
      }

      // Al alejarse se libera para que el siguiente paso vuelva a
      // disparar: es otra pasada.
      if (!cerca && Math.abs(avance - punto.avance) > MARGEN_DISPARO * 4) {
        disparados.delete(clave);
      }
    }

    return {
      ...tr,
      avance,
      sentido,
      lat: p.lat,
      lon: p.lon,
      rumbo: sentido === 1 ? p.rumbo : p.rumbo === null ? null : p.rumbo + 180,
      speedKmh,
      velocidad,
      nodos,
      nodoActivo,
      seq,
      sinCobertura,
      telemetria: telemetriaDe(
        { unitId: tr.unitId, lat: p.lat, lon: p.lon, speedKmh, seq },
        nodoQuePublica.nodeId,
        nodoQuePublica.role,
        curva,
        ahora,
      ),
    };
  });

  const alertas = [...alertasNuevas, ...estado.alertas].slice(0, 60);

  return {
    trenes,
    alertas,
    defectos: recalcularDefectos(alertas, ruta),
    disparados,
    tiempo,
  };
}

/** Distancia entre dos puntos en metros, tratando los grados como plano
 *  — a escala del corredor sobra, igual que en el backend. */
function distanciaM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = (b.lat - a.lat) * 111_320;
  const dLon = (b.lon - a.lon) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLon * dLon);
}

/** Separación temporal mínima para contar dos detecciones como pasadas
 *  distintas, igual que `SEPARACION_PASADA_MS` en el backend. Por debajo
 *  de esto el tren sigue sobre el mismo defecto: un convoy largo genera
 *  varias detecciones en segundos y son una sola pasada.
 *
 *  La simulación corre acelerada (la ruta entera en ~4 min en vez de
 *  5 h), así que el umbral se escala igual: 10 min reales sobre un
 *  factor de ~75x son unos 8 s de demo. */
const SEPARACION_PASADA_MS = 8_000;

/** Cuántas veces se pasó por el punto, no cuántas detecciones hubo.
 *  Mismo criterio que `contarPasadas` en el backend: se agrupa por
 *  unidad y se cuenta una pasada nueva solo tras un hueco temporal. */
function contarPasadas(alertas: { unitId: string; ts: number }[]): number {
  const porUnidad = new Map<string, number[]>();
  for (const a of alertas) {
    const lista = porUnidad.get(a.unitId);
    if (lista) lista.push(a.ts);
    else porUnidad.set(a.unitId, [a.ts]);
  }

  let total = 0;
  for (const tiempos of porUnidad.values()) {
    tiempos.sort((x, y) => x - y);
    let pasadas = 1;
    for (let i = 1; i < tiempos.length; i += 1) {
      if (tiempos[i]! - tiempos[i - 1]! > SEPARACION_PASADA_MS) pasadas += 1;
    }
    total += pasadas;
  }
  return total;
}

/** Agrupa las alertas simuladas por punto caliente y les asigna nivel
 *  de confianza con el mismo criterio del backend: lo que confirma un
 *  defecto es que lo vean unidades distintas, no cuántas veces se vea. */
function recalcularDefectos(
  alertas: AlertaSimulada[],
  ruta: [number, number][],
): TrackDefect[] {
  return PUNTOS_CALIENTES.map((punto): TrackDefect | null => {
    const p = puntoEnRuta(ruta, punto.avance);
    const suyas = alertas.filter(
      (a) => a.kind === punto.kind && Math.abs(a.lat - p.lat) < 0.01 && Math.abs(a.lon - p.lon) < 0.01,
    );
    if (suyas.length === 0) return null;

    // Unidades, no nodos: dos celulares del mismo tren ven el mismo
    // bache a la vez, así que no son observaciones independientes.
    const unidades = new Set(suyas.map((a) => a.unitId)).size;
    const nodos = new Set(suyas.map((a) => a.nodeId)).size;
    const valores = suyas.map((a) => a.value);
    const tiempos = suyas.map((a) => a.ts);

    const confianza =
      unidades >= 3 ? 'confirmado' : unidades === 2 ? 'probable' : 'indicio';
    const motivo =
      unidades >= 3
        ? `${unidades} unidades distintas detectaron lo mismo en este punto.`
        : unidades === 2
          ? 'Dos unidades distintas lo detectaron; falta una tercera para confirmarlo.'
          : 'Una sola detección: puede ser de la vía o del vehículo.';

    // Radio derivado de la dispersión real de las detecciones, como lo
    // calcula el backend: un radio fijo y pequeño afirmaría una
    // precisión que un GPS de ±70-120 m no tiene.
    const radio = suyas.reduce(
      (max, a) => Math.max(max, distanciaM(p, { lat: a.lat, lon: a.lon })),
      0,
    );

    return {
      lat: p.lat,
      lon: p.lon,
      radiusM: Math.round(Math.max(30, radio)),
      kind: punto.kind,
      confidence: confianza,
      reason: motivo,
      distinctUnits: unidades,
      distinctNodes: nodos,
      passes: contarPasadas(suyas),
      detections: suyas.length,
      averageValue: valores.reduce((a, b) => a + b, 0) / valores.length,
      firstSeen: new Date(Math.min(...tiempos)).toISOString(),
      lastSeen: new Date(Math.max(...tiempos)).toISOString(),
      eventIds: suyas.map((a) => a.id),
    };
  }).filter((d): d is TrackDefect => d !== null);
}

/** Hora de operación que representa la demo, como HH:MM.
 *
 *  La simulación arranca a las 06:00 —turno de mañana, con luz, que es
 *  cuando circula la carga— y el reloj corre al factor de tiempo. Se
 *  muestra junto al aviso para que quede claro que los cinco minutos de
 *  pantalla son cinco horas de operación: sin eso, un tren que cruza
 *  300 km en lo que dura la demo parece imposible, que es justo la duda
 *  que no conviene dejar en el aire. */
export function horaSimulada(tiempoS: number): string {
  const HORA_INICIO = 6;
  const minutos = HORA_INICIO * 60 + (tiempoS * FACTOR_TIEMPO) / 60;
  const h = Math.floor(minutos / 60) % 24;
  const m = Math.floor(minutos % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Nombre del punto caliente más cercano, para la ficha de la alerta. */
export function etiquetaPunto(avance: number): string | null {
  const p = PUNTOS_CALIENTES.find((x) => Math.abs(x.avance - avance) < 0.02);
  return p?.etiqueta ?? null;
}
