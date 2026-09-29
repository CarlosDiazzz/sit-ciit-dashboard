// Velocímetro digital — mismo dato que la línea "velocidad (km/h)" de
// Unidad.tsx (gps.speedMs del backend), mostrado como número grande en
// vez de serie de tiempo. Mismo violeta que esa línea, para que se lea
// como el mismo dato en las dos formas.
//
// El número se anima entre una lectura real y la siguiente (useAnimatedNumber)
// en vez de saltar de golpe — así se siente "en vivo" aunque el GPS solo
// llegue cada varios segundos. No inventa valores intermedios como
// mediciones, solo suaviza cómo se muestra el cambio entre dos reales.
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';

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
  const animated = useAnimatedNumber(speedKmh);

  return (
    <div style={{ textAlign: 'center', padding: '8px 0' }}>
      <div
        style={{
          fontSize: 48,
          fontWeight: 'bold',
          fontVariantNumeric: 'tabular-nums',
          color: animated != null ? colors.accent : colors.muted,
          lineHeight: 1,
        }}
      >
        {animated != null ? animated.toFixed(1) : '—'}
      </div>
      <div style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>
        {speedKmh != null ? 'km/h' : 'sin dato'}
        {label ? ` · ${label}` : ''}
      </div>
    </div>
  );
}
