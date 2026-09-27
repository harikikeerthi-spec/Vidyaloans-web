"use client";

import React, { useState } from "react";
import { type MonthlyMetric } from "@/lib/evv-parser";

interface EVVMonthlyMetricsChartProps {
  metrics: MonthlyMetric[];
  benchmarkM?: number; // e.g. 5000
  targetT?: number;
}

export const EVVMonthlyMetricsChart: React.FC<EVVMonthlyMetricsChartProps> = ({
  metrics,
  benchmarkM = 5000,
  targetT,
}) => {
  const [activeMode, setActiveMode] = useState<"balances" | "cashflow" | "risk">("balances");
  const [balanceGraphStyle, setBalanceGraphStyle] = useState<"bar" | "spline">("bar");
  const [hoveredMonthIdx, setHoveredMonthIdx] = useState<number | null>(null);

  if (!metrics || metrics.length === 0) return null;

  const width = 820;
  const height = 290;
  const padding = { left: 68, right: 88, top: 32, bottom: 48 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // ─────────────────────────────────────────────────────────────────────────────
  // Mode 1: Balance Dynamics calculations
  // ─────────────────────────────────────────────────────────────────────────────
  const allBalances = metrics.flatMap((m) => [
    m.avg,
    m.avgDailyBalance || m.avg,
    m.closing,
    m.max,
    m.min,
    benchmarkM,
    targetT || 0,
  ]);
  const maxBalance = Math.max(...allBalances, 10000) * 1.15;
  const minBalance = Math.min(0, Math.min(...allBalances));

  const getBalanceY = (val: number) => {
    const range = maxBalance - minBalance || 1;
    return height - padding.bottom - ((val - minBalance) / range) * chartH;
  };

  const getX = (idx: number) => {
    return padding.left + (idx / (metrics.length - 1 || 1)) * chartW;
  };

  const slotW = chartW / metrics.length;
  const getSlotCenterX = (idx: number) => {
    return padding.left + idx * slotW + slotW / 2;
  };

  // Helper to build smooth cubic spline
  const makeSpline = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return "";
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1];
      const p = pts[i];
      const cpX1 = p0.x + (p.x - p0.x) / 3;
      const cpY1 = p0.y;
      const cpX2 = p0.x + (2 * (p.x - p0.x)) / 3;
      const cpY2 = p.y;
      d += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p.x} ${p.y}`;
    }
    return d;
  };

  const ambPoints = metrics.map((m, i) => ({ x: getX(i), y: getBalanceY(m.avg) }));
  const ambPath = makeSpline(ambPoints);
  const ambAreaPath =
    ambPoints.length > 0
      ? `${ambPath} L ${ambPoints[ambPoints.length - 1].x} ${height - padding.bottom} L ${ambPoints[0].x} ${height - padding.bottom} Z`
      : "";

  const benchmarkY = getBalanceY(benchmarkM);
  const targetY = targetT ? getBalanceY(targetT) : null;

  // ─────────────────────────────────────────────────────────────────────────────
  // Mode 2: Cashflow (Credits vs Debits) calculations
  // ─────────────────────────────────────────────────────────────────────────────
  const allFlows = metrics.flatMap((m) => [m.credits, m.debits]);
  const maxFlow = Math.max(...allFlows, 10000) * 1.15;

  const getFlowY = (val: number) => {
    return height - padding.bottom - (val / (maxFlow || 1)) * chartH;
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Mode 3: Risk (Cash % and Bounces)
  // ─────────────────────────────────────────────────────────────────────────────
  const maxCashPct = Math.max(...metrics.map((m) => m.cashPercent || 0), 40);
  const cashLimitY = height - padding.bottom - (25 / (maxCashPct || 1)) * chartH;

  const getRiskY = (pct: number) => {
    return height - padding.bottom - (pct / (maxCashPct || 1)) * chartH;
  };

  // Hover position calculations for floating glass tooltip
  const getHoverPos = (idx: number) => {
    const x = getSlotCenterX(idx);
    let y = height / 2;
    if (activeMode === "balances") {
      y = balanceGraphStyle === "spline" ? ambPoints[idx].y : getBalanceY(metrics[idx].avg);
    } else if (activeMode === "cashflow") {
      y = Math.min(getFlowY(metrics[idx].credits), getFlowY(metrics[idx].debits));
    } else {
      y = getRiskY(metrics[idx].cashPercent || 0);
    }
    return { x, y };
  };

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05),0_2px_4px_-1px_rgba(0,0,0,0.03)] space-y-4 select-none font-sans">
      {/* Chart Top Header & Mode Switcher */}
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#4F46E5] text-lg">bar_chart</span>
            <h4 className="text-[13px] font-semibold text-[#475569] uppercase tracking-wider font-sans">
              Monthly Financial Metrics Visualizer
            </h4>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EEF2FF] text-[#4F46E5] border border-[#E0E7FF]">
              {metrics.length} Months
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
            Comparative bar charts of monthly sampled AMB balances, cashflow, and risk factors
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Sub-toggle for Balances: Bar vs Spline */}
          {activeMode === "balances" && (
            <div className="flex items-center bg-[#F1F5F9] p-1 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setBalanceGraphStyle("bar")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  balanceGraphStyle === "bar"
                    ? "bg-[#EEF2FF] text-[#4F46E5] shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span className="material-symbols-outlined text-xs">bar_chart</span>
                <span>Bar Graph</span>
              </button>
              <button
                type="button"
                onClick={() => setBalanceGraphStyle("spline")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  balanceGraphStyle === "spline"
                    ? "bg-[#EEF2FF] text-[#4F46E5] shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span className="material-symbols-outlined text-xs">show_chart</span>
                <span>Spline</span>
              </button>
            </div>
          )}

          {/* Mode Switcher */}
          <div className="flex items-center bg-[#F1F5F9] p-1 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setActiveMode("balances")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeMode === "balances"
                  ? "bg-[#EEF2FF] text-[#4F46E5] shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span className="material-symbols-outlined text-sm">equalizer</span>
              <span>Balance Bars</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMode("cashflow")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeMode === "cashflow"
                  ? "bg-[#EEF2FF] text-[#4F46E5] shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span className="material-symbols-outlined text-sm">swap_horiz</span>
              <span>Credits vs Debits</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMode("risk")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeMode === "risk"
                  ? "bg-[#EEF2FF] text-[#4F46E5] shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span className="material-symbols-outlined text-sm">warning</span>
              <span>Cash % Bars</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main SVG Visualization Canvas Container with Floating Glass Tooltip */}
      <div className="relative w-full overflow-x-auto scrollbar-hide py-1">
        {/* Floating Interactive Tooltip */}
        {hoveredMonthIdx !== null && metrics[hoveredMonthIdx] && (
          <div
            className="absolute pointer-events-none z-30 transition-all duration-150 ease-out"
            style={{
              left: `${(getHoverPos(hoveredMonthIdx).x / width) * 100}%`,
              top: `${(Math.max(padding.top + 10, getHoverPos(hoveredMonthIdx).y) / height) * 100}%`,
              transform:
                getHoverPos(hoveredMonthIdx).x < width * 0.22
                  ? "translate(4%, -115%)"
                  : getHoverPos(hoveredMonthIdx).x > width * 0.78
                  ? "translate(-104%, -115%)"
                  : "translate(-50%, -115%)",
            }}
          >
            <div className="bg-[#1E293B]/95 backdrop-blur-[8px] text-white rounded-[8px] p-2.5 px-3.5 shadow-xl border border-white/10 space-y-1 select-none min-w-[150px]">
              <p className="text-[11px] font-medium text-[#94A3B8] leading-none">
                {metrics[hoveredMonthIdx].label}
              </p>
              {activeMode === "balances" && (
                <>
                  <p className="text-sm font-bold text-[#FFFFFF] tracking-tight font-mono leading-tight">
                    AMB: ₹{Math.round(metrics[hoveredMonthIdx].avg).toLocaleString("en-IN")}
                  </p>
                  <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/10 text-[9.5px] text-[#94A3B8]">
                    <span>Closing: ₹{Math.round(metrics[hoveredMonthIdx].closing || 0).toLocaleString("en-IN")}</span>
                    <span>Min: ₹{Math.round(metrics[hoveredMonthIdx].min).toLocaleString("en-IN")}</span>
                  </div>
                </>
              )}
              {activeMode === "cashflow" && (
                <>
                  <p className="text-sm font-bold text-emerald-400 tracking-tight font-mono leading-tight">
                    Inflow: ₹{Math.round(metrics[hoveredMonthIdx].credits).toLocaleString("en-IN")}
                  </p>
                  <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/10 text-[9.5px] text-[#94A3B8]">
                    <span className="text-rose-400">Out: ₹{Math.round(metrics[hoveredMonthIdx].debits).toLocaleString("en-IN")}</span>
                    <span className={metrics[hoveredMonthIdx].credits >= metrics[hoveredMonthIdx].debits ? "text-emerald-400" : "text-rose-400"}>
                      Net: {metrics[hoveredMonthIdx].credits >= metrics[hoveredMonthIdx].debits ? "+" : "-"}₹
                      {Math.abs(Math.round(metrics[hoveredMonthIdx].credits - metrics[hoveredMonthIdx].debits)).toLocaleString("en-IN")}
                    </span>
                  </div>
                </>
              )}
              {activeMode === "risk" && (
                <>
                  <p className={`text-sm font-bold tracking-tight font-mono leading-tight ${(metrics[hoveredMonthIdx].cashPercent || 0) > 25 ? "text-rose-400" : "text-amber-400"}`}>
                    Cash: {metrics[hoveredMonthIdx].cashPercent || 0}%
                  </p>
                  <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/10 text-[9.5px] text-[#94A3B8]">
                    <span>Bounces: {metrics[hoveredMonthIdx].bounces || 0}</span>
                    <span className={(metrics[hoveredMonthIdx].cashPercent || 0) > 25 ? "text-rose-400" : "text-emerald-400"}>
                      {(metrics[hoveredMonthIdx].cashPercent || 0) > 25 ? "High Cash Spike" : "Within Policy"}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[620px] overflow-visible">
          <defs>
            {/* Primary/Safe AMB Gradient (#818CF8 to #4F46E5) */}
            <linearGradient id="ambBarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#818CF8" />
              <stop offset="100%" stopColor="#4F46E5" />
            </linearGradient>

            {/* Closing Balance Gradient */}
            <linearGradient id="closingBarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#0284C7" />
            </linearGradient>

            {/* Spline Area Gradient */}
            <linearGradient id="monthlyAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366F1" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.00" />
            </linearGradient>

            {/* Horizontal stroke gradient for Spline curve */}
            <linearGradient id="monthlySplineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#6366F1" />
              <stop offset="100%" stopColor="#8B5CF6" />
            </linearGradient>

            {/* Cashflow Gradients */}
            <linearGradient id="creditBarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="debitBarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FB7185" />
              <stop offset="100%" stopColor="#E11D48" />
            </linearGradient>

            {/* Risk Gradients: Amber for Safe, Rose for Critical */}
            <linearGradient id="cashBarAmberGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FBBF24" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>
            <linearGradient id="cashBarRoseGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FB7185" />
              <stop offset="100%" stopColor="#BE123C" />
            </linearGradient>

            {/* Glow Filters */}
            <filter id="mBenchmarkGlow" x="-20%" y="-40%" width="140%" height="180%">
              <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#F59E0B" floodOpacity="0.45" />
            </filter>
            <filter id="tTargetGlow" x="-20%" y="-40%" width="140%" height="180%">
              <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#10B981" floodOpacity="0.45" />
            </filter>
            <filter id="barHoverGlow" x="-30%" y="-20%" width="160%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#6366F1" floodOpacity="0.45" />
            </filter>
            <filter id="nodeGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#6366F1" floodOpacity="0.65" />
            </filter>
          </defs>

          {/* Ultra-faint Horizontal Grid lines (no vertical lines) */}
          {[0, 0.25, 0.5, 0.75, 1].map((r, i) => {
            const y = height - padding.bottom - r * chartH;
            const val =
              activeMode === "balances"
                ? Math.round(minBalance + r * (maxBalance - minBalance))
                : activeMode === "cashflow"
                ? Math.round(r * maxFlow)
                : Math.round(r * maxCashPct);

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
                  {activeMode === "risk" ? `${val}%` : `₹${Math.round(val / 1000)}k`}
                </text>
              </g>
            );
          })}

          {/* ────────────────── MODE 1: BALANCE DYNAMICS ────────────────── */}
          {activeMode === "balances" && (
            <>
              {/* Benchmark M reference line with Right-Axis Pill Badge */}
              {benchmarkM > 0 && benchmarkY >= padding.top && benchmarkY <= height - padding.bottom && (
                <g>
                  <line
                    x1={padding.left}
                    y1={benchmarkY}
                    x2={width - padding.right}
                    y2={benchmarkY}
                    stroke="#F59E0B"
                    strokeDasharray="5 5"
                    strokeWidth="1.5"
                    filter="url(#mBenchmarkGlow)"
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
                      M: ₹{benchmarkM >= 1000 ? `${(benchmarkM / 1000).toFixed(0)}k` : benchmarkM}
                    </text>
                  </g>
                </g>
              )}

              {/* Target T reference line with Right-Axis Pill Badge */}
              {targetT && targetY && targetY >= padding.top && targetY <= height - padding.bottom && (
                <g>
                  <line
                    x1={padding.left}
                    y1={targetY}
                    x2={width - padding.right}
                    y2={targetY}
                    stroke="#10B981"
                    strokeDasharray="5 5"
                    strokeWidth="1.5"
                    filter="url(#tTargetGlow)"
                  />
                  <g transform={`translate(${width - padding.right + 6}, ${targetY - 9})`}>
                    <rect
                      width="76"
                      height="18"
                      rx="5"
                      fill="#D1FAE5"
                      stroke="#10B981"
                      strokeWidth="1"
                      strokeOpacity="0.5"
                    />
                    <text
                      x="38"
                      y="12.5"
                      textAnchor="middle"
                      className="fill-emerald-700 font-sans text-[9px] font-bold tracking-tight"
                    >
                      T: ₹{targetT >= 1000 ? `${(targetT / 1000).toFixed(0)}k` : targetT}
                    </text>
                  </g>
                </g>
              )}

              {/* SUB-VIEW A: GROUPED BAR GRAPH VIEW (DEFAULT) */}
              {balanceGraphStyle === "bar" ? (
                <>
                  {metrics.map((m, i) => {
                    const groupCenter = getSlotCenterX(i);
                    const barW = Math.min(22, slotW * 0.36);
                    const ambY = getBalanceY(m.avg);
                    const ambH = Math.max(4, height - padding.bottom - ambY);
                    const closingY = getBalanceY(m.closing || m.avg);
                    const closingH = Math.max(4, height - padding.bottom - closingY);
                    const minY = getBalanceY(m.min);
                    const maxY = getBalanceY(m.max);
                    const isHovered = hoveredMonthIdx === i;
                    const isDimmed = hoveredMonthIdx !== null && !isHovered;

                    return (
                      <g
                        key={i}
                        className="cursor-pointer transition-opacity duration-200"
                        style={{ opacity: isDimmed ? 0.7 : 1 }}
                        onMouseEnter={() => setHoveredMonthIdx(i)}
                        onMouseLeave={() => setHoveredMonthIdx(null)}
                      >
                        {/* Min-Max Whisker behind bars */}
                        <line
                          x1={groupCenter}
                          y1={maxY}
                          x2={groupCenter}
                          y2={minY}
                          stroke="#CBD5E1"
                          strokeWidth="2"
                          strokeDasharray="2 2"
                        />
                        <line
                          x1={groupCenter - 6}
                          y1={maxY}
                          x2={groupCenter + 6}
                          y2={maxY}
                          stroke="#CBD5E1"
                          strokeWidth="2"
                        />
                        <line
                          x1={groupCenter - 6}
                          y1={minY}
                          x2={groupCenter + 6}
                          y2={minY}
                          stroke="#CBD5E1"
                          strokeWidth="2"
                        />

                        {/* Bar 1: Sampled AMB with Rounded Top Caps (rx=4) */}
                        <rect
                          x={groupCenter - barW - 1.5}
                          y={ambY}
                          width={barW}
                          height={ambH}
                          rx="4"
                          fill="url(#ambBarGrad)"
                          filter={isHovered ? "url(#barHoverGlow)" : undefined}
                          className="transition-all duration-200"
                        />

                        {/* Bar 2: Closing Ledger Balance with Rounded Top Caps (rx=4) */}
                        <rect
                          x={groupCenter + 1.5}
                          y={closingY}
                          width={barW}
                          height={closingH}
                          rx="4"
                          fill="url(#closingBarGrad)"
                          filter={isHovered ? "url(#barHoverGlow)" : undefined}
                          className="transition-all duration-200"
                        />
                      </g>
                    );
                  })}
                </>
              ) : (
                /* SUB-VIEW B: SPLINE CURVE VIEW */
                <>
                  {ambAreaPath && <path d={ambAreaPath} fill="url(#monthlyAreaGrad)" />}
                  {ambPath && (
                    <path
                      d={ambPath}
                      fill="none"
                      stroke="url(#monthlySplineGrad)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                  {ambPoints.map((pt, i) => {
                    const isHovered = hoveredMonthIdx === i;
                    const isDimmed = hoveredMonthIdx !== null && !isHovered;

                    return (
                      <g
                        key={i}
                        className="cursor-pointer transition-opacity duration-200"
                        style={{ opacity: isDimmed ? 0.7 : 1 }}
                        onMouseEnter={() => setHoveredMonthIdx(i)}
                        onMouseLeave={() => setHoveredMonthIdx(null)}
                      >
                        <circle cx={pt.x} cy={pt.y} r="14" fill="transparent" />
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isHovered ? "6" : "4"}
                          fill="#FFFFFF"
                          stroke="#6366F1"
                          strokeWidth="2"
                          filter={isHovered ? "url(#nodeGlow)" : undefined}
                          className="transition-all duration-200 ease-out"
                        />
                      </g>
                    );
                  })}
                </>
              )}
            </>
          )}

          {/* ────────────────── MODE 2: CASHFLOW (CREDITS VS DEBITS) ────────────────── */}
          {activeMode === "cashflow" && (
            <>
              {metrics.map((m, i) => {
                const groupCenter = getSlotCenterX(i);
                const barW = Math.min(22, slotW * 0.36);
                const crY = getFlowY(m.credits);
                const crH = Math.max(4, height - padding.bottom - crY);
                const dbY = getFlowY(m.debits);
                const dbH = Math.max(4, height - padding.bottom - dbY);
                const isHovered = hoveredMonthIdx === i;
                const isDimmed = hoveredMonthIdx !== null && !isHovered;

                return (
                  <g
                    key={i}
                    className="cursor-pointer transition-opacity duration-200"
                    style={{ opacity: isDimmed ? 0.7 : 1 }}
                    onMouseEnter={() => setHoveredMonthIdx(i)}
                    onMouseLeave={() => setHoveredMonthIdx(null)}
                  >
                    {/* Inflow Credit Bar (rx=4) */}
                    <rect
                      x={groupCenter - barW - 1.5}
                      y={crY}
                      width={barW}
                      height={crH}
                      rx="4"
                      fill="url(#creditBarGrad)"
                      filter={isHovered ? "url(#barHoverGlow)" : undefined}
                      className="transition-all duration-200"
                    />

                    {/* Outflow Debit Bar (rx=4) */}
                    <rect
                      x={groupCenter + 1.5}
                      y={dbY}
                      width={barW}
                      height={dbH}
                      rx="4"
                      fill="url(#debitBarGrad)"
                      filter={isHovered ? "url(#barHoverGlow)" : undefined}
                      className="transition-all duration-200"
                    />
                  </g>
                );
              })}
            </>
          )}

          {/* ────────────────── MODE 3: RISK (CASH DEPOSIT %) ────────────────── */}
          {activeMode === "risk" && (
            <>
              {/* 25% Safe Policy Threshold reference line */}
              {cashLimitY >= padding.top && cashLimitY <= height - padding.bottom && (
                <g>
                  <line
                    x1={padding.left}
                    y1={cashLimitY}
                    x2={width - padding.right}
                    y2={cashLimitY}
                    stroke="#F59E0B"
                    strokeDasharray="5 5"
                    strokeWidth="1.5"
                    filter="url(#mBenchmarkGlow)"
                  />
                  <g transform={`translate(${width - padding.right + 6}, ${cashLimitY - 9})`}>
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
                      Safe: ≤25%
                    </text>
                  </g>
                </g>
              )}

              {metrics.map((m, i) => {
                const groupCenter = getSlotCenterX(i);
                const barW = Math.min(28, slotW * 0.48);
                const pct = m.cashPercent || 0;
                const barY = getRiskY(pct);
                const barH = Math.max(4, height - padding.bottom - barY);
                const isHigh = pct > 25;
                const isHovered = hoveredMonthIdx === i;
                const isDimmed = hoveredMonthIdx !== null && !isHovered;

                return (
                  <g
                    key={i}
                    className="cursor-pointer transition-opacity duration-200"
                    style={{ opacity: isDimmed ? 0.7 : 1 }}
                    onMouseEnter={() => setHoveredMonthIdx(i)}
                    onMouseLeave={() => setHoveredMonthIdx(null)}
                  >
                    {/* Background Slot Bar */}
                    <rect
                      x={groupCenter - barW / 2}
                      y={padding.top}
                      width={barW}
                      height={chartH}
                      rx="4"
                      fill="rgba(241, 245, 249, 0.45)"
                    />

                    {/* Cash % Bar (rx=4) */}
                    <rect
                      x={groupCenter - barW / 2}
                      y={barY}
                      width={barW}
                      height={barH}
                      rx="4"
                      fill={isHigh ? "url(#cashBarRoseGrad)" : "url(#cashBarAmberGrad)"}
                      filter={isHovered ? "url(#barHoverGlow)" : undefined}
                      className="transition-all duration-200"
                    />

                    {/* Bounces Badge on top of Bar */}
                    {m.bounces > 0 && (
                      <g transform={`translate(${groupCenter}, ${Math.max(padding.top - 8, barY - 14)})`}>
                        <circle r="7.5" fill="#FDA4AF" stroke="#E11D48" strokeWidth="1" />
                        <text
                          y="3"
                          textAnchor="middle"
                          className="fill-rose-900 font-sans text-[8.5px] font-extrabold"
                        >
                          {m.bounces}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </>
          )}

          {/* Baseline */}
          <line
            x1={padding.left}
            y1={height - padding.bottom}
            x2={width - padding.right}
            y2={height - padding.bottom}
            stroke="#F1F5F9"
            strokeWidth="1"
          />

          {/* X-Axis Month Labels */}
          {metrics.map((m, i) => {
            const x = getSlotCenterX(i);
            const isHovered = hoveredMonthIdx === i;

            return (
              <text
                key={i}
                x={x}
                y={height - padding.bottom + 20}
                textAnchor="middle"
                className={`font-sans text-[11px] font-medium uppercase tracking-wider transition-colors duration-150 ${
                  isHovered ? "fill-[#4F46E5] font-semibold" : "fill-[#94A3B8]"
                }`}
              >
                {m.label || m.month}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Chart Footer: Clean Modern Legend and Scrub Details */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pt-3 border-t border-slate-100">
        {/* Dynamic Legend */}
        <div className="flex items-center gap-4 flex-wrap text-xs font-semibold text-slate-600">
          {activeMode === "balances" && (
            <>
              <span className="flex items-center gap-1.5 text-indigo-600">
                <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-b from-[#818CF8] to-[#4F46E5]" />
                Sampled AMB (Avg)
              </span>
              <span className="flex items-center gap-1.5 text-sky-600">
                <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-b from-[#38BDF8] to-[#0284C7]" />
                Closing Balance
              </span>
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-3 h-0.5 bg-slate-300" />
                Min–Max Whisker
              </span>
            </>
          )}
          {activeMode === "cashflow" && (
            <>
              <span className="flex items-center gap-1.5 text-emerald-600">
                <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-b from-[#10B981] to-[#059669]" />
                Credits (Inflow)
              </span>
              <span className="flex items-center gap-1.5 text-rose-500">
                <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-b from-[#FB7185] to-[#E11D48]" />
                Debits (Outflow)
              </span>
            </>
          )}
          {activeMode === "risk" && (
            <>
              <span className="flex items-center gap-1.5 text-amber-600">
                <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-b from-[#FBBF24] to-[#D97706]" />
                Cash Deposit % (&le; 25% Safe)
              </span>
              <span className="flex items-center gap-1.5 text-rose-500">
                <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-b from-[#FB7185] to-[#E11D48]" />
                High Risk (&gt; 25%)
              </span>
              <span className="flex items-center gap-1.5 text-rose-500">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-100 border border-rose-500" />
                Bounces Badge
              </span>
            </>
          )}
        </div>

        {/* Dynamic Hover Details Pill */}
        {hoveredMonthIdx !== null ? (
          <div className="flex items-center gap-3 font-mono font-medium text-xs bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[#4F46E5] uppercase font-bold text-[10px]">
              {metrics[hoveredMonthIdx].label}:
            </span>
            {activeMode === "balances" && (
              <>
                <span>AMB: ₹{Math.round(metrics[hoveredMonthIdx].avg).toLocaleString("en-IN")}</span>
                <span className="text-slate-300">|</span>
                <span>Closing: ₹{Math.round(metrics[hoveredMonthIdx].closing || 0).toLocaleString("en-IN")}</span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500">Min: ₹{Math.round(metrics[hoveredMonthIdx].min).toLocaleString("en-IN")}</span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500">Max: ₹{Math.round(metrics[hoveredMonthIdx].max).toLocaleString("en-IN")}</span>
              </>
            )}
            {activeMode === "cashflow" && (
              <>
                <span className="text-emerald-600">In: ₹{Math.round(metrics[hoveredMonthIdx].credits).toLocaleString("en-IN")}</span>
                <span className="text-slate-300">|</span>
                <span className="text-rose-500">Out: ₹{Math.round(metrics[hoveredMonthIdx].debits).toLocaleString("en-IN")}</span>
                <span className="text-slate-300">|</span>
                <span className={metrics[hoveredMonthIdx].credits >= metrics[hoveredMonthIdx].debits ? "text-emerald-600" : "text-rose-500"}>
                  Net: {metrics[hoveredMonthIdx].credits >= metrics[hoveredMonthIdx].debits ? "+" : "-"}₹
                  {Math.abs(Math.round(metrics[hoveredMonthIdx].credits - metrics[hoveredMonthIdx].debits)).toLocaleString("en-IN")}
                </span>
              </>
            )}
            {activeMode === "risk" && (
              <>
                <span className="text-amber-600">Cash: {metrics[hoveredMonthIdx].cashPercent || 0}%</span>
                <span className="text-slate-300">|</span>
                <span className={metrics[hoveredMonthIdx].bounces > 0 ? "text-rose-500 font-bold" : "text-slate-600"}>
                  Bounces: {metrics[hoveredMonthIdx].bounces || 0}
                </span>
              </>
            )}
          </div>
        ) : (
          <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[15px]">touch_app</span>
            <span>Hover over bars to inspect monthly breakdown</span>
          </span>
        )}
      </div>
    </div>
  );
};

export default EVVMonthlyMetricsChart;
