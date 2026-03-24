"use client";

/**
 * EvenlyLogo — three-equal-bars mark + wordmark.
 *
 * Props:
 *   size      "sm" | "md" | "lg" | "xl"
 *   variant   "full" | "mark"
 *   theme     "auto" | "dark" | "light"
 *
 * "auto"  reads CSS vars — works in light and dark mode.
 * "dark"  light-on-dark (hero cards, splash screens, story slides).
 * "light" dark-on-light (white bg exports, onboarding).
 */

const SIZES = {
  sm: { mark: 26, wordSize: 14, gap: 7, ls: "-0.3px" },
  md: { mark: 34, wordSize: 18, gap: 9, ls: "-0.5px" },
  lg: { mark: 46, wordSize: 24, gap: 11, ls: "-0.7px" },
  xl: { mark: 62, wordSize: 32, gap: 14, ls: "-1.1px" },
};

const PALETTES = {
  auto: {
    bg: "#2A3E32",
    bars: "#E1F9D8",
    text: "var(--accent-strong, #2A3E32)",
  },
  dark: {
    bg: "#2A3E32",
    bars: "#E1F9D8",
    text: "#ffffff",
  },
  light: {
    bg: "#2A3E32",
    bars: "#E1F9D8",
    text: "#2A3E32",
  },
};

function Mark({ size, bg, bars }) {
  const r  = Math.round(size * 0.27);
  const bW = Math.round(size * 0.585);
  const bH = Math.round(size * 0.073);
  const bR = bH / 2;
  const x  = Math.round((size - bW) / 2);
  // Three bars: total visual band = 3*bH + 2*gap. Gap chosen so it looks airy.
  const gap = Math.round(size * 0.161);
  const totalH = bH * 3 + gap * 2;
  const y0 = Math.round((size - totalH) / 2);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0, display: "block" }}
    >
      {/* Background tile */}
      <rect width={size} height={size} rx={r} fill={bg} />
      {/* Top-left shine */}
      <rect width={size} height={size} rx={r} fill="url(#sh)" opacity="0.22" />
      {/* Three equal bars */}
      <rect x={x} y={y0}              width={bW} height={bH} rx={bR} fill={bars} />
      <rect x={x} y={y0 + gap + bH}   width={bW} height={bH} rx={bR} fill={bars} />
      <rect x={x} y={y0 + gap*2 + bH*2} width={bW} height={bH} rx={bR} fill={bars} />
      <defs>
        <linearGradient id="sh" x1="0" y1="0" x2={size} y2={size} gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="white" />
          <stop offset="100%" stopColor="black" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function EvenlyLogo({ size = "md", variant = "mark", theme = "auto" }) {
  const s = SIZES[size] || SIZES.md;
  const p = PALETTES[theme] || PALETTES.auto;

  if (variant === "mark") {
    return <Mark size={s.mark} bg={p.bg} bars={p.bars} />;
  }

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: `${s.gap}px`,
        userSelect: "none",
      }}
      aria-label="Evenly"
      role="img"
    >
      <Mark size={s.mark} bg={p.bg} bars={p.bars} />
      <span
        style={{
          fontFamily: "Tiempos Headline, Georgia, 'Times New Roman', serif",
          fontSize: `${s.wordSize}px`,
          fontWeight: 600,
          letterSpacing: s.ls,
          color: p.text,
          lineHeight: 1,
          paddingTop: "1px",
        }}
      >
        evenly
      </span>
    </div>
  );
}
