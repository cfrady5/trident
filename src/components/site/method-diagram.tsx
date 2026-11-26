/**
 * Abstract Position · Build · Activate diagram: three measured stems rising
 * from the award baseline toward the market. Technical geometry only; this is
 * not, and must not become, a redrawing of the Trident mark.
 */
export function MethodDiagram({ className }: { className?: string }) {
  const stems = [
    { x: 150, top: 268, n: "01", label: "POSITION" },
    { x: 250, top: 196, n: "02", label: "BUILD" },
    { x: 350, top: 124, n: "03", label: "ACTIVATE" },
  ];
  const grid = Array.from({ length: 11 }, (_, i) => 40 + i * 40);
  return (
    <svg viewBox="0 0 480 480" className={className} role="img" aria-labelledby="method-diagram-title">
      <title id="method-diagram-title">From the award to the market through Position, Build and Activate</title>
      <defs>
        <linearGradient id="sig" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#FBD474" />
          <stop offset="0.5" stopColor="#E6A73B" />
          <stop offset="1" stopColor="#996304" />
        </linearGradient>
      </defs>
      <g stroke="#2A2620" strokeWidth="1">
        {grid.map((v) => <line key={`v${v}`} x1={v} y1="40" x2={v} y2="440" />)}
        {grid.map((v) => <line key={`h${v}`} x1="40" y1={v} x2="440" y2={v} />)}
      </g>
      <line x1="40" y1="400" x2="440" y2="400" stroke="#7C7A75" strokeWidth="1" />
      {stems.map((s) => (
        <g key={s.n}>
          <line x1={s.x} y1="400" x2={s.x} y2={s.top} stroke="#F7F3EA" strokeWidth="1.5" />
          <rect x={s.x - 5} y={s.top - 5} width="10" height="10" fill="#000" stroke="#E6A73B" strokeWidth="1.5" transform={`rotate(45 ${s.x} ${s.top})`} />
          <text x={s.x - 10} y={s.top - 26} fill="#E6A73B" fontFamily="IBM Plex Mono, monospace" fontSize="10" letterSpacing="1.2" textAnchor="end">{s.n}</text>
          <text x={s.x - 10} y={s.top - 12} fill="#ADAAA4" fontFamily="IBM Plex Mono, monospace" fontSize="10" letterSpacing="1.2" textAnchor="end">{s.label}</text>
        </g>
      ))}
      <path d="M60 400 L150 268 L250 196 L350 124 L420 72" fill="none" stroke="url(#sig)" strokeWidth="2" />
      <path d="M60 400 L150 268 L250 196 L350 124 L420 72" fill="none" stroke="#FBD474" strokeWidth="2.5" strokeDasharray="28 466" className="animate-trace" />
      <circle cx="60" cy="400" r="4" fill="#F7F3EA" />
      <circle cx="420" cy="72" r="4" fill="#FBD474" />
      <text x="60" y="425" fill="#ADAAA4" fontFamily="IBM Plex Mono, monospace" fontSize="10" letterSpacing="1.2">A · THE AWARD</text>
      <text x="420" y="58" fill="#FBD474" fontFamily="IBM Plex Mono, monospace" fontSize="10" letterSpacing="1.2" textAnchor="end">B · THE MARKET</text>
    </svg>
  );
}
