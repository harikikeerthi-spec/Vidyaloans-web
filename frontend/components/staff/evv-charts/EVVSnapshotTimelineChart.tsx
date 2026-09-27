"use client";

import React, { useState } from "react";
import { type Snapshot } from "@/lib/evv-parser";

interface EVVSnapshotTimelineChartProps {
  snapshots: Snapshot[];
  benchmarkM?: number; // default 5000
  targetT?: number; // default 50000
  criticalThreshold?: number; // default 2000
  defaultTheme?: "light" | "dark";
}

export const EVVSnapshotTimelineChart: React.FC<EVVSnapshotTimelineChartProps> = ({
  snapshots,
  benchmarkM = 5000,
  targetT = 50000,
  criticalThreshold = 2000,
  defaultTheme = "light",
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [chartStyle, setChartStyle] = useState<"bars" | "spline">("bars");
  const [themeMode, setThemeMode] = useState<"light" | "dark">((defaultTheme as "light" | "dark") || "light");

  if (!snapshots || snapshots.length === 0) return null;

  const isDark = themeMode === "dark";

  // Dimensions
  const width = 880;
  const height = 310;
  const padding = { left: 68, right: 88, top: 30, bottom: 65 };
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

  const areaPath =
    points.length > 0
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

  const formatDateFull = (dInput: any) => {
    try {
      const d = dInput instanceof Date ? dInput : new Date(dInput);
      return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return String(dInput);
    }
  };

  // Delta scale for bottom volatility bars
  const deltas = snapshots.map((s) => Math.abs(s.changeAmount || 0));
  const maxDelta = Math.max(...deltas, 10000);

  // Position helper for floating glass tooltip
  const getHoverPos = (idx: number) => {
    const x = chartStyle === "bars" ? getSlotCenterX(idx) : getX(idx);
    const bal = snapshots[idx]?.balance ?? 0;
    const y = getY(bal);
    return { x, y };
  };

  const getTooltipXPercent = (idx: number) => {
    const { x } = getHoverPos(idx);
    return (x / width) * 100;
  };

  const getTooltipYPercent = (idx: number) => {
    const { y } = getHoverPos(idx);
    return (Math.max(padding.top + 15, y) / height) * 100;
  };

  const getTooltipTransform = (xPercent: number) => {
    if (xPercent < 22) return "translate(4%, -106%)";
    if (xPercent > 78) return "translate(-104%, -106%)";
    return "translate(-50%, -106%)";
  };

  return (
    <div
      className={`rounded-3xl p-5 sm:p-7 select-none transition-all duration-300 relative ${
        isDark
          ? "bg-[#1E293B] border border-white/10 shadow-[0_15px_30px_-5px_rgba(0,0,0,0.35)] text-slate-100"
          : "bg-white border border-slate-200/80 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.04)] text-slate-800"
      }`}
    >
      {/* Header Toolbar */}
      <div
        className={`flex flex-col lg:flex-row justify-between lg:items-center gap-3.5 pb-4 border-b ${
          isDark ? "border-slate-700/60" : "border-slate-100"
        }`}
      >
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-xs">
              <span className="material-symbols-outlined text-[18px]">stacked_bar_chart</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4
                  className={`text-sm font-extrabold uppercase tracking-wider font-sans ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  Sampled Interval Balances
                </h4>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  {snapshots.length} Interval Points
                </span>
              </div>
              <p className={`text-[11px] font-medium mt-0.5 font-sans ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                5-day interval closing ledger balances with benchmark safety thresholds and delta volatility tracking
              </p>
            </div>
          </div>
        </div>

        {/* Style Switcher, Theme Switcher & Modern Legend */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Chart Style Switcher */}
          <div className={`flex items-center p-1 rounded-xl gap-1 ${isDark ? "bg-slate-800/80" : "bg-slate-100/90"}`}>
            <button
              type="button"
              onClick={() => setChartStyle("bars")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                chartStyle === "bars"
                  ? isDark
                    ? "bg-slate-700 text-white shadow-xs"
                    : "bg-white text-indigo-700 shadow-xs"
                  : isDark
                  ? "text-slate-400 hover:text-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">bar_chart</span>
              <span>Bar Graph</span>
            </button>
            <button
              type="button"
              onClick={() => setChartStyle("spline")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                chartStyle === "spline"
                  ? isDark
                    ? "bg-slate-700 text-white shadow-xs"
                    : "bg-white text-indigo-700 shadow-xs"
                  : isDark
                  ? "text-slate-400 hover:text-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">show_chart</span>
              <span>Spline Curve</span>
            </button>
          </div>

          {/* Theme Mode Toggle (Clean Light vs Soft Dark Slate) */}
          <button
            type="button"
            onClick={() => setThemeMode(isDark ? "light" : "dark")}
            className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
              isDark
                ? "bg-slate-800 border-slate-700 text-amber-300 hover:bg-slate-700"
                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
            title={isDark ? "Switch to Clean Light Theme" : "Switch to Slate Dark Theme"}
          >
            <span className="material-symbols-outlined text-[18px]">
              {isDark ? "light_mode" : "dark_mode"}
            </span>
          </button>

          {/* Legend Pills with Point Styles */}
          <div className="flex items-center gap-3 text-[11px] font-semibold font-sans">
            <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
              <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-b from-[#818CF8] to-[#4F46E5] ring-2 ring-indigo-500/20" />
              &ge; M (Safe)
            </span>
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-b from-[#FBBF24] to-[#D97706] ring-2 ring-amber-500/20" />
              &lt; M
            </span>
            <span className="flex items-center gap-1.5 text-rose-500 dark:text-rose-400">
              <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-b from-[#FB7185] to-[#BE123C] ring-2 ring-rose-500/20" />
              &lt; ₹2k Critical
            </span>
          </div>
        </div>
      </div>

      {/* SVG Canvas Container */}
      <div className="relative w-full overflow-x-auto scrollbar-hide py-2">
        {/* Floating Glass Tooltip */}
        {hoveredIdx !== null && snapshots[hoveredIdx] && (
          <div
            className="absolute pointer-events-none z-30 transition-all duration-150 ease-out"
            style={{
              left: `${getTooltipXPercent(hoveredIdx)}%`,
              top: `${getTooltipYPercent(hoveredIdx)}%`,
              transform: getTooltipTransform(getTooltipXPercent(hoveredIdx)),
            }}
          >
            <div className="bg-slate-900/90 dark:bg-slate-950/95 backdrop-blur-md text-white rounded-xl shadow-[0_16px_36px_-6px_rgba(0,0,0,0.35)] border border-white/10 p-3.5 min-w-[220px] space-y-2 font-sans">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                <span className="uppercase tracking-wider">Interval #{hoveredIdx + 1}</span>
                <span className="font-semibold text-slate-200">{formatDateFull(snapshots[hoveredIdx].date)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-3 pt-0.5">
                <span className="text-[11px] text-slate-400">Closing Balance:</span>
                <span className="text-base font-extrabold tracking-tight text-white font-mono">
                  ₹{Math.round(snapshots[hoveredIdx].balance).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10 text-[10px]">
                <span className="flex items-center gap-1">
                  <span className="text-slate-400">Delta:</span>
                  <span
                    className={`font-bold font-mono ${
                      (snapshots[hoveredIdx].changeAmount || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {(snapshots[hoveredIdx].changeAmount || 0) >= 0 ? "+" : "-"}₹
                    {Math.abs(Math.round(snapshots[hoveredIdx].changeAmount || 0)).toLocaleString("en-IN")}
                  </span>
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase ${
                    snapshots[hoveredIdx].balance < criticalThreshold
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      : snapshots[hoveredIdx].balance < benchmarkM
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                  }`}
                >
                  {snapshots[hoveredIdx].balance < criticalThreshold
                    ? "Critical Low"
                    : snapshots[hoveredIdx].balance < benchmarkM
                    ? "Below M"
                    : "Safe (≥ M)"}
                </span>
              </div>
            </div>
          </div>
        )}

        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[700px] overflow-visible">
          <defs>
            {/* Safe Bars: Vibrant Indigo (#818CF8) to Deep Violet (#4F46E5) */}
            <linearGradient id="barSafeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#818CF8" />
              <stop offset="100%" stopColor="#4F46E5" />
            </linearGradient>
            <linearGradient id="barSafeGradHover" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#A5B4FC" />
              <stop offset="100%" stopColor="#6366F1" />
            </linearGradient>

            {/* Warning / Caution Bars: Soft Amber (#FBBF24 to #D97706) */}
            <linearGradient id="barCautionGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FBBF24" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>
            <linearGradient id="barCautionGradHover" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FDE68A" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>

            {/* Critical Bars: Muted Rose (#FB7185 to #BE123C) */}
            <linearGradient id="barCriticalGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FB7185" />
              <stop offset="100%" stopColor="#BE123C" />
            </linearGradient>
            <linearGradient id="barCriticalGradHover" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FDA4AF" />
              <stop offset="100%" stopColor="#E11D48" />
            </linearGradient>

            {/* Spline Area Gradient */}
            <linearGradient id="splineAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#818CF8" stopOpacity={isDark ? "0.28" : "0.20"} />
              <stop offset="100%" stopColor="#4F46E5" stopOpacity="0.01" />
            </linearGradient>

            {/* Soft Critical Zone Gradient */}
            <linearGradient id="criticalZoneGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FB7185" stopOpacity={isDark ? "0.10" : "0.06"} />
              <stop offset="100%" stopColor="#BE123C" stopOpacity="0.01" />
            </linearGradient>

            {/* Glowing shadow filters for reference lines */}
            <filter id="glowBenchmark" x="-20%" y="-40%" width="140%" height="180%">
              <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#F59E0B" floodOpacity="0.45" />
            </filter>
            <filter id="glowTarget" x="-20%" y="-40%" width="140%" height="180%">
              <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#10B981" floodOpacity="0.45" />
            </filter>

            {/* Bar Hover Glow */}
            <filter id="barHoverGlow" x="-30%" y="-20%" width="160%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#818CF8" floodOpacity="0.45" />
            </filter>
          </defs>

          {/* Faint Horizontal Grid Lines (No vertical clutter) */}
          {[0, 0.25, 0.5, 0.75, 1].map((r, i) => {
            const y = height - padding.bottom - r * mainChartH;
            const val = Math.round(minBal + r * (maxBal - minBal));
            return (
              <g key={i}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke={isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(148, 163, 184, 0.14)"}
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 12}
                  y={y + 3.5}
                  textAnchor="end"
                  className={`font-sans text-[10px] font-medium ${isDark ? "fill-slate-500" : "fill-slate-400"}`}
                >
                  ₹{Math.round(val / 1000)}k
                </text>
              </g>
            );
          })}

          {/* Soft Critical Threshold Zone (< ₹2,000) */}
          {criticalY >= padding.top && (
            <rect
              x={padding.left}
              y={criticalY}
              width={chartW}
              height={Math.max(0, height - padding.bottom - criticalY)}
              fill="url(#criticalZoneGrad)"
              rx="4"
            />
          )}

          {/* Benchmark M reference line with Glowing Filter & Right-Axis Pill Badge */}
          {benchmarkY >= padding.top && benchmarkY <= height - padding.bottom && (
            <g>
              <line
                x1={padding.left}
                y1={benchmarkY}
                x2={width - padding.right}
                y2={benchmarkY}
                stroke="#F59E0B"
                strokeDasharray="5 5"
                strokeWidth="1.5"
                filter="url(#glowBenchmark)"
              />
              <g transform={`translate(${width - padding.right + 6}, ${benchmarkY - 9})`}>
                <rect
                  width="76"
                  height="18"
                  rx="5"
                  fill={isDark ? "#1E293B" : "#FEF3C7"}
                  stroke="#F59E0B"
                  strokeWidth="1"
                  strokeOpacity="0.5"
                />
                <text
                  x="38"
                  y="12.5"
                  textAnchor="middle"
                  className="fill-amber-700 dark:fill-amber-300 font-sans text-[9px] font-bold tracking-tight"
                >
                  M: ₹{benchmarkM >= 1000 ? `${(benchmarkM / 1000).toFixed(0)}k` : benchmarkM}
                </text>
              </g>
            </g>
          )}

          {/* Target T reference line with Glowing Filter & Right-Axis Pill Badge */}
          {targetY >= padding.top && targetY <= height - padding.bottom && (
            <g>
              <line
                x1={padding.left}
                y1={targetY}
                x2={width - padding.right}
                y2={targetY}
                stroke="#10B981"
                strokeDasharray="5 5"
                strokeWidth="1.5"
                filter="url(#glowTarget)"
              />
              <g transform={`translate(${width - padding.right + 6}, ${targetY - 9})`}>
                <rect
                  width="76"
                  height="18"
                  rx="5"
                  fill={isDark ? "#1E293B" : "#D1FAE5"}
                  stroke="#10B981"
                  strokeWidth="1"
                  strokeOpacity="0.5"
                />
                <text
                  x="38"
                  y="12.5"
                  textAnchor="middle"
                  className="fill-emerald-700 dark:fill-emerald-300 font-sans text-[9px] font-bold tracking-tight"
                >
                  T: ₹{targetT >= 1000 ? `${(targetT / 1000).toFixed(0)}k` : targetT}
                </text>
              </g>
            </g>
          )}

          {/* MODE 1: BAR GRAPH VIEW */}
          {chartStyle === "bars" ? (
            <>
              {snapshots.map((s, i) => {
                const groupCenter = getSlotCenterX(i);
                const barW = Math.max(4, Math.min(18, slotW * 0.72));
                const bal = s.balance;
                const barY = getY(bal);
                const barH = Math.max(3, height - padding.bottom - barY);
                const isHovered = hoveredIdx === i;

                // Color coding
                const isCrit = bal < criticalThreshold;
                const isBelowBench = bal < benchmarkM;
                const gradId = isHovered
                  ? isCrit
                    ? "barCriticalGradHover"
                    : isBelowBench
                    ? "barCautionGradHover"
                    : "barSafeGradHover"
                  : isCrit
                  ? "barCriticalGrad"
                  : isBelowBench
                  ? "barCautionGrad"
                  : "barSafeGrad";

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
                      rx="4"
                      fill={isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(241, 245, 249, 0.45)"}
                    />

                    {/* Active Closing Balance Bar with Gradient & Hover Glow */}
                    <rect
                      x={groupCenter - barW / 2}
                      y={barY}
                      width={barW}
                      height={barH}
                      rx="4"
                      fill={`url(#${gradId})`}
                      filter={isHovered ? "url(#barHoverGlow)" : undefined}
                      className="transition-all duration-200"
                      style={{
                        transformOrigin: `${groupCenter}px ${barY + barH}px`,
                        transform: isHovered ? "scaleY(1.015)" : "scaleY(1)",
                        opacity: isHovered ? 1 : 0.92,
                      }}
                    />
                  </g>
                );
              })}
            </>
          ) : (
            /* MODE 2: SPLINE CURVE VIEW */
            <>
              {areaPath && <path d={areaPath} fill="url(#splineAreaGrad)" />}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="#6366F1"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter={isDark ? "drop-shadow(0 4px 10px rgba(99, 102, 241, 0.4))" : "drop-shadow(0 2px 6px rgba(99, 102, 241, 0.25))"}
                />
              )}
              {points.map((pt, i) => {
                const s = snapshots[i];
                const isCrit = s.balance < criticalThreshold;
                const isBelowBench = s.balance < benchmarkM;
                const dotColor = isCrit ? "#FB7185" : isBelowBench ? "#F59E0B" : "#6366F1";
                const isHovered = hoveredIdx === i;

                return (
                  <g
                    key={i}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    {isHovered && (
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="9"
                        fill={dotColor}
                        fillOpacity="0.2"
                        className="animate-ping duration-1000"
                      />
                    )}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? "6" : "3.5"}
                      fill={isDark ? "#1E293B" : "#FFFFFF"}
                      stroke={dotColor}
                      strokeWidth={isHovered ? "3" : "2"}
                      className="transition-all duration-150"
                    />
                  </g>
                );
              })}
            </>
          )}

          {/* Lower Volatility Delta Histogram Baseline Divider */}
          <line
            x1={padding.left}
            y1={height - 28}
            x2={width - padding.right}
            y2={height - 28}
            stroke={isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(148, 163, 184, 0.2)"}
            strokeWidth="1"
          />

          {/* Delta Indicator Tag */}
          <text
            x={padding.left - 12}
            y={height - 18}
            textAnchor="end"
            className={`font-sans text-[8.5px] font-bold ${isDark ? "fill-slate-500" : "fill-slate-400"}`}
          >
            Δ Flow
          </text>

          {/* LOWER VOLATILITY DELTA HISTOGRAM (BARS) */}
          {snapshots.map((s, i) => {
            const x = chartStyle === "bars" ? getSlotCenterX(i) : getX(i);
            const delta = s.changeAmount || 0;
            const isCredit = delta >= 0;
            const deltaH = (Math.abs(delta) / (maxDelta || 1)) * 22;
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
                  height={Math.max(2.5, deltaH)}
                  rx="1.5"
                  fill={isCredit ? "#10B981" : "#FB7185"}
                  className={`transition-all duration-150 ${isHovered ? "opacity-100" : "opacity-65"}`}
                />
              </g>
            );
          })}

          {/* X-Axis Date Labels sampled cleanly */}
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
                className={`text-[9.5px] font-sans font-medium transition-all ${
                  isHovered
                    ? "fill-indigo-600 dark:fill-indigo-400 font-bold"
                    : isDark
                    ? "fill-slate-400"
                    : "fill-slate-400"
                }`}
              >
                {formatDateLabel(s.date)}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Footer: Modern Inspection Summary Bar */}
      <div
        className={`flex flex-col sm:flex-row justify-between sm:items-center gap-3 pt-3.5 border-t ${
          isDark ? "border-slate-700/60" : "border-slate-100"
        }`}
      >
        {hoveredIdx !== null && snapshots[hoveredIdx] ? (
          <div
            className={`flex items-center gap-3 text-xs px-4 py-2 rounded-xl shadow-xs animate-in fade-in zoom-in-95 duration-100 font-sans ${
              isDark
                ? "bg-slate-800/90 text-slate-200 border border-slate-700"
                : "bg-slate-900 text-white"
            }`}
          >
            <span className="text-indigo-400 font-bold">
              #{hoveredIdx + 1} ({formatDateLabel(snapshots[hoveredIdx].date)}):
            </span>
            <span className="font-semibold">
              Ledger Balance: ₹{Math.round(snapshots[hoveredIdx].balance).toLocaleString("en-IN")}
            </span>
            <span className="text-slate-500">|</span>
            <span
              className={`font-semibold ${
                (snapshots[hoveredIdx].changeAmount || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              Delta: {(snapshots[hoveredIdx].changeAmount || 0) >= 0 ? "+" : "-"}₹
              {Math.abs(Math.round(snapshots[hoveredIdx].changeAmount || 0)).toLocaleString("en-IN")}
            </span>
            <span className="text-slate-500">|</span>
            <span
              className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase ${
                snapshots[hoveredIdx].balance < criticalThreshold
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                  : snapshots[hoveredIdx].balance < benchmarkM
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
              }`}
            >
              {snapshots[hoveredIdx].balance < criticalThreshold
                ? "Critical Low"
                : snapshots[hoveredIdx].balance < benchmarkM
                ? "Below Benchmark"
                : "Benchmark Satisfied"}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
            <span className="material-symbols-outlined text-[15px] text-slate-400">touch_app</span>
            <span>Hover over any interval date bar to inspect closing balance and daily delta change</span>
          </div>
        )}

        <div className={`flex items-center gap-3 text-[10px] font-medium font-sans ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-xs bg-emerald-500" />
            Credit Inflow
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-xs bg-rose-500" />
            Debit Outflow
          </span>
        </div>
      </div>
    </div>
  );
};

export default EVVSnapshotTimelineChart;
