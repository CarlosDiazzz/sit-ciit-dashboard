// Tacómetro semicircular — mismo dato real que la línea "velocidad (km/h)"
// de Unidad.tsx (gps.speedMs del backend), solo que como aguja en vez de
// serie de tiempo. Mismo color violeta que esa línea, para que se lea
// como el mismo dato en las dos formas.

const CX = 100;
const CY = 100;
const R = 80;
const NEEDLE_R = 68;

function pointOnArc(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY - radius * Math.sin(rad) };
}

function arcPath(fromDeg: number, toDeg: number, radius: number): string {
  const start = pointOnArc(fromDeg, radius);
  const end = pointOnArc(toDeg, radius);
  const largeArc = fromDeg - toDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

interface SpeedGaugeColors {
  track: string;
  accent: string;
  ink: string;
  muted: string;
}

interface SpeedGaugeProps {
  speedKmh: number | null;
  maxKmh?: number;
  label?: string;
  colors: SpeedGaugeColors;
}

export default function SpeedGauge({ speedKmh, maxKmh = 20, label, colors }: SpeedGaugeProps) {
  const clamped = Math.min(Math.max(speedKmh ?? 0, 0), maxKmh);
  const valueAngle = 180 - (clamped / maxKmh) * 180;
  const needleEnd = pointOnArc(valueAngle, NEEDLE_R);

  return (
    <svg width="100%" height={150} viewBox="0 0 200 135" role="img" aria-label={`Velocidad ${speedKmh?.toFixed(1) ?? 'sin dato'} km/h`}>
      <path d={arcPath(180, 0, R)} stroke={colors.track} strokeWidth={14} fill="none" strokeLinecap="round" />
      {speedKmh != null && (
        <path d={arcPath(180, valueAngle, R)} stroke={colors.accent} strokeWidth={14} fill="none" strokeLinecap="round" />
      )}
      <text x={20} y={112} fontSize={10} fill={colors.muted}>
        0
      </text>
      <text x={168} y={112} fontSize={10} fill={colors.muted}>
        {maxKmh}
      </text>

      {speedKmh != null && (
        <line x1={CX} y1={CY} x2={needleEnd.x} y2={needleEnd.y} stroke={colors.ink} strokeWidth={3} strokeLinecap="round" />
      )}
      <circle cx={CX} cy={CY} r={6} fill={colors.ink} />

      <text x={CX} y={105} textAnchor="middle" fontSize={24} fontWeight="bold" fill={colors.ink}>
        {speedKmh != null ? speedKmh.toFixed(1) : '—'}
      </text>
      <text x={CX} y={122} textAnchor="middle" fontSize={11} fill={colors.muted}>
        {speedKmh != null ? 'km/h' : 'sin dato'}
        {label ? ` · ${label}` : ''}
      </text>
    </svg>
  );
}
