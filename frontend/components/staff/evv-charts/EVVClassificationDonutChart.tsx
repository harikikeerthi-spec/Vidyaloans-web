"use client";

import React, { useState } from "react";

interface ClassificationData {
  bouncesCount?: number;
  cashDepositsTotal?: number;
  digitalCreditsTotal?: number;
  passThroughTotal?: number;
  normalDebitsTotal?: number;
  salaryCreditsTotal?: number;
}

interface EVVClassificationDonutChartProps {
  data: ClassificationData;
  size?: number; // default 280
}

interface Slice {
  label: string;
  value: number;
  color: string;
  category: "credit" | "debit" | "risk";
  icon: string;
  gradStart: string;
  gradEnd: string;
}

export const EVVClassificationDonutChart: React.FC<EVVClassificationDonutChartProps> = ({
  data,
  size = 280,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [chartType, setChartType] = useState<"bars" | "donut">("bars");

  const rawSlices: Slice[] = [
    {
      label: "Digital & Salary Inflows",
      value: (data.salaryCreditsTotal || 0) + (data.digitalCreditsTotal || 0),
      color: "#10B981",
      category: "credit",
      icon: "account_balance",
      gradStart: "#10B981",
      gradEnd: "#047857",
    },
    {
      label: "Physical Cash Deposits",
      value: data.cashDepositsTotal || 0,
      color: "#F59E0B",
      category: "risk",
      icon: "payments",
      gradStart: "#F59E0B",
      gradEnd: "#D97706",
    },
    {
      label: "Standard Outflows",
      value: data.normalDebitsTotal || 0,
      color: "#6366F1",
      category: "debit",
      icon: "shopping_cart",
      gradStart: "#6366F1",
      gradEnd: "#4338CA",
    },
    {
      label: "Pass-Through Withdrawals",
      value: data.passThroughTotal || 0,
      color: "#EC4899",
      category: "risk",
      icon: "outbox",
      gradStart: "#EC4899",
      gradEnd: "#BE185D",
    },
    {
      label: "Bounces & Charges",
      value: (data.bouncesCount || 0) * 590, // Approximate charge per bounce
      color: "#EF4444",
      category: "risk",
      icon: "error",
      gradStart: "#EF4444",
      gradEnd: "#B91C1C",
    },
  ];

  // Filter non-zero slices
  const slices = rawSlices.filter((s) => s.value > 0);
  const totalVal = slices.reduce((acc, s) => acc + s.value, 0) || 1;
  const maxVal = Math.max(...slices.map((s) => s.value), 1);

  // Donut geometry
  const cx = 140;
  const cy = 140;
  const outerR = 95;
  const innerR = 60;

  let currentAngle = -90; // Start at top

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
    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4 select-none">
      {/* Header with Switcher */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400 text-lg">donut_small</span>
            <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Transaction Volume & Classification Bar Graph
            </h4>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Breakdown of statement funds across digital salary, physical cash, and pass-through outflows
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl gap-0.5">
          <button
            type="button"
            onClick={() => setChartType("bars")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              chartType === "bars"
                ? "bg-white dark:bg-slate-700 text-indigo-700 dark:text-white shadow-2xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <span className="material-symbols-outlined text-sm">bar_chart</span>
            <span>Bar Graph</span>
          </button>
          <button
            type="button"
            onClick={() => setChartType("donut")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              chartType === "donut"
                ? "bg-white dark:bg-slate-700 text-indigo-700 dark:text-white shadow-2xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <span className="material-symbols-outlined text-sm">donut_large</span>
            <span>Donut</span>
          </button>
        </div>
      </div>

      {/* MODE 1: HORIZONTAL COMPARATIVE BARS VIEW (DEFAULT) */}
      {chartType === "bars" ? (
        <div className="space-y-3.5 pt-1">
          {slices.map((item, idx) => {
            const isHovered = hoveredIdx === idx;
            const pct = ((item.value / totalVal) * 100).toFixed(1);
            const relativeBarPct = Math.round((item.value / maxVal) * 100);

            return (
              <div
                key={idx}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  isHovered
                    ? "bg-slate-50 dark:bg-slate-800 border-indigo-200 dark:border-indigo-800 shadow-sm"
                    : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800"
                }`}
              >
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black text-white"
                      style={{ backgroundColor: item.color }}
                    >
                      <span className="material-symbols-outlined text-sm">{item.icon}</span>
                    </span>
                    <span className="text-xs font-black text-slate-800 dark:text-white">
                      {item.label}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                        item.category === "credit"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : item.category === "debit"
                          ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                          : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                      }`}
                    >
                      {item.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <span className="text-xs font-black font-mono text-slate-900 dark:text-white">
                      ₹{Math.round(item.value).toLocaleString("en-IN")}
                    </span>
                    <span className="px-2 py-0.5 rounded-lg text-xs font-black font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {pct}%
                    </span>
                  </div>
                </div>

                {/* Progress Bar Track */}
                <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
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
      ) : (
        /* MODE 2: DONUT CHART VIEW */
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-3">
          <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
            <svg viewBox="0 0 280 280" className="w-full h-full transform -rotate-90">
              {slicePaths.map((item, idx) => (
                <path
                  key={idx}
                  d={item.pathData}
                  fill={item.slice.color}
                  className={`transition-all duration-200 cursor-pointer ${
                    hoveredIdx === idx ? "opacity-100 filter drop-shadow(0 4px 10px rgba(0,0,0,0.3))" : "opacity-90"
                  }`}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] font-bold uppercase text-slate-400">Total Classified</span>
              <span className="text-sm font-black text-slate-900 dark:text-white font-mono">
                ₹{Math.round(totalVal).toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          {/* Donut Legend */}
          <div className="flex-1 space-y-2">
            {slices.map((item, idx) => (
              <div
                key={idx}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={`flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer ${
                  hoveredIdx === idx ? "bg-slate-100 dark:bg-slate-800" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{item.label}</span>
                </div>
                <span className="text-xs font-bold font-mono text-slate-900 dark:text-white">
                  ₹{Math.round(item.value).toLocaleString("en-IN")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EVVClassificationDonutChart;
