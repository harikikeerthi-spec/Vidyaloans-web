"use client";

import React, { useState } from "react";
import { type Snapshot } from "@/lib/evv-parser";

interface EVVSnapshotTimelineChartProps {
  snapshots: Snapshot[];
  benchmarkM?: number; // default 5000
  targetT?: number; // default 50000
  criticalThreshold?: number; // default 2000
}

export const EVVSnapshotTimelineChart: React.FC<EVVSnapshotTimelineChartProps> = ({
  snapshots,
  benchmarkM = 5000,
  targetT = 50000,
  criticalThreshold = 2000,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [chartStyle, setChartStyle] = useState<"bars" | "spline">("bars");

  if (!snapshots || snapshots.length === 0) return null;

  const width = 820;
  const height = 300;
  const padding = { left: 65, right: 25, top: 25, bottom: 65 };
  const mainChartH = height - padding.top - padding.bottom;
  const chartW = width - padding.left - padding.right;

  // Max balance scale
  const balances = snapshots.map((s) => s.balance);
  const maxBal = Math.max(...balances, targetT, 10000) * 1.1;
  const minBal = Math.min(0, Math.min(...balances));

  const getY = (bal: number) => {
    const range = maxBal - minBal || 1;
    return height - padding.bottom - ((bal - minBal) / range) * mainChartH;
  };

  const getX = (idx: number) => {
    return padding.left + (idx / (snapshots.length - 1 || 1)) * chartW;
  };

  const slotW = chartW / snapshots.length;
  const getSlotCenterX = (idx: number) => {
    return padding.left + idx * slotW + slotW / 2;
  };

  // Spline calculations
  const points = snapshots.map((s, i) => ({ x: getX(i), y: getY(s.balance) }));
  let linePath = "";
  if (points.length > 0) {
    linePath = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p = points[i];
      const cpX1 = p0.x + (p.x - p0.x) / 3;
      const cpY1 = p0.y;
      const cpX2 = p0.x + (2 * (p.x - p0.x)) / 3;
      const cpY2 = p.y;
      linePath += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p.x} ${p.y}`;
    }
  }

  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x} ${height - padding.bottom} L ${points[0].x} ${height - padding.bottom} Z`
    : "";

  const benchmarkY = getY(benchmarkM);
  const targetY = getY(targetT);
  const criticalY = getY(criticalThreshold);

  const formatDateLabel = (dInput: any) => {
    try {
      const d = dInput instanceof Date ? dInput : new Date(dInput);
      return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    } catch {
      return String(dInput);
    }
  };

  // Delta scale for bottom volatility bars
  const deltas = snapshots.map((s) => Math.abs(s.changeAmount || 0));
  const maxDelta = Math.max(...deltas, 10000);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4 select-none">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400 text-lg">stacked_bar_chart</span>
            <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Sampled Interval Balances Bar Graph
            </h4>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
              {snapshots.length} Interval Points
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            5-day interval reconstructed ledger closing balances with benchmark safety thresholds and delta volatility tracking
          </p>
        </div>

        {/* Style Switcher & Legend */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl gap-0.5">
            <button
              type="button"
              onClick={() => setChartStyle("bars")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                chartStyle === "bars"
                  ? "bg-white dark:bg-slate-700 text-indigo-700 dark:text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <span className="material-symbols-outlined text-sm">bar_chart</span>
              <span>Bar Graph</span>
            </button>
            <button
              type="button"
              onClick={() => setChartStyle("spline")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                chartStyle === "spline"
                  ? "bg-white dark:bg-slate-700 text-indigo-700 dark:text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <span className="material-symbols-outlined text-sm">show_chart</span>
              <span>Spline Curve</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5 text-[10px] font-bold">
            <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
              <span className="w-2.5 h-2.5 bg-indigo-500 rounded-xs" />
              &ge; M (Safe)
            </span>
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <span className="w-2.5 h-2.5 bg-amber-500 rounded-xs" />
              &lt; M
            </span>
            <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
              <span className="w-2.5 h-2.5 bg-rose-500 rounded-xs" />
              &lt; ₹2k Critical
            </span>
          </div>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full overflow-x-auto scrollbar-hide">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[650px] overflow-visible">
          <defs>
            <linearGradient id="barSafeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#6D28D9" />
            </linearGradient>
            <linearGradient id="barCautionGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FBBF24" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>
            <linearGradient id="barCriticalGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F43F5E" />
              <stop offset="100%" stopColor="#BE123C" />
            </linearGradient>
            <linearGradient id="timelineAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.30" />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((r, i) => {
            const y = height - padding.bottom - r * mainChartH;
            const val = Math.round(minBal + r * (maxBal - minBal));
            return (
              <g key={i} className="opacity-40 dark:opacity-20">
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#CBD5E1"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 10}
                  y={y + 3.5}
                  textAnchor="end"
                  className="fill-slate-400 font-mono text-[9px]"
                >
                  ₹{Math.round(val / 1000)}k
                </text>
              </g>
            );
          })}

          {/* Critical Threshold (< ₹2,000) shaded zone */}
          {criticalY >= padding.top && (
            <rect
              x={padding.left}
              y={criticalY}
              width={chartW}
              height={Math.max(0, height - padding.bottom - criticalY)}
              fill="#FEE2E2"
              className="dark:fill-rose-950/25 opacity-40"
            />
          )}

          {/* Benchmark M reference line */}
          {benchmarkY >= padding.top && benchmarkY <= height - padding.bottom && (
            <g>
              <line
                x1={padding.left}
                y1={benchmarkY}
                x2={width - padding.right}
                y2={benchmarkY}
                stroke="#F59E0B"
                strokeDasharray="4 4"
                strokeWidth="1.5"
                className="opacity-80"
              />
              <text
                x={padding.left + 8}
                y={benchmarkY - 5}
                className="fill-amber-600 font-mono text-[8px] font-bold"
              >
                Benchmark M (₹{benchmarkM.toLocaleString('en-IN')})
              </text>
            </g>
          )}

          {/* Target T reference line */}
          {targetY >= padding.top && targetY <= height - padding.bottom && (
            <g>
              <line
                x1={padding.left}
                y1={targetY}
                x2={width - padding.right}
                y2={targetY}
                stroke="#10B981"
                strokeDasharray="4 4"
                strokeWidth="1.5"
                className="opacity-80"
              />
              <text
                x={padding.left + 8}
                y={targetY - 5}
                className="fill-emerald-600 font-mono text-[8px] font-bold"
              >
                Target T (₹{targetT.toLocaleString('en-IN')})
              </text>
            </g>
          )}

          {/* MODE 1: BAR GRAPH VIEW (DEFAULT) */}
          {chartStyle === "bars" ? (
            <>
              {snapshots.map((s, i) => {
                const groupCenter = getSlotCenterX(i);
                const barW = Math.max(3.5, Math.min(18, slotW * 0.72));
                const bal = s.balance;
                const barY = getY(bal);
                const barH = Math.max(3, height - padding.bottom - barY);
                const isHovered = hoveredIdx === i;

                // Color coding
                const isCrit = bal < criticalThreshold;
                const isBelowBench = bal < benchmarkM;
                const gradId = isCrit ? "barCriticalGrad" : isBelowBench ? "barCautionGrad" : "barSafeGrad";

                return (
                  <g
                    key={i}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    {/* Background Slot Bar */}
                    <rect
                      x={groupCenter - barW / 2}
                      y={padding.top}
                      width={barW}
                      height={mainChartH}
                      fill="#F1F5F9"
                      className="dark:fill-slate-800/30 opacity-40"
                    />

                    {/* Active Closing Balance Bar */}
                    <rect
                      x={groupCenter - barW / 2}
                      y={barY}
                      width={barW}
                      height={barH}
                      rx="3"
                      fill={`url(#${gradId})`}
                      className={`transition-all duration-200 ${
                        isHovered ? "opacity-100 filter drop-shadow(0 4px 8px rgba(0,0,0,0.25))" : "opacity-90"
                      }`}
                    />
                  </g>
                );
              })}
            </>
          ) : (
            /* MODE 2: SPLINE CURVE VIEW */
            <>
              {areaPath && <path d={areaPath} fill="url(#timelineAreaGrad)" />}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="#7C3AED"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {points.map((pt, i) => {
                const s = snapshots[i];
                const isCrit = s.balance < criticalThreshold;
                const isBelowBench = s.balance < benchmarkM;
                const dotColor = isCrit ? "#EF4444" : isBelowBench ? "#F59E0B" : "#7C3AED";
                const isHovered = hoveredIdx === i;

                return (
                  <g
                    key={i}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? "6" : "3.5"}
                      fill="#FFFFFF"
                      stroke={dotColor}
                      strokeWidth={isHovered ? "3" : "2"}
                      className="transition-all duration-150"
                    />
                  </g>
                );
              })}
            </>
          )}

          {/* LOWER VOLATILITY DELTA HISTOGRAM (BARS) */}
          {snapshots.map((s, i) => {
            const x = chartStyle === "bars" ? getSlotCenterX(i) : getX(i);
            const delta = s.changeAmount || 0;
            const isCredit = delta >= 0;
            const deltaH = (Math.abs(delta) / (maxDelta || 1)) * 24;
            const isHovered = hoveredIdx === i;

            return (
              <g
                key={`delta-${i}`}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <rect
                  x={x - 2}
                  y={height - 28}
                  width="4"
                  height={Math.max(2, deltaH)}
                  rx="1"
                  fill={isCredit ? "#10B981" : "#F43F5E"}
                  className={`transition-all duration-150 ${isHovered ? "opacity-100" : "opacity-60"}`}
                />
              </g>
            );
          })}

          {/* X-Axis Date Labels sampled every 6-8 intervals */}
          {snapshots.map((s, i) => {
            const step = Math.max(1, Math.floor(snapshots.length / 8));
            if (i % step !== 0 && i !== snapshots.length - 1) return null;
            const x = chartStyle === "bars" ? getSlotCenterX(i) : getX(i);
            const isHovered = hoveredIdx === i;

            return (
              <text
                key={`label-${i}`}
                x={x}
                y={height - 35}
                textAnchor="middle"
                className={`text-[9px] font-mono font-bold transition-all ${
                  isHovered
                    ? "fill-indigo-600 dark:fill-indigo-400 font-black text-[10px]"
                    : "fill-slate-400 dark:fill-slate-500"
                }`}
              >
                {formatDateLabel(s.date)}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Footer: Dynamic Hover Inspector */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
        {hoveredIdx !== null ? (
          <div className="flex items-center gap-3 font-mono font-bold text-xs bg-slate-900 text-white px-4 py-2 rounded-2xl shadow-md animate-in fade-in zoom-in-95 duration-100">
            <span className="text-indigo-300 font-black">
              #{hoveredIdx + 1} ({formatDateLabel(snapshots[hoveredIdx].date)}):
            </span>
            <span>Ledger Balance: ₹{Math.round(snapshots[hoveredIdx].balance).toLocaleString("en-IN")}</span>
            <span className="text-slate-500">|</span>
            <span className={(snapshots[hoveredIdx].changeAmount || 0) >= 0 ? "text-emerald-400" : "text-rose-400"}>
              Delta: {(snapshots[hoveredIdx].changeAmount || 0) >= 0 ? "+" : "-"}₹{Math.abs(Math.round(snapshots[hoveredIdx].changeAmount || 0)).toLocaleString("en-IN")}
            </span>
            <span className="text-slate-500">|</span>
            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
              snapshots[hoveredIdx].balance < criticalThreshold
                ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                : snapshots[hoveredIdx].balance < benchmarkM
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
            }`}>
              {snapshots[hoveredIdx].balance < criticalThreshold ? "Critical Low" : snapshots[hoveredIdx].balance < benchmarkM ? "Below Benchmark" : "Benchmark Satisfied"}
            </span>
          </div>
        ) : (
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            Hover over any interval date bar to inspect closing balance and daily delta change
          </span>
        )}

        <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 dark:text-slate-400">
          <span>Lower bars = Volatility (Green: Credit inflow, Red: Debit outflow)</span>
        </div>
      </div>
    </div>
  );
};

export default EVVSnapshotTimelineChart;
