/* Vista previa de las detecciones que componen un defecto.
 *
 * La ficha del mapa daba las cifras agregadas —cuántas unidades, cuántas
 * pasadas— pero no dejaba llegar a los eventos concretos. Desde aquí se
 * ven las últimas detecciones con su valor y su hora, y se salta a
 * cualquiera en el centro de alertas.
 *
 * Los eventos se piden solo al abrir la ficha, no al cargar el mapa: con
 * varios defectos en pantalla, traer todas sus detecciones de golpe
 * serían decenas de peticiones para algo que casi nunca se mira.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { ApiError, api } from '../api/client';
import type { AnyEventKind, EventRecord } from '../api/types';
import { eventValueUnit } from '../lib/labels';
import { formatDateTime } from '../lib/format';
import './defectPreview.css';

/** Cuántas detecciones se listan. Más que esto convierte la ficha en una
 *  tabla y para eso ya está el centro de alertas. */
const MAX_FILAS = 4;

export default function DefectPreview({
  eventIds,
  kind,
}: {
  eventIds: string[];
  kind: AnyEventKind;
}) {
  const [eventos, setEventos] = useState<EventRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;

    // Se trae un lote reciente y se filtra por los ids del defecto: no
    // hay endpoint para pedir eventos sueltos por id, y traer 200 de una
    // vez es más barato que una petición por cada uno.
    api
      .listEvents({ limit: 200 })
      .then((todos) => {
        if (!vigente) return;
        const suyos = todos.filter((e) => eventIds.includes(e.id));
        setEventos(suyos);
      })
      .catch((e: unknown) => {
        if (vigente) {
          setError(e instanceof ApiError ? e.userMessage : 'No se pudieron cargar.');
        }
      });

    return () => {
      vigente = false;
    };
  }, [eventIds]);

  if (error) return <p className="dpreview__note">{error}</p>;
  if (eventos === null) return <p className="dpreview__note">Cargando detecciones…</p>;

  // Un defecto simulado no tiene eventos en la base: sus ids no
  // corresponden a filas reales.
  if (eventos.length === 0) {
    return (
      <p className="dpreview__note">
        {eventIds.length} {eventIds.length === 1 ? 'detección agrupada' : 'detecciones agrupadas'}.
      </p>
    );
  }

  const recientes = [...eventos]
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
    .slice(0, MAX_FILAS);
  const unidad = eventValueUnit(kind);

  return (
    <div className="dpreview">
      <span className="dpreview__title">
        Detecciones ({eventos.length})
      </span>

      <ul className="dpreview__list">
        {recientes.map((e) => (
          <li key={e.id}>
            <Link to={`/eventos?evento=${e.id}`} className="dpreview__row">
              <span className="dpreview__value">
                {e.value === null ? '—' : `${e.value.toFixed(2)}${unidad ? ` ${unidad}` : ''}`}
              </span>
              <span className="dpreview__when">{formatDateTime(e.ts)}</span>
              {/* El veredicto, cuando lo hay: distingue un punto que
                  alguien ya revisó de uno sin tocar. */}
              {e.verdict ? (
                <span className={`dpreview__verdict dpreview__verdict--${e.verdict}`}>
                  {e.verdict === 'confirmed'
                    ? 'real'
                    : e.verdict === 'false_alarm'
                      ? 'falsa'
                      : '?'}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>

      {eventos.length > MAX_FILAS ? (
        <span className="dpreview__more">y {eventos.length - MAX_FILAS} más</span>
      ) : null}

      <Link to={`/eventos?evento=${recientes[0]!.id}`} className="dpreview__cta">
        Abrir en el centro de alertas →
      </Link>
    </div>
  );
}
