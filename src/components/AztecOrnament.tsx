/** Ornamentos decorativos: heredan el pigmento de la sección activa. */
export default function AztecOrnament({ kind }: { kind: 'feathers' | 'serpent' }) {
  if (kind === 'serpent') {
    return (
      <img
        className="aztec-ornament aztec-serpent"
        src="/navBar.png"
        alt=""
        aria-hidden="true"
      />
    );
  }

  return (
    <svg
      className="aztec-ornament aztec-feathers"
      viewBox="0 0 100 72"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6 63C8 35 23 14 47 8C43 30 30 51 6 63ZM27 65C34 36 53 17 74 15C67 38 49 57 27 65ZM52 65C61 43 76 31 96 30C87 48 72 61 52 65Z" fill="currentColor" />
      <path d="M13 55L36 23M36 57L62 29M62 58L83 41" className="aztec-carving" strokeWidth="2" />
      <path d="M5 70H76" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
