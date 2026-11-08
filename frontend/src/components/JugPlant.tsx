"use client";

import React from "react";

interface JugPlantProps {
  bufferLeft: number;
  target6mo: number;
  gap: number;
  runway: number;
  durationMonths: number;
  monthlySave: number;
  totalCuts: number;
}

export const JugPlant: React.FC<JugPlantProps> = ({
  bufferLeft,
  target6mo,
  gap,
  runway,
  durationMonths,
  monthlySave,
  totalCuts,
}) => {
  // 1. Water Fill Level (0 to 100%)
  const fillPct = target6mo > 0 ? Math.min(Math.max((bufferLeft / target6mo) * 100, 0), 100) : 0;
  const isBufferDepleted = bufferLeft <= 0;
  const isUnderShockDanger = runway < durationMonths;

  // Water Color: healthy cyan/blue, warning amber, critical red
  const waterColor = isBufferDepleted
    ? "#ef4444"
    : isUnderShockDanger
    ? "#f59e0b"
    : "#0ea5e9";

  // Inflow stream: active if saving or making cuts
  const inflowActive = monthlySave > 0 || totalCuts > 0;
  const streamWidth = Math.min(Math.max(2 + (monthlySave + totalCuts) / 250, 3), 10);

  // Leak rate: active if there is a gap (deficit)
  const isLeaking = gap > 0;

  // 2. Plant Height & Health
  const plantProgress = durationMonths > 0 ? Math.min(runway / durationMonths, 2.0) : 1;
  const stemHeight = Math.max(30, Math.min(plantProgress * 80, 130)); // 30px to 130px
  const leafCount = Math.min(Math.max(Math.floor(runway), 0), 12);
  const isWilting = runway < durationMonths;
  const isFlowering = runway >= 6.0 && bufferLeft >= target6mo * 0.9;

  const stemColor = isWilting ? "#92400e" : "#16a34a";
  const leafColor = isWilting ? "#b45309" : "#22c55e";

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col items-center">
      <div className="w-full flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            🌱 The Resilience Metaphor
          </h3>
          <p className="text-xs text-slate-400">
            Water in the jug = Savings buffer · The plant = Customer survival
          </p>
        </div>
        <div className="text-right">
          <span
            className={`px-3 py-1 text-xs font-semibold rounded-full border ${
              isWilting
                ? "bg-red-950/60 border-red-500/40 text-red-300"
                : "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
            }`}
          >
            {isWilting ? "⚠️ Resilience at Risk" : "🌿 Plant Flourishing"}
          </span>
        </div>
      </div>

      {/* SVG Canvas */}
      <svg
        viewBox="0 0 420 280"
        className="w-full max-w-[460px] h-[240px] overflow-visible"
      >
        <defs>
          <linearGradient id="waterGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={waterColor} stopOpacity="0.85" />
            <stop offset="100%" stopColor={waterColor} stopOpacity="0.5" />
          </linearGradient>

          <linearGradient id="jugGlass" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.3" />
          </linearGradient>

          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="glow" />
            <feComposite in="SourceGraphic" in2="glow" operator="over" />
          </filter>
        </defs>

        {/* ── LEFT: SAVINGS JUG ────────────────────────────────────────── */}
        <g transform="translate(40, 20)">
          {/* Inflow Tap & Pouring Stream */}
          {inflowActive && (
            <g className="transition-all duration-300">
              {/* Pipe top */}
              <rect x="52" y="0" width="20" height="12" rx="3" fill="#64748b" />
              {/* Animated stream */}
              <path
                d={`M 62 12 Q 62 40 62 70`}
                stroke="#38bdf8"
                strokeWidth={streamWidth}
                strokeLinecap="round"
                opacity="0.8"
                className="animate-pulse"
              />
            </g>
          )}

          {/* Jug Handle */}
          <path
            d="M 24 80 C -5 80 -5 160 24 170"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.7"
          />

          {/* Water Inside Jug */}
          <clipPath id="jugClip">
            <path d="M 28 65 L 96 65 L 110 200 C 110 215 14 215 14 200 Z" />
          </clipPath>

          <g clipPath="url(#jugClip)">
            <rect
              x="0"
              y={200 - (fillPct / 100) * 135}
              width="130"
              height="200"
              fill="url(#waterGrad)"
              className="transition-all duration-700 ease-out"
            />
            {/* Water surface ripple */}
            {fillPct > 0 && (
              <ellipse
                cx="62"
                cy={200 - (fillPct / 100) * 135}
                rx="42"
                ry="4"
                fill="#ffffff"
                opacity="0.3"
              />
            )}
          </g>

          {/* Jug Glass Outline */}
          <path
            d="M 28 65 L 96 65 L 110 200 C 110 215 14 215 14 200 Z"
            fill="url(#jugGlass)"
            stroke="#94a3b8"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />

          {/* Fill graduation tick marks */}
          <line x1="28" y1="132" x2="38" y2="132" stroke="#cbd5e1" strokeWidth="1.5" opacity="0.6" />
          <text x="42" y="135" fill="#94a3b8" fontSize="8" fontFamily="sans-serif">3 mo</text>

          <line x1="26" y1="68" x2="36" y2="68" stroke="#cbd5e1" strokeWidth="1.5" opacity="0.6" />
          <text x="40" y="71" fill="#94a3b8" fontSize="8" fontFamily="sans-serif">6 mo</text>

          {/* Deficit Leak at Bottom of Jug */}
          {isLeaking && (
            <g className="animate-bounce">
              <circle cx="62" cy="222" r="3" fill={waterColor} opacity="0.8" />
              <circle cx="62" cy="232" r="2.5" fill={waterColor} opacity="0.6" />
            </g>
          )}

          {/* Label below Jug */}
          <text
            x="62"
            y="245"
            textAnchor="middle"
            fill="#e2e8f0"
            fontSize="11"
            fontWeight="600"
          >
            Buffer: ${bufferLeft.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </text>
          <text
            x="62"
            y="258"
            textAnchor="middle"
            fill="#94a3b8"
            fontSize="9"
          >
            {fillPct.toFixed(0)}% of 6-mo goal
          </text>
        </g>

        {/* ── CONNECTOR PIPE / TROUGH ───────────────────────────────────── */}
        <path
          d="M 150 200 C 180 200 190 200 220 200"
          stroke="#475569"
          strokeWidth="3"
          strokeDasharray="4 3"
          opacity="0.5"
        />

        {/* ── RIGHT: THE RESILIENCE PLANT ──────────────────────────────── */}
        <g transform="translate(240, 20)">
          {/* Pot (Terracotta) */}
          <polygon
            points="45,175 95,175 88,215 52,215"
            fill={isBufferDepleted ? "#78350f" : "#b45309"}
            stroke="#d97706"
            strokeWidth="2"
          />
          {/* Pot Rim */}
          <rect x="42" y="169" width="56" height="7" rx="2" fill="#d97706" />

          {/* Pot Cracks if Buffer <= 0 */}
          {isBufferDepleted && (
            <path
              d="M 55 175 L 62 190 L 58 200 L 66 215 M 80 178 L 76 195 L 82 210"
              stroke="#ef4444"
              strokeWidth="2"
              fill="none"
            />
          )}

          {/* Plant Stem (Curved, drooping if wilting) */}
          <path
            d={
              isWilting
                ? `M 70 170 C 70 140 40 120 35 ${170 - stemHeight}`
                : `M 70 170 C 70 130 70 100 70 ${170 - stemHeight}`
            }
            fill="none"
            stroke={stemColor}
            strokeWidth="5"
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />

          {/* Procedural Leaves based on runway months (up to 12) */}
          {Array.from({ length: Math.min(leafCount, 8) }).map((_, i) => {
            const side = i % 2 === 0 ? 1 : -1;
            const yPos = 170 - (i + 1) * 12;
            const droop = isWilting ? 12 : -6;
            return (
              <g
                key={i}
                transform={`translate(70, ${yPos})`}
                className="transition-all duration-500 ease-out"
              >
                <path
                  d={`M 0 0 C ${side * 18} -4 ${side * 24} ${droop} ${side * 28} ${droop + 6} C ${side * 18} ${droop + 10} ${side * 8} 6 0 0`}
                  fill={leafColor}
                  opacity="0.9"
                />
              </g>
            );
          })}

          {/* Blooming Flowers at top if 6+ months buffer maintained */}
          {isFlowering && (
            <g
              transform={`translate(70, ${170 - stemHeight})`}
              className="animate-pulse"
            >
              <circle cx="-6" cy="-6" r="5" fill="#f43f5e" />
              <circle cx="6" cy="-6" r="5" fill="#f43f5e" />
              <circle cx="0" cy="-12" r="5" fill="#f43f5e" />
              <circle cx="0" cy="-6" r="4" fill="#fbbf24" />
            </g>
          )}

          {/* Label below Plant */}
          <text
            x="70"
            y="245"
            textAnchor="middle"
            fill="#e2e8f0"
            fontSize="11"
            fontWeight="600"
          >
            Runway: {runway} mo
          </text>
          <text
            x="70"
            y="258"
            textAnchor="middle"
            fill={isWilting ? "#f87171" : "#4ade80"}
            fontSize="9"
            fontWeight="bold"
          >
            {isWilting
              ? `Short by ${(durationMonths - runway).toFixed(1)} mo`
              : `Survives ${durationMonths} mo shock`}
          </text>
        </g>
      </svg>
    </div>
  );
};

