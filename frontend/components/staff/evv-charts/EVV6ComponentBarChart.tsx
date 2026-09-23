"use client";

import React, { useState } from "react";
import { type EVV6ComponentResult } from "@/lib/evv-parser";

interface EVV6ComponentBarChartProps {
  sixComponent: EVV6ComponentResult;
  className?: string;
}

export const EVV6ComponentBarChart: React.FC<EVV6ComponentBarChartProps> = ({
  sixComponent,
  className = "",
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [layoutMode, setLayoutMode] = useState<"columns" | "horizontal">("columns");

  if (!sixComponent) return null;

  const { component1: c1, component2: c2, component3: c3, component4: c4, component5: c5, component6: c6 } = sixComponent;

  const c4ScoreNum = c4?.isRepaymentIncomeContributor === "NO" ? 15 : (typeof c4?.score === "number" ? c4.score : 0);

  const items = [
    {
      id: "c1",
      code: "C1",
      title: "Sampled AMB Dynamics",
      shortTitle: "AMB Dynamics",
      score: c1?.score ?? 0,
      maxScore: c1?.maxScore ?? 25,
      ratio: Math.min(1, Math.max(0, (c1?.score ?? 0) / (c1?.maxScore || 25))),
      evidence: `6-Mo AMB: ₹${Number(c1?.sixMonthSampledAMB ?? 0).toLocaleString("en-IN")}`,
      color: "#8B5CF6", // Violet
      gradId: "gradC1",
      gradStart: "#8B5CF6",
      gradEnd: "#6D28D9",
    },
    {
      id: "c2",
      code: "C2",
      title: "Min-Balance Safety Ratio",
      shortTitle: "Safety Ratio",
      score: c2?.score ?? 0,
      maxScore: c2?.maxScore ?? 20,
      ratio: Math.min(1, Math.max(0, (c2?.score ?? 0) / (c2?.maxScore || 20))),
      evidence: `Safety Ratio: ${c2?.finalSafetyRatio ?? 100}%`,
      color: "#3B82F6", // Blue
      gradId: "gradC2",
      gradStart: "#3B82F6",
      gradEnd: "#1D4ED8",
    },
    {
      id: "c3",
      code: "C3",
      title: "Bounce-Free Record",
      shortTitle: "Bounce Record",
      score: c3?.score ?? 0,
      maxScore: c3?.maxScore ?? 20,
      ratio: Math.min(1, Math.max(0, (c3?.score ?? 0) / (c3?.maxScore || 20))),
      evidence: `${c3?.confirmedBounces ?? 0} Bounces`,
      color: "#10B981", // Emerald
      gradId: "gradC3",
      gradStart: "#10B981",
      gradEnd: "#047857",
    },
    {
      id: "c4",
      code: "C4",
      title: "Verified Inflow Regularity",
      shortTitle: "Inflow Reg.",
      score: c4ScoreNum,
      maxScore: c4?.maxScore ?? 15,
      ratio: c4?.isRepaymentIncomeContributor === "NO" ? 1 : Math.min(1, Math.max(0, c4ScoreNum / (c4?.maxScore || 15))),
      evidence: c4?.isRepaymentIncomeContributor === "NO" ? "Non-Contributor (Scaled)" : `${c4?.recurringMonthsCount ?? 6}/6 mos verified`,
      color: "#F59E0B", // Amber
      gradId: "gradC4",
      gradStart: "#F59E0B",
      gradEnd: "#D97706",
    },
    {
      id: "c5",
      code: "C5",
      title: "Cash-Deposit Ratio",
      shortTitle: "Cash Ratio",
      score: c5?.score ?? 0,
      maxScore: c5?.maxScore ?? 10,
      ratio: Math.min(1, Math.max(0, (c5?.score ?? 0) / (c5?.maxScore || 10))),
      evidence: `${((c5?.cashRatio ?? 0) * 100).toFixed(1)}% Cash`,
      color: "#06B6D4", // Cyan
      gradId: "gradC5",
      gradStart: "#06B6D4",
      gradEnd: "#0E7490",
    },
    {
      id: "c6",
      code: "C6",
      title: "Withdrawal Discipline",
      shortTitle: "Withdrawals",
      score: c6?.score ?? 0,
      maxScore: c6?.maxScore ?? 10,
      ratio: Math.min(1, Math.max(0, (c6?.score ?? 0) / (c6?.maxScore || 10))),
      evidence: `${c6?.passThroughEvents?.length ?? 0} Pass-Throughs`,
      color: "#EC4899", // Pink
      gradId: "gradC6",
      gradStart: "#EC4899",
      gradEnd: "#BE185D",
    },
  ];

  // Totals
  const totalScored = items.reduce((s, i) => s + (typeof i.score === "number" ? i.score : 0), 0);
  const totalMax = items.reduce((s, i) => s + i.maxScore, 0);
  const passingComponents = items.filter((i) => i.ratio >= 0.7).length;

  // SVG dimensions for vertical column mode
  const width = 680;
  const height = 260;
  const padding = { left: 55, right: 30, top: 35, bottom: 45 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const barSlotW = chartW / items.length;
  const barW = Math.min(48, barSlotW * 0.58);
  const benchmarkY = height - padding.bottom - 0.7 * chartH;

  return (
    <div className={`bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4 select-none ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400 text-lg">equalizer</span>
            <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
              6-Component Underwriting Bar Graph
            </h4>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
              {passingComponents}/6 Met 70% Target
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Component score realization vs. maximum points with 70% benchmark threshold
          </p>
        </div>

        {/* Layout Switcher */}
        <div className="flex items-center bg-slate-100/90 dark:bg-slate-800/90 p-1 rounded-xl gap-1">
          <button
            type="button"
            onClick={() => setLayoutMode("columns")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              layoutMode === "columns"
                ? "bg-white dark:bg-slate-700 text-indigo-700 dark:text-white shadow-2xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
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
                ? "bg-white dark:bg-slate-700 text-indigo-700 dark:text-white shadow-2xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <span className="material-symbols-outlined text-sm">view_stream</span>
            <span>Horizontal Bars</span>
          </button>
        </div>
      </div>

      {/* MODE 1: VERTICAL COLUMNS SVG BAR GRAPH */}
      {layoutMode === "columns" ? (
        <div className="relative w-full overflow-x-auto scrollbar-hide">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[560px] overflow-visible">
            <defs>
              {items.map((item) => (
                <linearGradient key={item.gradId} id={item.gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={item.gradStart} />
                  <stop offset="100%" stopColor={item.gradEnd} />
                </linearGradient>
              ))}
              <linearGradient id="bgBarGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F1F5F9" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#E2E8F0" stopOpacity="0.4" />
              </linearGradient>
            </defs>

            {/* Background grid lines */}
            {[0, 0.25, 0.5, 0.7, 1].map((pct, i) => {
              const y = height - padding.bottom - pct * chartH;
              const is70 = pct === 0.7;
              return (
                <g key={i}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={width - padding.right}
                    y2={y}
                    stroke={is70 ? "#F59E0B" : "#E2E8F0"}
                    strokeDasharray={is70 ? "5 4" : "4 4"}
                    strokeWidth={is70 ? "1.5" : "1"}
                    className={is70 ? "opacity-90" : "opacity-40 dark:opacity-20"}
                  />
                  <text
                    x={padding.left - 8}
                    y={y + 3.5}
                    textAnchor="end"
                    className={`font-mono text-[9px] ${
                      is70 ? "fill-amber-600 dark:fill-amber-400 font-bold" : "fill-slate-400 dark:fill-slate-500"
                    }`}
                  >
                    {Math.round(pct * 100)}%
                  </text>
                </g>
              );
            })}

            {/* 70% Target Badge Label */}
            <g transform={`translate(${width - padding.right - 105}, ${benchmarkY - 10})`}>
              <rect
                x="0"
                y="-10"
                width="105"
                height="20"
                rx="6"
                fill="#FEF3C7"
                stroke="#FDE68A"
                strokeWidth="1"
                className="dark:fill-amber-950/70 dark:stroke-amber-900"
              />
              <text
                x="52"
                y="3"
                textAnchor="middle"
                className="font-bold text-[9px] fill-amber-800 dark:fill-amber-300 uppercase tracking-wider"
              >
                70% Approval Target
              </text>
            </g>

            {/* Bars */}
            {items.map((item, idx) => {
              const slotCenter = padding.left + idx * barSlotW + barSlotW / 2;
              const barX = slotCenter - barW / 2;
              const barH = item.ratio * chartH;
              const barY = height - padding.bottom - barH;
              const isHovered = hoveredIdx === idx;

              return (
                <g
                  key={item.id}
                  className="cursor-pointer transition-all duration-300"
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                >
                  {/* Full Height Background Slot Bar */}
                  <rect
                    x={barX}
                    y={padding.top}
                    width={barW}
                    height={chartH}
                    rx="8"
                    fill="url(#bgBarGrad)"
                    className="dark:fill-slate-800/50"
                  />

                  {/* Scored Active Bar */}
                  <rect
                    x={barX}
                    y={barY}
                    width={barW}
                    height={Math.max(4, barH)}
                    rx="8"
                    fill={`url(#${item.gradId})`}
                    className={`transition-all duration-300 ${
                      isHovered ? "filter drop-shadow(0 6px 12px rgba(0,0,0,0.18)) opacity-100" : "opacity-90"
                    }`}
                  />

                  {/* Top Score Pill / Tag */}
                  <g transform={`translate(${slotCenter}, ${Math.max(padding.top - 6, barY - 7)})`}>
                    <rect
                      x="-26"
                      y="-15"
                      width="52"
                      height="18"
                      rx="6"
                      fill={isHovered ? "#1E293B" : item.ratio >= 0.7 ? "#ECFDF5" : "#FFF1F2"}
                      stroke={isHovered ? "#0F172A" : item.ratio >= 0.7 ? "#A7F3D0" : "#FECDD3"}
                      strokeWidth="1"
                    />
                    <text
                      x="0"
                      y="-3"
                      textAnchor="middle"
                      className={`font-mono font-bold text-[9px] ${
                        isHovered ? "fill-white" : item.ratio >= 0.7 ? "fill-emerald-800" : "fill-rose-700"
                      }`}
                    >
                      {item.score}/{item.maxScore}
                    </text>
                  </g>

                  {/* Bottom Component Labels */}
                  <text
                    x={slotCenter}
                    y={height - padding.bottom + 16}
                    textAnchor="middle"
                    className="font-black text-[10px] fill-slate-800 dark:fill-slate-200"
                  >
                    {item.code}
                  </text>
                  <text
                    x={slotCenter}
                    y={height - padding.bottom + 28}
                    textAnchor="middle"
                    className="font-semibold text-[8px] fill-slate-400 dark:fill-slate-500 truncate"
                  >
                    {item.shortTitle}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      ) : (
        /* MODE 2: HORIZONTAL PROGRESS BARS VIEW */
        <div className="space-y-3.5 pt-2">
          {items.map((item, idx) => {
            const isHovered = hoveredIdx === idx;
            const pct = Math.round(item.ratio * 100);

            return (
              <div
                key={item.id}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                  isHovered
                    ? "bg-slate-50 dark:bg-slate-800 border-indigo-200 dark:border-indigo-800 shadow-sm"
                    : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800"
                }`}
              >
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1.5 mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black text-white"
                      style={{ backgroundColor: item.color }}
                    >
                      {item.code}
                    </span>
                    <span className="text-xs font-black text-slate-800 dark:text-white">
                      {item.title}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                      • {item.evidence}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <span className="text-xs font-black font-mono text-slate-900 dark:text-white">
                      {item.score} <span className="text-[10px] text-slate-400 font-normal">/ {item.maxScore} pts</span>
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black font-mono ${
                        pct >= 70 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                      }`}
                    >
                      {pct}%
                    </span>
                  </div>
                </div>

                {/* Relative Progress Track with 70% threshold marker */}
                <div className="relative w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  {/* Scored bar */}
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

      {/* Hover Inspection Popover Card */}
      {hoveredIdx !== null && (
        <div className="p-3.5 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-2 shadow-lg animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center gap-2.5">
            <span
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-white"
              style={{ backgroundColor: items[hoveredIdx].color }}
            >
              {items[hoveredIdx].code}
            </span>
            <div>
              <div className="text-xs font-black text-white">{items[hoveredIdx].title}</div>
              <div className="text-[10px] text-slate-300">{items[hoveredIdx].evidence}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Score Realization</div>
              <div className="text-sm font-black font-mono text-emerald-400">
                {items[hoveredIdx].score} / {items[hoveredIdx].maxScore} pts ({Math.round(items[hoveredIdx].ratio * 100)}%)
              </div>
            </div>
            <span
              className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                items[hoveredIdx].ratio >= 0.7 ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
              }`}
            >
              {items[hoveredIdx].ratio >= 0.7 ? "Passes Target" : "Below Target"}
            </span>
          </div>
        </div>
      )}

      {/* Quick Summary Pill Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Aggregate Realized</span>
          <span className="text-sm font-black text-slate-900 dark:text-white font-mono">
            {totalScored} <span className="text-[10px] text-slate-400">/ {totalMax}</span>
          </span>
        </div>
        <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Realization Rate</span>
          <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 font-mono">
            {Math.round((totalScored / totalMax) * 100)}%
          </span>
        </div>
        <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Policy Threshold</span>
          <span className="text-sm font-black text-amber-600 dark:text-amber-400 font-mono">70% (70 pts)</span>
        </div>
        <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Benchmark Status</span>
          <span className={`text-xs font-black uppercase ${totalScored >= 70 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
            {totalScored >= 70 ? "Benchmark Satisfied" : "Attention Required"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default EVV6ComponentBarChart;
