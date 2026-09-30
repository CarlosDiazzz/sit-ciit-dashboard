import { t as translate, locale } from '../accessibility/i18n';
/* Panel de riesgo climático por unidad.
 *
 * Muestra el clima AMBIENTAL real (Open-Meteo) en la última posición
 * conocida de la unidad — no la temperatura/humedad dentro del
 * contenedor, que el celular no puede medir. Por eso esto se presenta
 * como "riesgo climático contextual" según la categoría de carga
 * declarada, nunca como "cumple/no cumple norma".
 *
 * La correlación con los eventos físicos de la unidad (impacto,
 * volcadura) no se calcula aquí: se ve en la lista de Eventos, uno junto
 * al otro — no se fusionan en una fórmula inventada (mismo principio que
 * se aplicó al rechazar la fusión GPS+acelerómetro para velocidad).
 */

import { useCallback, useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { api } from '../api/client';
import { useApi } from '../api/useApi';
import { useSocketEvent } from '../api/socket';
import type { CargoCategory, EventBroadcast, RiskRule, Unit, WeatherReading } from '../api/types';
import { chartPalette } from '../lib/chartColors';
import { cargoCategoryLabel, formatConditions } from '../lib/labels';
import { formatNumber } from '../lib/format';
import { CargoCategoryBadge, SeverityBadge } from './Badges';
import { ErrorState, Loading } from './States';

const CATEGORIES: CargoCategory[] = ['agricola', 'construccion', 'quimico', 'sin_carga'];
const HISTORY_HOURS = 24;

interface Props {
  unit: Unit;
  canEditCategory: boolean;
  /** Tabla de referencia completa (todas las categorías) — se filtra aquí
   *  por la de esta unidad. Se pide una vez en Unidad.tsx, no por panel,
   *  porque es la misma para todas las unidades. */
  allRules: RiskRule[];
  /** La unidad vive en la lista del padre (Unidad.tsx); tras cambiar la
   *  categoría hay que refrescarla ahí, no solo en este panel. */
  onCategoryChanged: () => void;
}

export default function WeatherRiskPanel({ unit, canEditCategory, allRules, onCategoryChanged }: Props) {
  const colors = chartPalette();

  // Sin categoría de carga el vigilante nunca genera una lectura para
  // esta unidad — pedirla igual solo deja un 404 sin sentido en la
  // consola. El "todavía no tiene categoría asignada" ya se muestra
  // aparte, antes de leer latest.data (ver el JSX abajo).
  const tieneCategoria = unit.cargoCategory !== null;
  const latest = useApi(
    () => (tieneCategoria ? api.getWeatherLatest(unit.id) : Promise.resolve(null)),
    [unit.id, tieneCategoria],
  );
  const history = useApi(
    () =>
      tieneCategoria
        ? api.getWeatherHistory(
            unit.id,
            new Date(Date.now() - HISTORY_HOURS * 3_600_000).toISOString(),
            new Date().toISOString(),
          )
        : Promise.resolve([]),
    [unit.id, tieneCategoria],
  );

  // El scheduler del backend solo registra un evento cuando cambia el
  // nivel de riesgo (no cada 15 min) — cuando eso pasa, se refresca la
  // lectura real en vez de intentar derivar el cambio del socket.
  const onEvent = useCallback(
    (evt: EventBroadcast) => {
      if (evt.kind === 'weather_risk' && evt.unitId === unit.unitCode) {
        latest.reload();
        history.reload();
      }
    },
    [unit.unitCode, latest, history],
  );
  useSocketEvent('event', onEvent);

  const chartData = useMemo(
    () =>
      (history.data ?? []).map((r: WeatherReading) => ({
        time: new Date(r.ts).toLocaleTimeString(locale(), { hour12: false, hour: '2-digit', minute: '2-digit' }),
        tempC: r.tempC,
        humidityPct: r.humidityPct,
      })),
    [history.data],
  );

  async function handleCategoryChange(category: CargoCategory) {
    await api.setCargoCategory(unit.id, category);
    onCategoryChanged();
    latest.reload();
  }

  const ejeComun = { stroke: colors.axis, tick: { fill: colors.muted, fontSize: 12 } };

  const categoryRules = unit.cargoCategory
    ? allRules.filter((r) => r.category === unit.cargoCategory)
    : [];
  const activeRuleIds = new Set((latest.data?.activeRules ?? []).map((r) => r.id));

  return (
    <section className="chart-card weather-risk-card">
      <div className="card-head">
        <h3>{translate("Riesgo climático")}</h3>
        {unit.cargoCategory ? <CargoCategoryBadge category={unit.cargoCategory} /> : null}
      </div>

      {canEditCategory ? (
        <label className="node-picker weather-category-picker">{translate("Categoría de carga:")}{' '}
          <select
            value={unit.cargoCategory ?? ''}
            onChange={(e) => handleCategoryChange(e.target.value as CargoCategory)}
          >
            <option value="" disabled>{translate("Sin asignar")}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {translate(cargoCategoryLabel(c))}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {unit.cargoCategory && categoryRules.length > 0 ? (
        <details className="weather-thresholds-details">
          <summary>{translate("Ver umbrales de ")}{translate(cargoCategoryLabel(unit.cargoCategory))} ({categoryRules.length})</summary>
          <ul className="weather-rules weather-thresholds">
            {categoryRules.map((r) => (
              <li key={r.id}>
                <SeverityBadge severity={r.severity} />
                <span>{translate(formatConditions(r.conditions).join(' y '))}</span>
                {activeRuleIds.has(r.id) ? <span className="tag">{translate("activa ahora")}</span> : null}
                <span className="weather-rule-source">
                  {translate(r.isAssumption ? 'Supuesto del equipo — ' : '')}
                  {translate(r.source)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {!unit.cargoCategory ? (
        <p className="chart-hint">{translate("Esta unidad todavía no tiene categoría de carga asignada — sin eso no se pueden evaluar reglas de riesgo climático.")}</p>
      ) : latest.loading && latest.data === null ? (
        <Loading />
      ) : latest.error && latest.error.status !== 404 ? (
        <ErrorState error={latest.error} onRetry={latest.reload} />
      ) : !latest.data ? (
        <p className="chart-hint">{translate("Todavía no hay una lectura de clima para esta unidad — llega en cuanto reporte GPS y el vigilante del backend corra (cada 15 min).")}</p>
      ) : (
        <>
          <dl className="weather-summary">
            <dt>{translate("Temperatura")}</dt>
            <dd>{translate(formatNumber(latest.data.weather.tempC, 1))}{translate(" °C")}</dd>
            <dt>{translate("Humedad relativa")}</dt>
            <dd>{translate(formatNumber(latest.data.weather.humidityPct, 0))} %</dd>
            <dt>{translate("Precipitación")}</dt>
            <dd>{translate(formatNumber(latest.data.weather.precipMm, 1))}{translate(" mm")}</dd>
          </dl>
          <p className="chart-meta weather-source">{translate("Clima ambiental real (Open-Meteo) en la última posición GPS conocida — no es la temperatura dentro de la carga.")}</p>

          {unit.cargoCategory === 'sin_carga' ? (
            <p className="chart-hint">{translate("Esta unidad va sin carga — no aplican reglas de riesgo climático.")}</p>
          ) : latest.data.activeRules.length === 0 ? (
            <p className="chart-hint weather-clear">{translate("Sin riesgo detectado en las condiciones actuales.")}</p>
          ) : (
            <ul className="weather-rules">
              {latest.data.activeRules.map((r) => (
                <li key={r.id}>
                  <SeverityBadge severity={r.severity} />
                  <span>
                    {translate(r.message)} <span className="weather-rule-source">({translate(formatConditions(r.conditions).join(' y '))})</span>
                  </span>
                  <span className="weather-rule-source">
                    {translate(r.isAssumption ? 'Supuesto del equipo — ' : '')}
                    {translate(r.source)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {chartData.length > 1 ? (
            <div className="chart-frame chart-frame-sm">
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={colors.grid} vertical={false} />
                  <XAxis dataKey="time" minTickGap={40} {...ejeComun} />
                  <YAxis domain={['auto', 'auto']} {...ejeComun} />
                  <Tooltip
                    contentStyle={{ background: colors.surface, border: `1px solid ${colors.grid}`, fontSize: 12 }}
                    labelStyle={{ color: colors.textSecondary }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: colors.textSecondary }} />
                  <Line type="monotone" dataKey="tempC" name={translate("°C")} stroke={colors.seriesTemp} dot={false} isAnimationActive={false} connectNulls />
                  <Line type="monotone" dataKey="humidityPct" name={translate("% HR")} stroke={colors.seriesHumidity} dot={false} isAnimationActive={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
