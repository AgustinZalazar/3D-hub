interface FilamentSpoolProps {
  colorHex: string | null;
  pct: number;
  size?: number;
}

export function FilamentSpool({ colorHex, pct, size = 72 }: FilamentSpoolProps) {
  const cx = size / 2;
  const cy = size / 2;

  const outerR   = size * 0.46;
  const trackR   = size * 0.355;
  const trackW   = size * 0.145;
  const hubR     = size * 0.135;
  const holeR    = size * 0.063;
  const spokeIn  = hubR + 1.5;
  const spokeOut = trackR - trackW / 2 - 2;

  const circumference = 2 * Math.PI * trackR;
  const filled = Math.max(0, Math.min(100, pct)) / 100 * circumference;
  const spoolColor = colorHex ?? "#d1d5db";

  const spokes = [90, 210, 330].map((deg) => {
    const rad = (deg * Math.PI) / 180;
    return {
      x1: cx + Math.cos(rad) * spokeIn,
      y1: cy + Math.sin(rad) * spokeIn,
      x2: cx + Math.cos(rad) * spokeOut,
      y2: cy + Math.sin(rad) * spokeOut,
    };
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      aria-hidden="true"
    >
      {/* Outer flange ring */}
      <circle cx={cx} cy={cy} r={outerR}
        stroke="var(--border)" strokeWidth="1.2" />

      {/* Empty track */}
      <circle cx={cx} cy={cy} r={trackR}
        stroke="var(--border-subtle)" strokeWidth={trackW} />

      {/* Filament fill */}
      {pct > 1 && (
        <circle
          cx={cx} cy={cy} r={trackR}
          stroke={spoolColor}
          strokeWidth={trackW}
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="butt"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ opacity: 0.92 }}
        />
      )}

      {/* Spokes between hub and track */}
      {spokes.map((s, i) => (
        <line key={i}
          x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
          stroke="var(--border)"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      ))}

      {/* Hub disc */}
      <circle cx={cx} cy={cy} r={hubR}
        fill="var(--border-subtle)"
        stroke="var(--border)" strokeWidth="1" />

      {/* Center hole */}
      <circle cx={cx} cy={cy} r={holeR}
        fill="var(--card-bg)"
        stroke="var(--border)" strokeWidth="1" />
    </svg>
  );
}
