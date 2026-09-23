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

  const width = 760;
  const height = 280;
  const padding = { left: 65, right: 25, top: 32, bottom: 45 };
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
  const dailyPoints = metrics.map((m, i) => ({ x: getX(i), y: getBalanceY(m.avgDailyBalance || m.avg) }));
  const closingPoints = metrics.map((m, i) => ({ x: getX(i), y: getBalanceY(m.closing) }));
  const minPoints = metrics.map((m, i) => ({ x: getX(i), y: getBalanceY(m.min) }));
  const maxPoints = metrics.map((m, i) => ({ x: getX(i), y: getBalanceY(m.max) }));

  const ambPath = makeSpline(ambPoints);
  const ambAreaPath = ambPoints.length > 0
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

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4 select-none">
      {/* Chart Top Header & Mode Switcher */}
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400 text-lg">bar_chart</span>
            <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Monthly Financial Metrics Bar Visualizer
            </h4>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
              {metrics.length} Months
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Comparative bar charts of monthly sampled AMB balances, cashflow, and risk factors
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Sub-toggle for Balances: Bar vs Spline */}
          {activeMode === "balances" && (
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl gap-0.5">
              <button
                type="button"
                onClick={() => setBalanceGraphStyle("bar")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  balanceGraphStyle === "bar"
                    ? "bg-white dark:bg-slate-700 text-indigo-700 dark:text-white shadow-2xs"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
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
                    ? "bg-white dark:bg-slate-700 text-indigo-700 dark:text-white shadow-2xs"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
                }`}
              >
                <span className="material-symbols-outlined text-xs">show_chart</span>
                <span>Spline</span>
              </button>
            </div>
          )}

          <div className="flex items-center bg-slate-100/90 dark:bg-slate-800/90 p-1 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setActiveMode("balances")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeMode === "balances"
                  ? "bg-white dark:bg-slate-700 text-indigo-700 dark:text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
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
                  ? "bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <span className="material-symbols-outlined text-sm">bar_chart</span>
              <span>Credits vs Debits</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMode("risk")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeMode === "risk"
                  ? "bg-white dark:bg-slate-700 text-rose-700 dark:text-rose-300 shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <span className="material-symbols-outlined text-sm">warning</span>
              <span>Cash % Bars</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main SVG Visualization Canvas */}
      <div className="relative w-full overflow-x-auto scrollbar-hide">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[620px] overflow-visible">
          <defs>
            <linearGradient id="ambBarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#6D28D9" />
            </linearGradient>
            <linearGradient id="closingBarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#0284C7" />
            </linearGradient>
            <linearGradient id="monthlyAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.01" />
            </linearGradient>
            <linearGradient id="creditBarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="debitBarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F43F5E" />
              <stop offset="100%" stopColor="#E11D48" />
            </linearGradient>
            <linearGradient id="cashBarAmberGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FBBF24" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>
            <linearGradient id="cashBarRoseGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F43F5E" />
              <stop offset="100%" stopColor="#BE123C" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((r, i) => {
            const y = height - padding.bottom - r * chartH;
            const val = activeMode === "balances"
              ? Math.round(minBalance + r * (maxBalance - minBalance))
              : activeMode === "cashflow"
              ? Math.round(r * maxFlow)
              : Math.round(r * maxCashPct);

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
                  y={y + 3}
                  textAnchor="end"
                  className="fill-slate-400 font-mono text-[9px]"
                >
                  {activeMode === "risk" ? `${val}%` : `₹${Math.round(val / 1000)}k`}
                </text>
              </g>
            );
          })}

          {/* ────────────────── MODE 1: BALANCE DYNAMICS (BAR GRAPH / SPLINE) ────────────────── */}
          {activeMode === "balances" && (
            <>
              {/* Benchmark M reference line */}
              {benchmarkM > 0 && benchmarkY >= padding.top && benchmarkY <= height - padding.bottom && (
                <g>
                  <line
                    x1={padding.left}
                    y1={benchmarkY}
                    x2={width - padding.right}
                    y2={benchmarkY}
                    stroke="#8B5CF6"
                    strokeDasharray="5 4"
                    strokeWidth="1.5"
                    className="opacity-75"
                  />
                  <text
                    x={width - padding.right}
                    y={benchmarkY - 5}
                    textAnchor="end"
                    className="fill-indigo-600 dark:fill-indigo-400 text-[9px] font-mono font-bold"
                  >
                    Benchmark M: ₹{benchmarkM.toLocaleString("en-IN")}
                  </text>
                </g>
              )}

              {/* Target T reference line */}
              {targetT && targetY && targetY >= padding.top && targetY <= height - padding.bottom && (
                <g>
                  <line
                    x1={padding.left}
                    y1={targetY}
                    x2={width - padding.right}
                    y2={targetY}
                    stroke="#10B981"
                    strokeDasharray="5 4"
                    strokeWidth="1.5"
                    className="opacity-75"
                  />
                  <text
                    x={width - padding.right}
                    y={targetY - 5}
                    textAnchor="end"
                    className="fill-emerald-600 text-[9px] font-mono font-bold"
                  >
                    Target T: ₹{targetT.toLocaleString("en-IN")}
                  </text>
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

                    return (
                      <g
                        key={i}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredMonthIdx(i)}
                        onMouseLeave={() => setHoveredMonthIdx(null)}
                      >
                        {/* Min-Max Whisker behind bars */}
                        <line
                          x1={groupCenter}
                          y1={maxY}
                          x2={groupCenter}
                          y2={minY}
                          stroke="#94A3B8"
                          strokeWidth="2"
                          strokeDasharray="2 2"
                          className="opacity-60"
                        />
                        {/* Whisker caps */}
                        <line
                          x1={groupCenter - 6}
                          y1={maxY}
                          x2={groupCenter + 6}
                          y2={maxY}
                          stroke="#94A3B8"
                          strokeWidth="2"
                        />
                        <line
                          x1={groupCenter - 6}
                          y1={minY}
                          x2={groupCenter + 6}
                          y2={minY}
                          stroke="#94A3B8"
                          strokeWidth="2"
                        />

                        {/* Bar 1: Sampled AMB */}
                        <rect
                          x={groupCenter - barW - 1.5}
                          y={ambY}
                          width={barW}
                          height={ambH}
                          rx="5"
                          fill="url(#ambBarGrad)"
                          className={`transition-all duration-200 ${
                            isHovered ? "filter drop-shadow(0 4px 8px rgba(139,92,246,0.35)) opacity-100" : "opacity-90"
                          }`}
                        />

                        {/* Bar 2: Closing Balance */}
                        <rect
                          x={groupCenter + 1.5}
                          y={closingY}
                          width={barW}
                          height={closingH}
                          rx="5"
                          fill="url(#closingBarGrad)"
                          className={`transition-all duration-200 ${
                            isHovered ? "filter drop-shadow(0 4px 8px rgba(56,189,248,0.35)) opacity-100" : "opacity-90"
                          }`}
                        />

                        {/* Value Tag over AMB Bar */}
                        <text
                          x={groupCenter - barW / 2 - 1.5}
                          y={Math.max(padding.top - 4, ambY - 6)}
                          textAnchor="middle"
                          className="font-mono font-black text-[9px] fill-indigo-700 dark:fill-indigo-400"
                        >
                          ₹{Math.round(m.avg / 1000)}k
                        </text>
                      </g>
                    );
                  })}
                </>
              ) : (
                /* SUB-VIEW B: SPLINE AREA CURVE VIEW */
                <>
                  {ambAreaPath && <path d={ambAreaPath} fill="url(#monthlyAreaGrad)" />}
                  {metrics.map((_, i) => (
                    <line
                      key={i}
                      x1={getX(i)}
                      y1={minPoints[i].y}
                      x2={getX(i)}
                      y2={maxPoints[i].y}
                      stroke="#CBD5E1"
                      strokeWidth="3"
                      strokeLinecap="round"
                      className="opacity-60"
                    />
                  ))}
                  <path d={makeSpline(dailyPoints)} fill="none" stroke="#94A3B8" strokeWidth="2" strokeDasharray="4 4" />
                  <path d={makeSpline(closingPoints)} fill="none" stroke="#0EA5E9" strokeWidth="2" />
                  <path d={ambPath} fill="none" stroke="#7C3AED" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                  {ambPoints.map((pt, i) => (
                    <g
                      key={i}
                      onMouseEnter={() => setHoveredMonthIdx(i)}
                      onMouseLeave={() => setHoveredMonthIdx(null)}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={hoveredMonthIdx === i ? "7.5" : "5"}
                        fill="#FFFFFF"
                        stroke="#7C3AED"
                        strokeWidth="3"
                        className="transition-all duration-200"
                      />
                    </g>
                  ))}
                </>
              )}
            </>
          )}

          {/* ────────────────── MODE 2: CASHFLOW (CREDITS vs DEBITS BARS) ────────────────── */}
          {activeMode === "cashflow" && (
            <>
              {metrics.map((m, i) => {
                const groupX = getSlotCenterX(i);
                const barW = Math.min(24, slotW * 0.36);
                const creditH = height - padding.bottom - getFlowY(m.credits);
                const debitH = height - padding.bottom - getFlowY(m.debits);
                const isHovered = hoveredMonthIdx === i;

                return (
                  <g
                    key={i}
                    onMouseEnter={() => setHoveredMonthIdx(i)}
                    onMouseLeave={() => setHoveredMonthIdx(null)}
                    className="cursor-pointer"
                  >
                    {/* Credit Bar */}
                    <rect
                      x={groupX - barW - 2}
                      y={getFlowY(m.credits)}
                      width={barW}
                      height={Math.max(2, creditH)}
                      rx="5"
                      fill="url(#creditBarGrad)"
                      className={`transition-all duration-200 ${isHovered ? "opacity-100 filter drop-shadow(0 4px 6px rgba(16,185,129,0.3))" : "opacity-90"}`}
                    />

                    {/* Debit Bar */}
                    <rect
                      x={groupX + 2}
                      y={getFlowY(m.debits)}
                      width={barW}
                      height={Math.max(2, debitH)}
                      rx="5"
                      fill="url(#debitBarGrad)"
                      className={`transition-all duration-200 ${isHovered ? "opacity-100 filter drop-shadow(0 4px 6px rgba(244,63,94,0.3))" : "opacity-90"}`}
                    />

                    {/* Credit Value Label */}
                    <text
                      x={groupX - barW / 2 - 2}
                      y={Math.max(padding.top - 4, getFlowY(m.credits) - 6)}
                      textAnchor="middle"
                      className="font-mono font-black text-[9px] fill-emerald-600"
                    >
                      +₹{Math.round(m.credits / 1000)}k
                    </text>
                  </g>
                );
              })}
            </>
          )}

          {/* ────────────────── MODE 3: RISK & BOUNCES (CASH % COLUMN BARS) ────────────────── */}
          {activeMode === "risk" && (
            <>
              {/* 25% Threshold line */}
              {cashLimitY >= padding.top && cashLimitY <= height - padding.bottom && (
                <g>
                  <line
                    x1={padding.left}
                    y1={cashLimitY}
                    x2={width - padding.right}
                    y2={cashLimitY}
                    stroke="#EF4444"
                    strokeDasharray="4 4"
                    strokeWidth="1.5"
                    className="opacity-80"
                  />
                  <text
                    x={width - padding.right}
                    y={cashLimitY - 5}
                    textAnchor="end"
                    className="fill-rose-600 font-mono text-[9px] font-black uppercase"
                  >
                    25% Max Cash Limit
                  </text>
                </g>
              )}

              {/* Cash % Bars */}
              {metrics.map((m, i) => {
                const groupX = getSlotCenterX(i);
                const barW = Math.min(30, slotW * 0.45);
                const pct = m.cashPercent || 0;
                const barH = (pct / (maxCashPct || 1)) * chartH;
                const barY = height - padding.bottom - barH;
                const isHighRisk = pct > 25;
                const isHovered = hoveredMonthIdx === i;

                return (
                  <g
                    key={i}
                    onMouseEnter={() => setHoveredMonthIdx(i)}
                    onMouseLeave={() => setHoveredMonthIdx(null)}
                    className="cursor-pointer"
                  >
                    {/* Background track */}
                    <rect
                      x={groupX - barW / 2}
                      y={padding.top}
                      width={barW}
                      height={chartH}
                      rx="6"
                      fill="#F1F5F9"
                      className="dark:fill-slate-800/40 opacity-50"
                    />

                    {/* Active Cash % Bar */}
                    <rect
                      x={groupX - barW / 2}
                      y={barY}
                      width={barW}
                      height={Math.max(4, barH)}
                      rx="6"
                      fill={isHighRisk ? "url(#cashBarRoseGrad)" : "url(#cashBarAmberGrad)"}
                      className={`transition-all duration-200 ${
                        isHovered ? "opacity-100 filter drop-shadow(0 4px 8px rgba(0,0,0,0.2))" : "opacity-90"
                      }`}
                    />

                    {/* Percentage text */}
                    <text
                      x={groupX}
                      y={Math.max(padding.top - 4, barY - 6)}
                      textAnchor="middle"
                      className={`font-mono font-black text-[9px] ${
                        isHighRisk ? "fill-rose-600" : "fill-amber-600"
                      }`}
                    >
                      {pct}%
                    </text>

                    {/* Bounce Badge if any */}
                    {m.bounces > 0 && (
                      <g transform={`translate(${groupX}, ${padding.top + 16})`}>
                        <circle
                          cx="0"
                          cy="0"
                          r="10"
                          fill="#FEE2E2"
                          stroke="#EF4444"
                          strokeWidth="2"
                        />
                        <text
                          x="0"
                          y="3.5"
                          textAnchor="middle"
                          className="fill-rose-700 font-mono text-[9px] font-black"
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

          {/* Month X-Axis Labels */}
          {metrics.map((m, i) => {
            const x = balanceGraphStyle === "bar" || activeMode !== "balances" ? getSlotCenterX(i) : getX(i);
            const isHovered = hoveredMonthIdx === i;
            return (
              <g
                key={i}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredMonthIdx(i)}
                onMouseLeave={() => setHoveredMonthIdx(null)}
              >
                <text
                  x={x}
                  y={height - padding.bottom + 18}
                  textAnchor="middle"
                  className={`text-[10px] uppercase tracking-wider transition-all ${
                    isHovered
                      ? "fill-indigo-600 dark:fill-indigo-400 font-black text-[11px]"
                      : "fill-slate-500 font-bold"
                  }`}
                >
                  {m.label || m.month}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Chart Footer: Legend and Selected Month Scrub Details */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
        {/* Dynamic Legend */}
        <div className="flex items-center gap-4 flex-wrap text-xs font-bold">
          {activeMode === "balances" && (
            <>
              <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                <span className="w-3 h-3 bg-violet-600 rounded-xs" />
                Sampled AMB (Avg)
              </span>
              <span className="flex items-center gap-1.5 text-sky-600">
                <span className="w-3 h-3 bg-sky-500 rounded-xs" />
                Closing Balance
              </span>
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className="w-3 h-0.5 bg-slate-400" />
                Min–Max Whisker
              </span>
            </>
          )}
          {activeMode === "cashflow" && (
            <>
              <span className="flex items-center gap-1.5 text-emerald-600">
                <span className="w-3 h-3 bg-emerald-500 rounded-xs" />
                Total Credits (Inflow)
              </span>
              <span className="flex items-center gap-1.5 text-rose-600">
                <span className="w-3 h-3 bg-rose-500 rounded-xs" />
                Total Debits (Outflow)
              </span>
            </>
          )}
          {activeMode === "risk" && (
            <>
              <span className="flex items-center gap-1.5 text-amber-600">
                <span className="w-3 h-3 bg-amber-500 rounded-xs" />
                Cash Deposit % (Safe &le; 25%)
              </span>
              <span className="flex items-center gap-1.5 text-rose-600">
                <span className="w-3 h-3 bg-rose-500 rounded-xs" />
                Cash Deposit % (High Risk &gt; 25%)
              </span>
              <span className="flex items-center gap-1.5 text-rose-600">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-100 border border-rose-500" />
                Bounces Tag
              </span>
            </>
          )}
        </div>

        {/* Dynamic Hover Details */}
        {hoveredMonthIdx !== null ? (
          <div className="flex items-center gap-3 font-mono font-bold text-xs bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
            <span className="text-indigo-600 dark:text-indigo-400 uppercase font-black text-[10px]">
              {metrics[hoveredMonthIdx].label}:
            </span>
            {activeMode === "balances" && (
              <>
                <span>AMB: ₹{Math.round(metrics[hoveredMonthIdx].avg).toLocaleString("en-IN")}</span>
                <span className="text-slate-400">|</span>
                <span>Closing: ₹{Math.round(metrics[hoveredMonthIdx].closing || 0).toLocaleString("en-IN")}</span>
                <span className="text-slate-400">|</span>
                <span className="text-slate-500">Min: ₹{Math.round(metrics[hoveredMonthIdx].min).toLocaleString("en-IN")}</span>
                <span className="text-slate-400">|</span>
                <span className="text-slate-500">Max: ₹{Math.round(metrics[hoveredMonthIdx].max).toLocaleString("en-IN")}</span>
              </>
            )}
            {activeMode === "cashflow" && (
              <>
                <span className="text-emerald-600">In: ₹{Math.round(metrics[hoveredMonthIdx].credits).toLocaleString("en-IN")}</span>
                <span className="text-slate-400">|</span>
                <span className="text-rose-600">Out: ₹{Math.round(metrics[hoveredMonthIdx].debits).toLocaleString("en-IN")}</span>
                <span className="text-slate-400">|</span>
                <span className={metrics[hoveredMonthIdx].credits >= metrics[hoveredMonthIdx].debits ? "text-emerald-600" : "text-rose-600"}>
                  Net: {metrics[hoveredMonthIdx].credits >= metrics[hoveredMonthIdx].debits ? "+" : "-"}₹{Math.abs(Math.round(metrics[hoveredMonthIdx].credits - metrics[hoveredMonthIdx].debits)).toLocaleString("en-IN")}
                </span>
              </>
            )}
            {activeMode === "risk" && (
              <>
                <span className="text-amber-600">Cash: {metrics[hoveredMonthIdx].cashPercent || 0}%</span>
                <span className="text-slate-400">|</span>
                <span className={metrics[hoveredMonthIdx].bounces > 0 ? "text-rose-600 font-black" : "text-slate-600"}>
                  Bounces: {metrics[hoveredMonthIdx].bounces || 0}
                </span>
              </>
            )}
          </div>
        ) : (
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            Hover over bars to inspect monthly breakdown
          </span>
        )}
      </div>
    </div>
  );
};

export default EVVMonthlyMetricsChart;
