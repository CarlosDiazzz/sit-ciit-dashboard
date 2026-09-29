// Velocímetro digital — mismo dato que la línea "velocidad (km/h)" de
// Unidad.tsx (gps.speedMs del backend), mostrado como número grande en
// vez de serie de tiempo. Mismo violeta que esa línea, para que se lea
// como el mismo dato en las dos formas.

interface SpeedGaugeColors {
  accent: string;
  muted: string;
}

interface SpeedGaugeProps {
  speedKmh: number | null;
  label?: string;
  colors: SpeedGaugeColors;
}

export default function SpeedGauge({ speedKmh, label, colors }: SpeedGaugeProps) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 0' }}>
      <div
        style={{
          fontSize: 48,
          fontWeight: 'bold',
          fontVariantNumeric: 'tabular-nums',
          color: speedKmh != null ? colors.accent : colors.muted,
          lineHeight: 1,
        }}
      >
        {speedKmh != null ? speedKmh.toFixed(1) : '—'}
      </div>
      <div style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>
        {speedKmh != null ? 'km/h' : 'sin dato'}
        {label ? ` · ${label}` : ''}
      </div>
    </div>
  );
}
