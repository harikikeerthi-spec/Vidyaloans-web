"use client";

import React, { useState } from "react";
import { type EVV6ComponentResult } from "@/lib/evv-parser";

export interface EVV6ComponentBarChartProps {
  sixComponent?: EVV6ComponentResult | any;
  sixComponents?: EVV6ComponentResult | any;
  className?: string;
}

export const EVV6ComponentBarChart: React.FC<EVV6ComponentBarChartProps> = ({
  sixComponent,
  sixComponents,
  className = "",
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [layoutMode, setLayoutMode] = useState<"columns" | "horizontal">("columns");

  const data = sixComponent || sixComponents;
  if (!data) return null;

  const c1 = data.component1;
  const c2 = data.component2;
  const c3 = data.component3;
  const c4 = data.component4;
  const c5 = data.component5;
  const c6 = data.component6;

  const items = [
    {
      code: "C1",
      title: c1?.name || "AMB Benchmark & Inflow",
      shortName: "Balance Trend",
      score: c1?.score || 0,
      maxScore: c1?.maxScore || c1?.maxPoints || 25,
      ratio: (c1?.score || 0) / (c1?.maxScore || c1?.maxPoints || 25),
      evidence: c1?.sixMonthSampledAMB !== undefined ? `6M AMB ₹${Math.round(c1.sixMonthSampledAMB).toLocaleString('en-IN')}` : `AMB: ₹${Math.round(c1?.ambBalance || 0).toLocaleString("en-IN")}`,
      color: "#4F46E5",
      gradStart: "#818CF8",
      gradEnd: "#4F46E5",
      gradId: "c1BarGrad",
    },
    {
      code: "C2",
      title: c2?.name || "Minimum-Balance Safety",
      shortName: "Min-Bal Safety",
      score: c2?.score || 0,
      maxScore: c2?.maxScore || c2?.maxPoints || 20,
      ratio: (c2?.score || 0) / (c2?.maxScore || c2?.maxPoints || 20),
      evidence: c2?.finalSafetyRatio !== undefined ? `Safety Ratio: ${c2.finalSafetyRatio}%` : `Vol CV: ${c2?.volatilityCV?.toFixed(2) || "—"}`,
      color: "#06B6D4",
      gradStart: "#22D3EE",
      gradEnd: "#0891B2",
      gradId: "c2BarGrad",
    },
    {
      code: "C3",
      title: c3?.name || "Bounce-Free Record",
      shortName: "Bounce Record",
      score: c3?.score || 0,
      maxScore: c3?.maxScore || c3?.maxPoints || 20,
      ratio: (c3?.score || 0) / (c3?.maxScore || c3?.maxPoints || 20),
      evidence: c3?.confirmedBounces !== undefined ? `${c3.confirmedBounces} Bounces` : `${c3?.salaryCount || 0} credits detected`,
      color: (c3?.confirmedBounces || 0) > 0 ? "#FB7185" : "#10B981",
      gradStart: (c3?.confirmedBounces || 0) > 0 ? "#FB7185" : "#34D399",
      gradEnd: (c3?.confirmedBounces || 0) > 0 ? "#E11D48" : "#059669",
      gradId: "c3BarGrad",
    },
    {
      code: "C4",
      title: c4?.name || "Verified Inflow Regularity",
      shortName: "Inflow Regularity",
      score: c4?.isRepaymentIncomeContributor === 'NO' ? 15 : (typeof c4?.score === 'number' ? c4.score : 0),
      maxScore: c4?.maxScore || c4?.maxPoints || 15,
      ratio: (c4?.score || 0) / (c4?.maxScore || c4?.maxPoints || 15),
      evidence: c4?.isRepaymentIncomeContributor === 'NO' ? "Non-Contributor (Scaled)" : (c4?.recurringMonthsCount !== undefined ? `${c4.recurringMonthsCount}/6 mos verified` : `Bounces: ${c4?.bounceCount || 0}`),
      color: "#F59E0B",
      gradStart: "#FBBF24",
      gradEnd: "#D97706",
      gradId: "c4BarGrad",
    },
    {
      code: "C5",
      title: c5?.name || "Cash-Deposit Ratio",
      shortName: "Cash Ratio",
      score: c5?.score || 0,
      maxScore: c5?.maxScore || c5?.maxPoints || 10,
      ratio: (c5?.score || 0) / (c5?.maxScore || c5?.maxPoints || 10),
      evidence: c5?.cashRatio !== undefined ? `Cash: ${Math.round(c5.cashRatio * 100)}%` : `Cash %: ${c5?.cashRatioPercent?.toFixed(1) || 0}%`,
      color: ((c5?.cashRatio || 0) > 0.2 || (c5?.cashRatioPercent || 0) > 20) ? "#F59E0B" : "#10B981",
      gradStart: ((c5?.cashRatio || 0) > 0.2 || (c5?.cashRatioPercent || 0) > 20) ? "#FBBF24" : "#34D399",
      gradEnd: ((c5?.cashRatio || 0) > 0.2 || (c5?.cashRatioPercent || 0) > 20) ? "#D97706" : "#059669",
      gradId: "c5BarGrad",
    },
    {
      code: "C6",
      title: c6?.name || "Withdrawal Discipline",
      shortName: "Withdrawal Disc.",
      score: c6?.score || 0,
      maxScore: c6?.maxScore || c6?.maxPoints || 10,
      ratio: (c6?.score || 0) / (c6?.maxScore || c6?.maxPoints || 10),
      evidence: c6?.passThroughEvents ? `${c6.passThroughEvents.length} Pass-throughs` : `Pass-thru: ${c6?.rapidPassThroughCount || 0}`,
      color: "#8B5CF6",
      gradStart: "#A78BFA",
      gradEnd: "#6D28D9",
      gradId: "c6BarGrad",
    },
  ];

  const totalScored = items.reduce((s, it) => s + it.score, 0);
  const totalMax = items.reduce((s, it) => s + it.maxScore, 0);
  const passingComponents = items.filter((it) => it.ratio >= 0.7).length;

  const width = 720;
  const height = 270;
  const padding = { left: 60, right: 88, top: 32, bottom: 48 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const barSlotW = chartW / items.length;
  const barW = Math.min(46, barSlotW * 0.58);
  const benchmarkY = height - padding.bottom - 0.7 * chartH;

  return (
    <div
      className={`bg-white border border-[#E2E8F0] rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05),0_2px_4px_-1px_rgba(0,0,0,0.03)] space-y-4 select-none font-sans ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#4F46E5] text-lg">equalizer</span>
            <h4 className="text-[13px] font-semibold text-[#475569] uppercase tracking-wider font-sans">
              6-Component Underwriting Bar Graph
            </h4>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EEF2FF] text-[#4F46E5] border border-[#E0E7FF]">
              {passingComponents}/6 Met 70% Target
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
            Component score realization vs. maximum points with 70% benchmark threshold
          </p>
        </div>

        {/* Layout Switcher */}
        <div className="flex items-center bg-[#F1F5F9] p-1 rounded-xl gap-1">
          <button
            type="button"
            onClick={() => setLayoutMode("columns")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              layoutMode === "columns"
                ? "bg-[#EEF2FF] text-[#4F46E5] shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span className="material-symbols-outlined text-sm">bar_chart</span>
            <span>Vertical Columns</span>
          </button>
          <button
            type="button"
            onClick={() => setLayoutMode("horizontal")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              layoutMode === "horizontal"
                ? "bg-[#EEF2FF] text-[#4F46E5] shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span className="material-symbols-outlined text-sm">view_stream</span>
            <span>Horizontal Bars</span>
          </button>
        </div>
      </div>

      {/* MODE 1: VERTICAL COLUMNS SVG BAR GRAPH */}
      {layoutMode === "columns" ? (
        <div className="relative w-full overflow-x-auto scrollbar-hide py-1">
          {/* Floating Interactive Tooltip */}
          {hoveredIdx !== null && items[hoveredIdx] && (
            <div
              className="absolute pointer-events-none z-30 transition-all duration-150 ease-out"
              style={{
                left: `${((padding.left + hoveredIdx * barSlotW + barSlotW / 2) / width) * 100}%`,
                top: `${((height - padding.bottom - items[hoveredIdx].ratio * chartH) / height) * 100}%`,
                transform:
                  hoveredIdx < 2
                    ? "translate(4%, -115%)"
                    : hoveredIdx > 3
                    ? "translate(-104%, -115%)"
                    : "translate(-50%, -115%)",
              }}
            >
              <div className="bg-[#1E293B]/95 backdrop-blur-[8px] text-white rounded-[8px] p-2.5 px-3.5 shadow-xl border border-white/10 space-y-1 select-none min-w-[150px]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                  {items[hoveredIdx].code} • {items[hoveredIdx].shortName}
                </p>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-bold text-white font-mono">
                    {items[hoveredIdx].score} / {items[hoveredIdx].maxScore} pts
                  </span>
                  <span className="text-xs font-bold text-indigo-300 font-mono">
                    {Math.round(items[hoveredIdx].ratio * 100)}%
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10 text-[9.5px]">
                  <span className="text-slate-300 truncate max-w-[110px]">{items[hoveredIdx].evidence}</span>
                  <span
                    className={`font-bold ${
                      items[hoveredIdx].ratio >= 0.7 ? "text-emerald-400" : "text-amber-400"
                    }`}
                  >
                    {items[hoveredIdx].ratio >= 0.7 ? "Passed" : "Below 70%"}
                  </span>
                </div>
              </div>
            </div>
          )}

          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[580px] overflow-visible">
            <defs>
              {items.map((item) => (
                <linearGradient key={item.gradId} id={item.gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={item.gradStart} />
                  <stop offset="100%" stopColor={item.gradEnd} />
                </linearGradient>
              ))}
              <filter id="cBarHoverGlow" x="-30%" y="-20%" width="160%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#6366F1" floodOpacity="0.45" />
              </filter>
              <filter id="bench70Glow" x="-20%" y="-40%" width="140%" height="180%">
                <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#F59E0B" floodOpacity="0.45" />
              </filter>
            </defs>

            {/* Faint Horizontal Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
              const y = height - padding.bottom - pct * chartH;
              return (
                <g key={i}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={width - padding.right}
                    y2={y}
                    stroke="#F1F5F9"
                    strokeDasharray="4 4"
                    strokeWidth="1.2"
                  />
                  <text
                    x={padding.left - 12}
                    y={y + 3.5}
                    textAnchor="end"
                    className="fill-[#94A3B8] font-sans text-[11px] font-medium"
                  >
                    {Math.round(pct * 100)}%
                  </text>
                </g>
              );
            })}

            {/* 70% Target Benchmark reference line with Right-Axis Pill Badge */}
            <g>
              <line
                x1={padding.left}
                y1={benchmarkY}
                x2={width - padding.right}
                y2={benchmarkY}
                stroke="#F59E0B"
                strokeDasharray="5 5"
                strokeWidth="1.5"
                filter="url(#bench70Glow)"
              />
              <g transform={`translate(${width - padding.right + 6}, ${benchmarkY - 9})`}>
                <rect
                  width="76"
                  height="18"
                  rx="5"
                  fill="#FEF3C7"
                  stroke="#F59E0B"
                  strokeWidth="1"
                  strokeOpacity="0.5"
                />
                <text
                  x="38"
                  y="12.5"
                  textAnchor="middle"
                  className="fill-amber-700 font-sans text-[9px] font-bold tracking-tight"
                >
                  Target: 70%
                </text>
              </g>
            </g>

            {/* Bars */}
            {items.map((item, idx) => {
              const slotCenter = padding.left + idx * barSlotW + barSlotW / 2;
              const barH = Math.max(4, item.ratio * chartH);
              const barY = height - padding.bottom - barH;
              const isHovered = hoveredIdx === idx;
              const isDimmed = hoveredIdx !== null && !isHovered;

              return (
                <g
                  key={idx}
                  className="cursor-pointer transition-opacity duration-200"
                  style={{ opacity: isDimmed ? 0.7 : 1 }}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                >
                  {/* Background Track (rx=4) */}
                  <rect
                    x={slotCenter - barW / 2}
                    y={padding.top}
                    width={barW}
                    height={chartH}
                    rx="4"
                    fill="rgba(241, 245, 249, 0.45)"
                  />

                  {/* Scored Bar with Vertical Gradient & Rounded Top Caps (rx=4) */}
                  <rect
                    x={slotCenter - barW / 2}
                    y={barY}
                    width={barW}
                    height={barH}
                    rx="4"
                    fill={`url(#${item.gradId})`}
                    filter={isHovered ? "url(#cBarHoverGlow)" : undefined}
                    className="transition-all duration-200"
                  />

                  {/* Value tag on top of bar */}
                  <text
                    x={slotCenter}
                    y={Math.max(padding.top - 6, barY - 7)}
                    textAnchor="middle"
                    className={`font-sans text-[10px] font-bold transition-all ${
                      isHovered ? "fill-[#4F46E5] font-extrabold" : "fill-slate-600"
                    }`}
                  >
                    {item.score}/{item.maxScore}
                  </text>

                  {/* X-axis component code & title */}
                  <text
                    x={slotCenter}
                    y={height - padding.bottom + 18}
                    textAnchor="middle"
                    className={`font-sans text-[11px] font-bold transition-colors ${
                      isHovered ? "fill-[#4F46E5]" : "fill-slate-700"
                    }`}
                  >
                    {item.code}
                  </text>
                  <text
                    x={slotCenter}
                    y={height - padding.bottom + 31}
                    textAnchor="middle"
                    className="font-sans text-[9px] font-medium fill-[#94A3B8]"
                  >
                    {item.shortName}
                  </text>
                </g>
              );
            })}

            {/* Baseline */}
            <line
              x1={padding.left}
              y1={height - padding.bottom}
              x2={width - padding.right}
              y2={height - padding.bottom}
              stroke="#F1F5F9"
              strokeWidth="1"
            />
          </svg>
        </div>
      ) : (
        /* MODE 2: HORIZONTAL PROGRESS BARS VIEW */
        <div className="space-y-3 pt-1">
          {items.map((item, idx) => {
            const isHovered = hoveredIdx === idx;
            const isDimmed = hoveredIdx !== null && !isHovered;
            const pct = Math.round(item.ratio * 100);

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
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1.5 mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shadow-2xs"
                      style={{ backgroundColor: item.color }}
                    >
                      {item.code}
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      {item.title}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400">
                      • {item.evidence}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <span className="text-xs font-bold font-mono text-slate-900">
                      {item.score} <span className="text-[10px] text-slate-400 font-normal">/ {item.maxScore} pts</span>
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono ${
                        pct >= 70
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                          : "bg-amber-50 text-amber-700 border border-amber-200/60"
                      }`}
                    >
                      {pct}%
                    </span>
                  </div>
                </div>

                {/* Relative Progress Track with 70% threshold marker */}
                <div className="relative w-full h-2.5 bg-slate-200/60 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: item.color,
                    }}
                  />
                  {/* 70% Target threshold indicator */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-amber-500 z-10"
                    style={{ left: "70%" }}
                    title="70% Approval Benchmark"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Summary Pill Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
        <div className="p-3 bg-[#F8FAFC] rounded-xl border border-slate-100">
          <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">Aggregate Realized</span>
          <span className="text-sm font-extrabold text-slate-900 font-mono tracking-tight">
            {totalScored} <span className="text-[10px] text-slate-400 font-normal">/ {totalMax} pts</span>
          </span>
        </div>
        <div className="p-3 bg-[#F8FAFC] rounded-xl border border-slate-100">
          <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">Overall Percentage</span>
          <span className="text-sm font-extrabold text-[#4F46E5] font-mono tracking-tight">
            {Math.round((totalScored / (totalMax || 1)) * 100)}%
          </span>
        </div>
        <div className="p-3 bg-[#F8FAFC] rounded-xl border border-slate-100">
          <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">Passing Rate</span>
          <span className="text-sm font-extrabold text-emerald-600 font-mono tracking-tight">
            {passingComponents} of 6 Components
          </span>
        </div>
        <div className="p-3 bg-[#F8FAFC] rounded-xl border border-slate-100">
          <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">Standard Threshold</span>
          <span className="text-sm font-extrabold text-amber-600 font-mono tracking-tight">
            70% Benchmark Met
          </span>
        </div>
      </div>
    </div>
  );
};

export default EVV6ComponentBarChart;
