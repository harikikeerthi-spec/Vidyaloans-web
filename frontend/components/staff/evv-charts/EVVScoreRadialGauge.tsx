"use client";

import React from "react";

interface EVVScoreRadialGaugeProps {
  score: number; // 0 - 100
  grade?: string; // A+, A, B, C, D, F
  risk?: string; // Low, Medium, High, Critical
  statusBand?: string; // Green, Amber, Red
  benchmark?: number; // e.g., 5000
  size?: number; // default 260
}

export const EVVScoreRadialGauge: React.FC<EVVScoreRadialGaugeProps> = ({
  score = 0,
  grade = "B",
  risk = "Low",
  statusBand = "Green",
  size = 260,
}) => {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));

  // Gauge geometry
  const radius = 95;
  const strokeWidth = 14;
  const cx = 140;
  const cy = 135;

  // Arc angles in degrees: from -210 deg to +30 deg (total 240 deg span)
  const startAngle = -210;
  const totalAngle = 240;
  const endAngle = startAngle + (clampedScore / 100) * totalAngle;

  const polarToCartesian = (centerX: number, centerY: number, r: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + r * Math.cos(angleInRadians),
      y: centerY + r * Math.sin(angleInRadians),
    };
  };

  const describeArc = (x: number, y: number, r: number, startA: number, endA: number) => {
    const start = polarToCartesian(x, y, r, endA);
    const end = polarToCartesian(x, y, r, startA);
    const largeArcFlag = endA - startA <= 180 ? "0" : "1";
    return ["M", start.x, start.y, "A", r, r, 0, largeArcFlag, 0, end.x, end.y].join(" ");
  };

  // Background track path
  const bgTrackPath = describeArc(cx, cy, radius, startAngle, startAngle + totalAngle);
  // Filled active score path
  const scorePath = clampedScore > 0 ? describeArc(cx, cy, radius, startAngle, endAngle) : "";

  // Pointer needle position
  const needlePoint = polarToCartesian(cx, cy, radius - 6, endAngle);

  // Status and theme colors
  const isGreen = clampedScore >= 70;
  const isAmber = clampedScore >= 40 && clampedScore < 70;
  const isRed = clampedScore < 40;

  const gradientColorStart = isGreen ? "#10B981" : isAmber ? "#F59E0B" : "#F43F5E";
  const gradientColorEnd = isGreen ? "#059669" : isAmber ? "#D97706" : "#E11D48";
  const ringColor = isGreen ? "#34D399" : isAmber ? "#FBBF24" : "#FB7185";

  // Ticks at 0, 25, 50, 75, 100
  const ticks = [0, 25, 50, 75, 100].map((val) => {
    const angle = startAngle + (val / 100) * totalAngle;
    const outerP = polarToCartesian(cx, cy, radius + 11, angle);
    const innerP = polarToCartesian(cx, cy, radius + 4, angle);
    const labelP = polarToCartesian(cx, cy, radius + 22, angle);
    return { val, outerP, innerP, labelP };
  });

  return (
    <div className="flex flex-col items-center justify-center relative select-none">
      <div className="relative" style={{ width: size, height: size * 0.78 }}>
        <svg viewBox="0 0 280 215" className="w-full h-full overflow-visible">
          <defs>
            {/* Dynamic Score Gradient */}
            <linearGradient id="scoreGaugeGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={gradientColorStart} />
              <stop offset="100%" stopColor={gradientColorEnd} />
            </linearGradient>

            {/* Glowing filter */}
            <filter id="gaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor={ringColor} floodOpacity="0.4" />
            </filter>

            {/* Pointer shadow */}
            <filter id="needleShadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0F172A" floodOpacity="0.25" />
            </filter>
          </defs>

          {/* Background Track Arc */}
          <path
            d={bgTrackPath}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Color Zone Segments Underlay (Red -> Amber -> Green markers) */}
          <path
            d={describeArc(cx, cy, radius, startAngle, startAngle + totalAngle * 0.4)}
            fill="none"
            stroke="#FEE2E2"
            strokeWidth={strokeWidth}
            strokeOpacity="0.6"
          />
          <path
            d={describeArc(cx, cy, radius, startAngle + totalAngle * 0.4, startAngle + totalAngle * 0.7)}
            fill="none"
            stroke="#FEF3C7"
            strokeWidth={strokeWidth}
            strokeOpacity="0.6"
          />
          <path
            d={describeArc(cx, cy, radius, startAngle + totalAngle * 0.7, startAngle + totalAngle)}
            fill="none"
            stroke="#D1FAE5"
            strokeWidth={strokeWidth}
            strokeOpacity="0.6"
          />

          {/* Active Score Arc */}
          {scorePath && (
            <path
              d={scorePath}
              fill="none"
              stroke="url(#scoreGaugeGrad)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              filter="url(#gaugeGlow)"
              className="transition-all duration-700 ease-out"
            />
          )}

          {/* Ticks and Labels */}
          {ticks.map((t, i) => (
            <g key={i}>
              <line
                x1={t.innerP.x}
                y1={t.innerP.y}
                x2={t.outerP.x}
                y2={t.outerP.y}
                stroke="#94A3B8"
                strokeWidth={t.val === 50 ? 2 : 1.5}
                strokeLinecap="round"
              />
              <text
                x={t.labelP.x}
                y={t.labelP.y + 3}
                textAnchor="middle"
                className="fill-slate-400 font-mono text-[9px] font-bold"
              >
                {t.val}
              </text>
            </g>
          ))}

          {/* Needle / Indicator Point */}
          <circle
            cx={needlePoint.x}
            cy={needlePoint.y}
            r="8"
            fill="#FFFFFF"
            stroke={gradientColorEnd}
            strokeWidth="3.5"
            filter="url(#needleShadow)"
            className="transition-all duration-700 ease-out"
          />
          <circle
            cx={needlePoint.x}
            cy={needlePoint.y}
            r="3"
            fill={gradientColorEnd}
            className="transition-all duration-700 ease-out"
          />

          {/* Center Hub Display */}
          <g className="select-none">
            <text
              x={cx}
              y={cy - 12}
              textAnchor="middle"
              className="text-4xl font-black fill-slate-900 tracking-tight font-mono"
            >
              {clampedScore}
            </text>
            <text
              x={cx + 34}
              y={cy - 24}
              textAnchor="start"
              className="text-xs font-black fill-slate-400 font-mono"
            >
              /100
            </text>
            <text
              x={cx}
              y={cy + 8}
              textAnchor="middle"
              className="text-[9px] font-black uppercase tracking-widest fill-slate-400"
            >
              EVV Score
            </text>
          </g>
        </svg>

        {/* Floating Grade & Status Badges */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2 -mb-1">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-violet-100 text-violet-800 border border-violet-200 shadow-2xs">
            Grade {grade}
          </span>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-2xs ${
              isGreen
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : isAmber
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-rose-50 text-rose-700 border-rose-200"
            }`}
          >
            {statusBand} Band • {risk} Risk
          </span>
        </div>
      </div>
    </div>
  );
};

export default EVVScoreRadialGauge;
