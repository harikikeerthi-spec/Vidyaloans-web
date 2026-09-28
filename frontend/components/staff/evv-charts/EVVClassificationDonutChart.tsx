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
  const [chartType, setChartType] = useState<"donut" | "bars">("donut");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const src = data || classification;
  if (!src) return null;

  const salaryVal = src.salaryCreditsTotal ?? src.digitalSalaryCredits ?? 0;
  const onlineCreditsVal = src.digitalCreditsTotal ?? src.otherOnlineCredits ?? 0;
  const cashVal = src.cashDepositsTotal ?? src.physicalCashDeposits ?? 0;
  const passThroughVal = src.passThroughTotal ?? src.atmCashWithdrawals ?? 0;
  const debitsVal = src.normalDebitsTotal ?? src.otherDebits ?? 0;

  // Semantic Financial Palette:
  // Verified Salary Credits: Emerald Green (#10b981)
  // Other Digital Credits: Azure Blue (#3b82f6)
  // Physical Cash Deposits: Amber/Orange (#f59e0b)
  // Pass-Through / Outflows: Rose (#e11d48)
  // Regular Operating Debits: Slate (#64748b)
  const slices = [
    {
      id: "salary",
      label: "Verified Salary Credits",
      value: salaryVal,
      color: "#10b981",
      dotClass: "bg-emerald-500",
      activeBg: "bg-emerald-50/50 border-emerald-100",
      activeBadge: "bg-emerald-100 text-emerald-700",
      gradStart: "#34d399",
      gradEnd: "#10b981",
      icon: "payments",
      category: "credit",
    },
    {
      id: "digital",
      label: "Other Digital Credits",
      value: onlineCreditsVal,
      color: "#3b82f6",
      dotClass: "bg-blue-500",
      activeBg: "bg-blue-50/50 border-blue-100",
      activeBadge: "bg-blue-100 text-blue-700",
      gradStart: "#60a5fa",
      gradEnd: "#3b82f6",
      icon: "account_balance_wallet",
      category: "credit",
    },
    {
      id: "cash",
      label: "Physical Cash Deposits",
      value: cashVal,
      color: "#f59e0b",
      dotClass: "bg-amber-500",
      activeBg: "bg-amber-50/50 border-amber-100",
      activeBadge: "bg-amber-100 text-amber-700",
      gradStart: "#fbbf24",
      gradEnd: "#f59e0b",
      icon: "local_atm",
      category: "cash",
    },
    {
      id: "passThrough",
      label: "Pass-Through / Outflows",
      value: passThroughVal,
      color: "#e11d48",
      dotClass: "bg-rose-500",
      activeBg: "bg-rose-50/50 border-rose-100",
      activeBadge: "bg-rose-100 text-rose-700",
      gradStart: "#fb7185",
      gradEnd: "#e11d48",
      icon: "swap_horiz",
      category: "debit",
    },
    {
      id: "debits",
      label: "Regular Operating Debits",
      value: debitsVal,
      color: "#64748b",
      dotClass: "bg-slate-500",
      activeBg: "bg-slate-50 border-slate-200",
      activeBadge: "bg-slate-100 text-slate-700",
      gradStart: "#94a3b8",
      gradEnd: "#64748b",
      icon: "receipt_long",
      category: "debit",
    },
  ];

  const totalVal = slices.reduce((acc, s) => acc + s.value, 0);
  const effectiveTotal = totalVal > 0 ? totalVal : 1;
  const maxVal = Math.max(...slices.map((s) => s.value), 1);

  // SVG Donut geometry
  const cx = 140;
  const cy = 140;
  const outerR = 120;
  const innerR = 82;

  let currentAngle = 0;
  const slicePaths = slices.map((slice) => {
    const angleSpan = totalVal > 0 ? (slice.value / effectiveTotal) * 360 : 0;
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

    const pathData =
      angleSpan >= 359.99
        ? `M ${cx} ${cy - outerR} A ${outerR} ${outerR} 0 1 1 ${cx - 0.01} ${cy - outerR} L ${cx - 0.01} ${cy - innerR} A ${innerR} ${innerR} 0 1 0 ${cx} ${cy - innerR} Z`
        : angleSpan > 0
        ? [
            `M ${x1Inner} ${y1Inner}`,
            `L ${x1Outer} ${y1Outer}`,
            `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2Outer} ${y2Outer}`,
            `L ${x2Inner} ${y2Inner}`,
            `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x1Inner} ${y1Inner}`,
            "Z",
          ].join(" ")
        : "";

    return {
      pathData,
      slice,
      pct: totalVal > 0 ? ((slice.value / totalVal) * 100).toFixed(1) : "0.0",
    };
  });

  return (
    <div className="w-full rounded-2xl bg-white border border-gray-100 shadow-sm p-6">
      {/* Header & Controls */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Transaction Volume & Classification</h3>
          <p className="text-sm text-gray-500">Breakdown of statement funds</p>
        </div>

        {/* Segmented Control */}
        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setChartType("donut")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md cursor-pointer transition-all duration-200 ${
              chartType === "donut"
                ? "bg-white shadow text-gray-900"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            Donut
          </button>
          <button
            type="button"
            onClick={() => setChartType("bars")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md cursor-pointer transition-all duration-200 ${
              chartType === "bars"
                ? "bg-white shadow text-gray-900"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            Bar Graph
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      {chartType === "donut" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          {/* Chart Container */}
          <div className="relative flex justify-center items-center h-64 sm:h-72">
            <svg
              viewBox="0 0 280 280"
              className="w-60 h-60 sm:w-64 sm:h-64 transform -rotate-90 overflow-visible"
            >
              <defs>
                {slices.map((s, idx) => (
                  <linearGradient key={idx} id={`donutGrad-${idx}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={s.gradStart} />
                    <stop offset="100%" stopColor={s.gradEnd} />
                  </linearGradient>
                ))}
                <filter id="sliceHoverGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#3b82f6" floodOpacity="0.3" />
                </filter>
              </defs>

              {totalVal === 0 && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={(outerR + innerR) / 2}
                  fill="none"
                  stroke="#F1F5F9"
                  strokeWidth={outerR - innerR}
                />
              )}

              {slicePaths.map((item, idx) => {
                if (!item.pathData) return null;
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
                    filter={isHovered ? "url(#sliceHoverGlow)" : undefined}
                    className="transition-all duration-300 ease-in-out cursor-pointer"
                    style={{
                      opacity: isDimmed ? 0.5 : 1,
                      transform: isHovered ? "scale(1.03)" : "scale(1)",
                      transformOrigin: "140px 140px",
                    }}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  />
                );
              })}
            </svg>

            {/* Centralized Total Inside Donut Hole */}
            <div className="absolute text-center pointer-events-none select-none">
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-0.5">
                {hoveredIdx !== null ? slices[hoveredIdx].label : "Total Volume"}
              </p>
              <p className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                ₹{Math.round(hoveredIdx !== null ? slices[hoveredIdx].value : totalVal).toLocaleString("en-IN")}
              </p>
              {hoveredIdx !== null && (
                <p className="text-xs font-semibold text-blue-600 mt-0.5">
                  {slicePaths[hoveredIdx].pct}% Share
                </p>
              )}
            </div>
          </div>

          {/* Enhanced Actionable Data Legend (Right Column) */}
          <div className="flex flex-col space-y-2">
            {slices.map((item, idx) => {
              const isHovered = hoveredIdx === idx;
              const isDimmed = hoveredIdx !== null && !isHovered;
              const isZero = item.value === 0;
              const pct = totalVal > 0 ? ((item.value / totalVal) * 100).toFixed(1) : "0.0";

              if (isZero) {
                // Inactive / Zero Row
                return (
                  <div
                    key={idx}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    className={`flex items-center justify-between p-3 rounded-xl border border-transparent hover:bg-gray-50 transition-all cursor-pointer opacity-60 hover:opacity-100 ${
                      isHovered ? "ring-1 ring-gray-200 bg-gray-50" : ""
                    }`}
                    style={{ opacity: isDimmed ? 0.35 : 0.6 }}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${item.dotClass}`} />
                      <span className="font-medium text-gray-600 text-sm">{item.label}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-500 rounded-md">
                        0.0%
                      </span>
                      <span className="font-bold text-gray-600 text-sm">₹0</span>
                    </div>
                  </div>
                );
              }

              // Active Row
              return (
                <div
                  key={idx}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                    item.activeBg
                  } ${
                    isHovered
                      ? "ring-2 ring-offset-1 ring-blue-300 shadow-sm scale-[1.01]"
                      : ""
                  }`}
                  style={{ opacity: isDimmed ? 0.5 : 1 }}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${item.dotClass}`} />
                    <span className="font-medium text-gray-700 text-sm">{item.label}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-md ${item.activeBadge}`}>
                      {pct}%
                    </span>
                    <span className="font-bold text-gray-900 text-sm">
                      ₹{Math.round(item.value).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Bar Graph Comparative View */
        <div className="space-y-3 pt-1">
          {slices.map((item, idx) => {
            const isHovered = hoveredIdx === idx;
            const isDimmed = hoveredIdx !== null && !isHovered;
            const isZero = item.value === 0;
            const pct = totalVal > 0 ? ((item.value / totalVal) * 100).toFixed(1) : "0.0";
            const relativeBarPct = Math.round((item.value / maxVal) * 100);

            return (
              <div
                key={idx}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  isZero
                    ? "bg-white border-gray-100 hover:bg-gray-50 opacity-60"
                    : isHovered
                    ? `${item.activeBg} ring-1 ring-blue-200 shadow-sm`
                    : `${item.activeBg}`
                }`}
                style={{ opacity: isDimmed ? (isZero ? 0.35 : 0.5) : isZero ? 0.6 : 1 }}
              >
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-3 h-3 rounded-full ${item.dotClass}`} />
                    <span className="text-sm font-semibold text-gray-800">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                        isZero ? "bg-gray-100 text-gray-500" : item.activeBadge
                      }`}
                    >
                      {pct}%
                    </span>
                    <span className="text-sm font-bold text-gray-900">
                      ₹{Math.round(item.value).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
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
