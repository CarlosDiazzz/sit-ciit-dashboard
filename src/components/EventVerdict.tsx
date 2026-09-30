import { t as translate } from '../accessibility/i18n';
/* Veredicto del operador sobre un evento.
 *
 * El nodo detecta, pero no sabe si acertó: no puede distinguir un bache
 * real de que movieran la caja durante la carga. Quien tiene ese
 * contexto es la persona que vigila la operación.
 *
 * Cada veredicto es además un ejemplo etiquetado. Es lo que convierte la
 * revisión diaria en datos para afinar los umbrales, y más adelante para
 * entrenar un modelo con casos reales del corredor.
 */

import { useState } from 'react';

import { ApiError, api } from '../api/client';
import type { EventVerdict as Verdict } from '../api/types';
import './eventVerdict.css';

const OPCIONES: { valor: Verdict; etiqueta: string; ayuda: string }[] = [
  { valor: 'confirmed', etiqueta: 'Ocurrió', ayuda: 'La detección corresponde a algo real' },
  { valor: 'false_alarm', etiqueta: 'Falsa alarma', ayuda: 'El sensor disparó sin causa real' },
  { valor: 'unclear', etiqueta: 'No se puede saber', ayuda: 'No hay forma de verificarlo' },
];

export default function EventVerdict({
  eventId,
  actual,
  nota,
  onGuardado,
}: {
  eventId: string;
  actual: Verdict | null | undefined;
  nota: string | null | undefined;
  /** Avisa a la vista para que refresque sin recargar la lista entera. */
  onGuardado: (veredicto: Verdict, nota: string | null) => void;
}) {
  const [texto, setTexto] = useState(nota ?? '');
  const [guardando, setGuardando] = useState<Verdict | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function registrar(verdict: Verdict) {
    setGuardando(verdict);
    setError(null);
    try {
      const r = await api.setEventVerdict(eventId, verdict, texto.trim() || undefined);
      onGuardado(r.verdict, r.note);
    } catch (e) {
      setError(e instanceof ApiError ? e.userMessage : 'No se pudo registrar el veredicto.');
    } finally {
      setGuardando(null);
    }
  }

  return (
    <div className="verdict">
      <div className="verdict-head">
        <h4>{translate("¿La detección acertó?")}</h4>
        {actual ? (
          <span className={`verdict-tag verdict-tag--${actual}`}>
            {translate(OPCIONES.find((o) => o.valor === actual)?.etiqueta)}
          </span>
        ) : (
          <span className="verdict-tag verdict-tag--pending">{translate("Sin juzgar")}</span>
        )}
      </div>

      <div className="verdict-options">
        {OPCIONES.map((o) => (
          <button
            key={o.valor}
            type="button"
            className={`verdict-btn${actual === o.valor ? ' is-active' : ''}`}
            onClick={() => registrar(o.valor)}
            disabled={guardando !== null}
            title={translate(o.ayuda)}
          >
            {translate(guardando === o.valor ? 'Guardando…' : o.etiqueta)}
          </button>
        ))}
      </div>

      <label className="verdict-note">
        <span>{translate("Qué pasó en realidad (opcional)")}</span>
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={translate("Maniobra de carga, paso por junta de riel…")}
          maxLength={500}
        />
      </label>

      {error ? (
        <p className="verdict-error" role="alert">
          {translate(error)}
        </p>
      ) : null}

      {/* Se dice para qué sirve: un operador que entiende por qué se le
          pide algo lo hace mejor. */}
      <p className="verdict-hint">
        {translate(actual
          ? 'Puedes corregirlo si te equivocaste.'
          : 'Tu juicio afina los umbrales de detección para los próximos recorridos.')}
      </p>
    </div>
  );
}
