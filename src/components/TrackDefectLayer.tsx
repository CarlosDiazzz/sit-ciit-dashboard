/* Defectos de vía sobre el mapa.
 *
 * Un defecto no es un punto: es una zona con incertidumbre. El GPS de
 * estos nodos ronda los 95 m de error, así que dibujarlo como un pin
 * exacto afirmaría una precisión que no existe. Se pinta el círculo que
 * cubre las detecciones agrupadas y un marcador en el centro ponderado.
 *
 * La confianza se codifica en forma además de en color: un defecto
 * confirmado lleva contorno sólido, uno probable discontinuo, y un
 * indicio apenas un trazo punteado. Así se distingue sin depender del
 * color, que en un mapa compite con las teselas.
 */

import { Circle, Marker, Popup, Tooltip } from 'react-leaflet';
import { divIcon } from 'leaflet';

import type { DefectConfidence, TrackDefect } from '../api/types';
import { eventKindLabel, eventValueUnit } from '../lib/labels';
import { formatDateTime } from '../lib/format';
import './trackDefect.css';

/** Ámbar para lo confirmado: es mantenimiento pendiente, no una
 *  emergencia. El rojo queda reservado para lo que pasa ahora mismo. */
const ESTILO: Record<
  DefectConfidence,
  { color: string; guion: string | undefined; grosor: number; relleno: number; etiqueta: string }
> = {
  confirmado: { color: '#f39a48', guion: undefined, grosor: 2.5, relleno: 0.16, etiqueta: 'Confirmado' },
  probable: { color: '#d9a441', guion: '7 5', grosor: 2, relleno: 0.09, etiqueta: 'Probable' },
  indicio: { color: '#8b949e', guion: '2 6', grosor: 1.5, relleno: 0.04, etiqueta: 'Indicio' },
};

const iconos = new Map<string, ReturnType<typeof divIcon>>();

function iconoDefecto(d: TrackDefect) {
  const clave = `${d.confidence}|${d.distinctUnits}`;
  const guardado = iconos.get(clave);
  if (guardado) return guardado;

  const e = ESTILO[d.confidence];
  const creado = divIcon({
    className: '',
    html: `
      <div class="defect-marker defect-marker--${d.confidence}" style="--c:${e.color}">
        <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
          <path d="M10 2 L18 16 L2 16 Z" fill="${e.color}" stroke="#0b0e0d" stroke-width="1.4"
                stroke-linejoin="round"/>
          <rect x="9.1" y="7" width="1.8" height="5" rx="0.9" fill="#0b0e0d"/>
          <circle cx="10" cy="13.8" r="1" fill="#0b0e0d"/>
        </svg>
        ${d.confidence === 'confirmado' ? `<span class="defect-marker__count">${d.distinctUnits}</span>` : ''}
      </div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 16],
  });
  if (iconos.size > 200) iconos.clear();
  iconos.set(clave, creado);
  return creado;
}

export default function TrackDefectLayer({
  defects,
  mostrarIndicios,
}: {
  defects: TrackDefect[];
  /** Los indicios son ruido hasta que se repiten: se ocultan salvo que
   *  el operador quiera verlos. */
  mostrarIndicios: boolean;
}) {
  const visibles = mostrarIndicios
    ? defects
    : defects.filter((d) => d.confidence !== 'indicio');

  return (
    <>
      {visibles.map((d) => {
        const e = ESTILO[d.confidence];
        const unidad = eventValueUnit(d.kind);

        return (
          <div key={`${d.lat},${d.lon},${d.kind}`}>
            {/* La zona de incertidumbre: nunca menor a 30 m, porque un
                círculo diminuto sugeriría una precisión que el GPS no
                tiene. */}
            <Circle
              center={[d.lat, d.lon]}
              radius={Math.max(30, d.radiusM)}
              pathOptions={{
                color: e.color,
                weight: e.grosor,
                dashArray: e.guion,
                fillColor: e.color,
                fillOpacity: e.relleno,
              }}
            />

            <Marker position={[d.lat, d.lon]} icon={iconoDefecto(d)} zIndexOffset={300}>
              <Tooltip direction="top" offset={[0, -16]}>
                {eventKindLabel(d.kind)} · {e.etiqueta}
              </Tooltip>

              <Popup>
                <div className="defect-popup">
                  <strong>{eventKindLabel(d.kind)}</strong>
                  <span className={`defect-popup__tag defect-popup__tag--${d.confidence}`}>
                    {e.etiqueta}
                  </span>

                  {/* La frase que explica el nivel: es lo que hace
                      defendible la conclusión ante quien pregunte. */}
                  <p className="defect-popup__reason">{d.reason}</p>

                  <dl className="defect-popup__stats">
                    <div>
                      <dt>Unidades</dt>
                      <dd>{d.distinctUnits}</dd>
                    </div>
                    <div>
                      <dt>Pasadas</dt>
                      <dd>{d.passes}</dd>
                    </div>
                    <div>
                      <dt>Intensidad media</dt>
                      <dd>
                        {d.averageValue === null
                          ? '—'
                          : `${d.averageValue.toFixed(2)}${unidad ? ` ${unidad}` : ''}`}
                      </dd>
                    </div>
                    <div>
                      <dt>Zona</dt>
                      <dd>±{Math.max(30, d.radiusM)} m</dd>
                    </div>
                  </dl>

                  <p className="defect-popup__seen">
                    Primera vez {formatDateTime(d.firstSeen)}
                    <br />
                    Última {formatDateTime(d.lastSeen)}
                  </p>
                </div>
              </Popup>
            </Marker>
          </div>
        );
      })}
    </>
  );
}
