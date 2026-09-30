/* Indicador de actitud del contenedor, en la tradición del horizonte
 * artificial de un avión.
 *
 * La analogía es directa: un piloto necesita saber cómo está inclinada
 * su aeronave respecto al suelo, y un centro de control necesita saber
 * cómo está inclinada la carga respecto a la vía. Una volcadura empieza
 * como un alabeo que crece.
 *
 * Los dos ángulos salen del acelerómetro, no del giroscopio: con el
 * vehículo quieto o a velocidad constante, el vector de gravedad apunta
 * al suelo y su dirección respecto al dispositivo *es* la inclinación.
 * El giroscopio mide otra cosa — qué tan rápido está girando — y se
 * muestra aparte, porque una rotación brusca importa aunque el ángulo
 * final sea pequeño.
 */

import { type Actitud } from '../lib/actitud';
import './attitude.css';

/** Por encima de este alabeo la carga puede recorrerse. */
const ALABEO_AVISO = 15;
/** El contrato marca volcadura a los 60° sostenidos. */
const ALABEO_CRITICO = 30;

/** Rotación por encima de la cual el movimiento deja de ser marcha
 *  normal: unos 34 °/s. */
const ROTACION_AVISO = 0.6;


function nivel(alabeo: number): 'normal' | 'aviso' | 'critico' {
  const a = Math.abs(alabeo);
  if (a >= ALABEO_CRITICO) return 'critico';
  if (a >= ALABEO_AVISO) return 'aviso';
  return 'normal';
}

export default function AttitudeIndicator({
  actitud,
  nodeCode,
}: {
  actitud: Actitud | null;
  nodeCode: string | null;
}) {
  if (!actitud) {
    return (
      <div className="attitude attitude--empty">
        <p>Esperando lecturas del acelerómetro</p>
      </div>
    );
  }

  const { alabeo, cabeceo, rotacion } = actitud;
  const estado = nivel(alabeo);

  // El horizonte se inclina al revés que el vehículo, como en un avión:
  // lo que gira es el mundo, el símbolo de la unidad queda fijo.
  const giroHorizonte = -alabeo;
  // 2.2 px de desplazamiento por grado de cabeceo, acotado para que la
  // banda no se salga del disco.
  const desplazamiento = Math.max(-58, Math.min(58, cabeceo * 2.2));

  return (
    <div className={`attitude attitude--${estado}`}>
      <div className="attitude__head">
        <h3>Actitud</h3>
        {nodeCode ? <span className="attitude__node mono">{nodeCode}</span> : null}
      </div>

      <div className="attitude__dial">
        <svg viewBox="0 0 200 200" role="img" aria-label={`Alabeo ${alabeo.toFixed(0)} grados, cabeceo ${cabeceo.toFixed(0)} grados`}>
          <defs>
            <clipPath id="attitude-disc">
              <circle cx="100" cy="100" r="76" />
            </clipPath>
          </defs>

          <g clipPath="url(#attitude-disc)">
            <g transform={`rotate(${giroHorizonte} 100 100) translate(0 ${desplazamiento})`}>
              {/* Cielo y tierra: la referencia que da sentido al resto. */}
              <rect x="-80" y="-130" width="360" height="230" className="attitude__sky" />
              <rect x="-80" y="100" width="360" height="230" className="attitude__ground" />
              <line x1="-80" y1="100" x2="280" y2="100" className="attitude__horizon" />

              {/* Escala de cabeceo, cada 10°. */}
              {[-30, -20, -10, 10, 20, 30].map((g) => (
                <g key={g}>
                  <line
                    x1={g % 20 === 0 ? 74 : 84}
                    y1={100 - g * 2.2}
                    x2={g % 20 === 0 ? 126 : 116}
                    y2={100 - g * 2.2}
                    className="attitude__tick"
                  />
                  {g % 20 === 0 ? (
                    <text x={66} y={100 - g * 2.2 + 3.5} className="attitude__tick-label">
                      {Math.abs(g)}
                    </text>
                  ) : null}
                </g>
              ))}
            </g>
          </g>

          {/* Marcas de alabeo, fijas respecto al observador. */}
          {[-30, -20, -10, 0, 10, 20, 30].map((g) => {
            const rad = ((g - 90) * Math.PI) / 180;
            const r1 = g === 0 ? 68 : 72;
            return (
              <line
                key={g}
                x1={100 + Math.cos(rad) * r1}
                y1={100 + Math.sin(rad) * r1}
                x2={100 + Math.cos(rad) * 76}
                y2={100 + Math.sin(rad) * 76}
                className={g === 0 ? 'attitude__roll-zero' : 'attitude__roll-tick'}
              />
            );
          })}

          <circle cx="100" cy="100" r="76" className="attitude__rim" />

          {/* Símbolo de la unidad: fijo, como el avión en un horizonte
              artificial. Lo que se mueve es el mundo detrás. */}
          <g className="attitude__craft">
            <line x1="62" y1="100" x2="86" y2="100" />
            <line x1="114" y1="100" x2="138" y2="100" />
            <circle cx="100" cy="100" r="3.5" />
          </g>
        </svg>
      </div>

      <dl className="attitude__values">
        <div>
          <dt>Alabeo</dt>
          <dd className={estado !== 'normal' ? `is-${estado}` : undefined}>
            {alabeo >= 0 ? '+' : ''}
            {alabeo.toFixed(1)}°
          </dd>
        </div>
        <div>
          <dt>Cabeceo</dt>
          <dd>
            {cabeceo >= 0 ? '+' : ''}
            {cabeceo.toFixed(1)}°
          </dd>
        </div>
        <div>
          <dt>Rotación</dt>
          <dd className={rotacion !== null && rotacion > ROTACION_AVISO ? 'is-aviso' : undefined}>
            {rotacion === null ? '—' : `${rotacion.toFixed(2)} rad/s`}
          </dd>
        </div>
      </dl>

      {estado === 'critico' ? (
        <p className="attitude__warn">
          Inclinación sostenida: el contrato marca volcadura a los 60°.
        </p>
      ) : null}
    </div>
  );
}
