"use client";

import React, { useState } from "react";

export interface EVVClassificationDonutData {
  bouncesCount?: number;
  cashDepositsTotal?: number;
  digitalCreditsTotal?: number;
  passThroughTotal?: number;
  normalDebitsTotal?: number;
  salaryCreditsTotal?: number;
  digitalSalaryCredits?: number;
  otherOnlineCredits?: number;
  physicalCashDeposits?: number;
  atmCashWithdrawals?: number;
  otherDebits?: number;
}

export interface EVVClassificationDonutChartProps {
  data?: EVVClassificationDonutData;
  classification?: EVVClassificationDonutData | any;
  size?: number; // default 280
}

export const EVVClassificationDonutChart: React.FC<EVVClassificationDonutChartProps> = ({
  data,
  classification,
  size = 280,
}) => {
  const [chartType, setChartType] = useState<"bars" | "donut">("donut");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const src = data || classification;
  if (!src) return null;

  const salaryVal = src.salaryCreditsTotal ?? src.digitalSalaryCredits ?? 0;
  const onlineCreditsVal = src.digitalCreditsTotal ?? src.otherOnlineCredits ?? 0;
  const cashVal = src.cashDepositsTotal ?? src.physicalCashDeposits ?? 0;
  const passThroughVal = src.passThroughTotal ?? src.atmCashWithdrawals ?? 0;
  const debitsVal = src.normalDebitsTotal ?? src.otherDebits ?? 0;

  const slices = [
    {
      label: "Verified Salary Credits",
      value: salaryVal,
      color: "#4F46E5",
      gradStart: "#818CF8",
      gradEnd: "#4F46E5",
      icon: "account_balance",
      category: "credit",
    },
    {
      label: "Other Digital Credits",
      value: onlineCreditsVal,
      color: "#06B6D4",
      gradStart: "#22D3EE",
      gradEnd: "#0891B2",
      icon: "arrow_downward",
      category: "credit",
    },
    {
      label: "Physical Cash Deposits",
      value: cashVal,
      color: "#F59E0B",
      gradStart: "#FBBF24",
      gradEnd: "#D97706",
      icon: "payments",
      category: "cash",
    },
    {
      label: "Pass-Through / Outflows",
      value: passThroughVal,
      color: "#FB7185",
      gradStart: "#FDA4AF",
      gradEnd: "#E11D48",
      icon: "swap_horiz",
      category: "debit",
    },
    {
      label: "Regular Operating Debits",
      value: debitsVal,
      color: "#94A3B8",
      gradStart: "#CBD5E1",
      gradEnd: "#64748B",
      icon: "shopping_bag",
      category: "debit",
    },
  ];

  const totalVal = slices.reduce((acc, s) => acc + s.value, 0) || 1;
  const maxVal = Math.max(...slices.map((s) => s.value), 1);

  // SVG Donut geometry: 65% inner radius for modern thin ring
  const cx = 140;
  const cy = 140;
  const outerR = 120;
  const innerR = 80; // 66.6% inner radius

  let currentAngle = 0;
  const slicePaths = slices.map((slice) => {
    const angleSpan = (slice.value / totalVal) * 360;
    const startA = currentAngle;
    const endA = currentAngle + angleSpan;
    currentAngle = endA;

    const startRad = (startA * Math.PI) / 180;
    const endRad = (endA * Math.PI) / 180;

    const x1Outer = cx + outerR * Math.cos(startRad);
    const y1Outer = cy + outerR * Math.sin(startRad);
    const x2Outer = cx + outerR * Math.cos(endRad);
    const y2Outer = cy + outerR * Math.sin(endRad);

    const x1Inner = cx + innerR * Math.cos(startRad);
    const y1Inner = cy + innerR * Math.sin(startRad);
    const x2Inner = cx + innerR * Math.cos(endRad);
    const y2Inner = cy + innerR * Math.sin(endRad);

    const largeArc = angleSpan > 180 ? 1 : 0;

    const pathData = [
      `M ${x1Inner} ${y1Inner}`,
      `L ${x1Outer} ${y1Outer}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2Outer} ${y2Outer}`,
      `L ${x2Inner} ${y2Inner}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x1Inner} ${y1Inner}`,
      "Z",
    ].join(" ");

    return {
      pathData,
      slice,
      pct: ((slice.value / totalVal) * 100).toFixed(1),
    };
  });

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05),0_2px_4px_-1px_rgba(0,0,0,0.03)] space-y-4 select-none font-sans">
      {/* Header with Subtle Switcher */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#4F46E5] text-lg">donut_small</span>
            <h4 className="text-[13px] font-semibold text-[#475569] uppercase tracking-wider font-sans">
              Transaction Volume & Classification
            </h4>
          </div>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
            Breakdown of statement funds across digital salary, physical cash, and pass-through outflows
          </p>
        </div>

        {/* View Switcher: Soft Purple Active, Light Gray Unselected */}
        <div className="flex items-center bg-[#F1F5F9] p-1 rounded-xl gap-1">
          <button
            type="button"
            onClick={() => setChartType("donut")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              chartType === "donut"
                ? "bg-[#EEF2FF] text-[#4F46E5] shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span className="material-symbols-outlined text-sm">donut_large</span>
            <span>Donut</span>
          </button>
          <button
            type="button"
            onClick={() => setChartType("bars")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              chartType === "bars"
                ? "bg-[#EEF2FF] text-[#4F46E5] shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span className="material-symbols-outlined text-sm">bar_chart</span>
            <span>Bar Graph</span>
          </button>
        </div>
      </div>

      {/* MODE 1: DONUT CHART VIEW (DEFAULT) */}
      {chartType === "donut" ? (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
          {/* Donut Container with Floating Glass Tooltip */}
          <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
            <svg viewBox="0 0 280 280" className="w-full h-full transform -rotate-90 overflow-visible">
              <defs>
                {slices.map((s, idx) => (
                  <linearGradient key={idx} id={`donutGrad-${idx}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={s.gradStart} />
                    <stop offset="100%" stopColor={s.gradEnd} />
                  </linearGradient>
                ))}
                <filter id="donutHoverGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#6366F1" floodOpacity="0.4" />
                </filter>
              </defs>

              {slicePaths.map((item, idx) => {
                const isHovered = hoveredIdx === idx;
                const isDimmed = hoveredIdx !== null && !isHovered;

                return (
                  <path
                    key={idx}
                    d={item.pathData}
                    fill={`url(#donutGrad-${idx})`}
                    stroke="#FFFFFF"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    filter={isHovered ? "url(#donutHoverGlow)" : undefined}
                    className="transition-all duration-200 cursor-pointer"
                    style={{
                      opacity: isDimmed ? 0.65 : 1,
                      transform: isHovered ? "scale(1.02)" : "scale(1)",
                      transformOrigin: "140px 140px",
                    }}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  />
                );
              })}
            </svg>

            {/* Dynamic Center Aggregate Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
              {hoveredIdx !== null ? (
                <div className="animate-in fade-in zoom-in-95 duration-150 space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate max-w-[120px]">
                    {slices[hoveredIdx].label}
                  </span>
                  <span className="text-base font-extrabold text-slate-900 font-mono tracking-tight block">
                    ₹{Math.round(slices[hoveredIdx].value).toLocaleString("en-IN")}
                  </span>
                  <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 text-indigo-700">
                    {slicePaths[hoveredIdx].pct}% Share
                  </span>
                </div>
              ) : (
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Total Volume
                  </span>
                  <span className="text-base font-extrabold text-slate-900 font-mono tracking-tight block">
                    ₹{Math.round(totalVal).toLocaleString("en-IN")}
                  </span>
                  <span className="text-[10px] font-medium text-slate-400 block">
                    {slices.length} Categories
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Donut Legend Cards */}
          <div className="flex-1 space-y-2 w-full">
            {slices.map((item, idx) => {
              const isHovered = hoveredIdx === idx;
              const isDimmed = hoveredIdx !== null && !isHovered;
              const pct = ((item.value / totalVal) * 100).toFixed(1);

              return (
                <div
                  key={idx}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                    isHovered
                      ? "bg-indigo-50/60 border-indigo-200 shadow-xs"
                      : "bg-[#F8FAFC] border-slate-100 hover:bg-slate-100/60"
                  }`}
                  style={{ opacity: isDimmed ? 0.7 : 1 }}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3 h-3 rounded-full ring-2 ring-white"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs font-semibold text-slate-700">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold font-mono text-slate-900">
                      ₹{Math.round(item.value).toLocaleString("en-IN")}
                    </span>
                    <span className="text-[10px] font-medium font-mono text-slate-400">
                      ({pct}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* MODE 2: HORIZONTAL COMPARATIVE BARS VIEW */
        <div className="space-y-3 pt-1">
          {slices.map((item, idx) => {
            const isHovered = hoveredIdx === idx;
            const isDimmed = hoveredIdx !== null && !isHovered;
            const pct = ((item.value / totalVal) * 100).toFixed(1);
            const relativeBarPct = Math.round((item.value / maxVal) * 100);

            return (
              <div
                key={idx}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  isHovered
                    ? "bg-indigo-50/40 border-indigo-200 shadow-xs"
                    : "bg-[#F8FAFC] border-slate-100 hover:border-slate-200"
                }`}
                style={{ opacity: isDimmed ? 0.7 : 1 }}
              >
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black text-white shadow-2xs"
                      style={{ backgroundColor: item.color }}
                    >
                      <span className="material-symbols-outlined text-sm">{item.icon}</span>
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      {item.label}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                        item.category === "credit"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                          : item.category === "debit"
                          ? "bg-indigo-50 text-indigo-700 border border-indigo-200/60"
                          : "bg-amber-50 text-amber-700 border border-amber-200/60"
                      }`}
                    >
                      {item.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <span className="text-xs font-bold font-mono text-slate-900">
                      ₹{Math.round(item.value).toLocaleString("en-IN")}
                    </span>
                    <span className="px-2 py-0.5 rounded-lg text-xs font-bold font-mono bg-white text-slate-700 border border-slate-200/70">
                      {pct}%
                    </span>
                  </div>
                </div>

                {/* Progress Bar Track with Rounded Caps */}
                <div className="w-full h-2.5 bg-slate-200/60 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${relativeBarPct}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EVVClassificationDonutChart;
