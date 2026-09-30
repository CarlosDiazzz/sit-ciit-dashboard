/* Resumen de defectos de vía, sobre el panel del mapa.
 *
 * Es el resultado que justifica el sistema: no "hubo 40 sacudidas", sino
 * "estos puntos del corredor requieren inspección, y esto es lo que lo
 * sostiene". Por eso lo primero que se lee es cuántos están confirmados.
 */

import type { ApiError } from '../api/client';
import type { TrackDefect, TrackDefectsResponse } from '../api/types';
import { eventKindLabel } from '../lib/labels';
import { formatAgo } from '../lib/format';
import './trackDefect.css';

export default function TrackDefectSummary({
  estado,
  verIndicios,
  onVerIndicios,
}: {
  estado: {
    data: TrackDefectsResponse | null;
    loading: boolean;
    error: ApiError | null;
  };
  verIndicios: boolean;
  onVerIndicios: (v: boolean) => void;
}) {
  if (estado.loading && estado.data === null) {
    return (
      <section className="defects-panel">
        <h2 className="defects-panel__title">Estado de la vía</h2>
        <p className="defects-panel__note">Analizando detecciones…</p>
      </section>
    );
  }

  if (estado.error) {
    return (
      <section className="defects-panel">
        <h2 className="defects-panel__title">Estado de la vía</h2>
        <p className="defects-panel__note defects-panel__note--error">
          {estado.error.userMessage}
        </p>
      </section>
    );
  }

  const defectos = estado.data?.defects ?? [];
  const confirmados = defectos.filter((d) => d.confidence === 'confirmado');
  const probables = defectos.filter((d) => d.confidence === 'probable');
  const indicios = defectos.filter((d) => d.confidence === 'indicio');

  return (
    <section className="defects-panel">
      <div className="defects-panel__head">
        <h2 className="defects-panel__title">Estado de la vía</h2>
        <span className="defects-panel__window">
          {estado.data?.analyzed ?? 0} detecciones · {estado.data?.windowDays ?? 0} d
        </span>
      </div>

      {/* La cifra grande es la que importa: lo confirmado es lo que se
          puede mandar a inspeccionar sin más discusión. */}
      <div className="defects-tally">
        <div className="defects-tally__main">
          <strong>{confirmados.length}</strong>
          <span>
            {confirmados.length === 1 ? 'punto confirmado' : 'puntos confirmados'}
          </span>
        </div>
        <div className="defects-tally__side">
          <span>
            <b>{probables.length}</b> probables
          </span>
          <span>
            <b>{indicios.length}</b> indicios
          </span>
        </div>
      </div>

      {defectos.length === 0 ? (
        <p className="defects-panel__note">
          Sin detecciones geolocalizadas todavía. Los defectos aparecen cuando
          varias unidades reportan lo mismo en el mismo punto del corredor.
        </p>
      ) : (
        <>
          <ul className="defects-list">
            {[...confirmados, ...probables].slice(0, 5).map((d) => (
              <DefectoFila key={`${d.lat},${d.lon},${d.kind}`} d={d} />
            ))}
          </ul>

          {confirmados.length === 0 ? (
            <p className="defects-panel__note">
              Ningún punto confirmado aún: hace falta que unidades distintas
              detecten lo mismo en el mismo lugar. Una sola unidad no descarta
              que el origen sea el vehículo.
            </p>
          ) : null}

          <label className="defects-toggle">
            <input
              type="checkbox"
              checked={verIndicios}
              onChange={(e) => onVerIndicios(e.target.checked)}
            />
            Mostrar indicios en el mapa
          </label>
        </>
      )}
    </section>
  );
}

function DefectoFila({ d }: { d: TrackDefect }) {
  return (
    <li className={`defect-row defect-row--${d.confidence}`}>
      <div className="defect-row__top">
        <span className="defect-row__kind">{eventKindLabel(d.kind)}</span>
        <span className="defect-row__units">
          {d.distinctUnits} {d.distinctUnits === 1 ? 'unidad' : 'unidades'}
        </span>
      </div>
      <p className="defect-row__reason">{d.reason}</p>
      <span className="defect-row__meta">
        {d.passes} {d.passes === 1 ? 'pasada' : 'pasadas'} · última {formatAgo(d.lastSeen)}
      </span>
    </li>
  );
}
