/** Interpretación original del tren CSS de mr_alien:
 * https://codepen.io/mr_alien/pen/zvvapo
 * Geometría simplificada y monocromática para los estados de Zenda.
 */
export default function StatusTrain() {
  return (
    <div className="status-train" aria-hidden="true">
      <svg viewBox="0 0 320 130" fill="none">
        <g className="status-train-steam" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M236 37c-9-8 8-12 0-21" />
          <path d="M249 32c-7-7 7-11 1-18" />
        </g>
        <g className="status-train-body" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <path className="train-fill" d="M44 64h78v35H44zM150 48h42v51h-42zM192 70h66v29h-66z" />
          <path d="M144 47h54M159 57h24v19h-24zM232 69V51h13v18M227 51h23M39 99h226M122 90h28M258 84l15 15h-15M52 72h62M52 79h62" />
          {[61, 106, 169, 233].map((x) => (
            <g key={x} className="status-train-wheel" style={{ transformOrigin: `${x}px 101px` }}>
              <circle className="train-fill" cx={x} cy="101" r="11" />
              <circle cx={x} cy="101" r="3" />
              <path d={`M${x} 90v8m0 6v8m-11-11h8m6 0h8`} />
            </g>
          ))}
        </g>
        <path d="M22 115h276" stroke="currentColor" strokeWidth="2" />
        <g className="status-train-track" stroke="currentColor" strokeWidth="2">
          {Array.from({ length: 16 }, (_, i) => <path key={i} d={`M${i * 22} 121h10`} />)}
        </g>
      </svg>
    </div>
  );
}
