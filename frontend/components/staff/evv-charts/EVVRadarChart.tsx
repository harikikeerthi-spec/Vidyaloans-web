"use client";

import React, { useState } from "react";
import { type EVV6ComponentResult } from "@/lib/evv-parser";

interface EVVRadarChartProps {
  sixComponent: EVV6ComponentResult;
  size?: number; // default 340
}

interface ComponentPoint {
  key: string;
  name: string;
  shortName: string;
  score: number;
  maxScore: number;
  ratio: number; // 0 to 1
  evidence?: string;
  color: string;
}

export const EVVRadarChart: React.FC<EVVRadarChartProps> = ({ sixComponent, size = 340 }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!sixComponent) return null;

  const c1 = sixComponent.component1;
  const c2 = sixComponent.component2;
  const c3 = sixComponent.component3;
  const c4 = sixComponent.component4;
  const c5 = sixComponent.component5;
  const c6 = sixComponent.component6;

  const components: ComponentPoint[] = [
    {
      key: "c1",
      name: "Average Balance Trend",
      shortName: "Balance Trend",
      score: c1?.score ?? 0,
      maxScore: c1?.maxScore ?? 25,
      ratio: Math.min(1, Math.max(0, (c1?.score ?? 0) / (c1?.maxScore || 25))),
      evidence: `6M AMB ₹${Math.round(c1?.sixMonthSampledAMB || 0).toLocaleString('en-IN')}`,
      color: "#8B5CF6",
    },
    {
      key: "c2",
      name: "Minimum-Balance Safety",
      shortName: "Min-Bal Safety",
      score: c2?.score ?? 0,
      maxScore: c2?.maxScore ?? 20,
      ratio: Math.min(1, Math.max(0, (c2?.score ?? 0) / (c2?.maxScore || 20))),
      evidence: `Safety Ratio: ${c2?.finalSafetyRatio ?? 100}%`,
      color: "#3B82F6",
    },
    {
      key: "c3",
      name: "Bounce-Free Record",
      shortName: "Bounce Record",
      score: c3?.score ?? 0,
      maxScore: c3?.maxScore ?? 20,
      ratio: Math.min(1, Math.max(0, (c3?.score ?? 0) / (c3?.maxScore || 20))),
      evidence: `${c3?.confirmedBounces ?? 0} Bounces`,
      color: "#10B981",
    },
    {
      key: "c4",
      name: "Verified Inflow Regularity",
      shortName: "Inflow Regularity",
      score: c4?.isRepaymentIncomeContributor === 'NO' ? 15 : (typeof c4?.score === 'number' ? c4.score : 0),
      maxScore: c4?.maxScore ?? 15,
      ratio: c4?.isRepaymentIncomeContributor === 'NO' ? 1 : Math.min(1, Math.max(0, (typeof c4?.score === 'number' ? c4.score : 0) / (c4?.maxScore || 15))),
      evidence: c4?.isRepaymentIncomeContributor === 'NO' ? "Non-Contributor (Scaled)" : `${c4?.recurringMonthsCount ?? 6}/6 mos verified`,
      color: "#F59E0B",
    },
    {
      key: "c5",
      name: "Cash-Deposit Ratio",
      shortName: "Cash Ratio",
      score: c5?.score ?? 0,
      maxScore: c5?.maxScore ?? 10,
      ratio: Math.min(1, Math.max(0, (c5?.score ?? 0) / (c5?.maxScore || 10))),
      evidence: `Cash: ${Math.round((c5?.cashRatio || 0) * 100)}%`,
      color: "#EC4899",
    },
    {
      key: "c6",
      name: "Withdrawal Discipline",
      shortName: "Withdrawal Disc.",
      score: c6?.score ?? 0,
      maxScore: c6?.maxScore ?? 10,
      ratio: Math.min(1, Math.max(0, (c6?.score ?? 0) / (c6?.maxScore || 10))),
      evidence: `${c6?.passThroughEvents?.length || 0} Pass-throughs`,
      color: "#06B6D4",
    },
  ];

  const numAxes = components.length;
  const center = 170;
  const maxR = 105;

  const getCoordinates = (axisIndex: number, radiusVal: number) => {
    // Top axis starts at -90 deg
    const angle = (Math.PI * 2 * axisIndex) / numAxes - Math.PI / 2;
    return {
      x: center + radiusVal * Math.cos(angle),
      y: center + radiusVal * Math.sin(angle),
    };
  };

  // Concentric levels at 25%, 50%, 75%, 100%
  const webLevels = [0.25, 0.5, 0.75, 1.0];

  // Polygon path for a given level
  const getWebPath = (level: number) => {
    const coords = components.map((_, i) => getCoordinates(i, maxR * level));
    return coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ") + " Z";
  };

  // Polygon path for applicant scores
  const scoreCoords = components.map((c, i) => getCoordinates(i, maxR * c.ratio));
  const scorePolygonPath = scoreCoords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ") + " Z";

  // Polygon path for 70% benchmark baseline (Green band target)
  const benchmarkCoords = components.map((_, i) => getCoordinates(i, maxR * 0.7));
  const benchmarkPolygonPath = benchmarkCoords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ") + " Z";

  return (
    <div
      className="bg-white border border-[#E2E8F0] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col items-center select-none relative"
      style={{
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)",
      }}
    >
      <div className="w-full flex items-center justify-between border-b border-[#E2E8F0] pb-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#4F46E5] text-lg">radar</span>
          <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider font-sans">
            6-Component Underwriting Radar
          </h4>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EEF2FF] text-[#4F46E5]">
            <span className="w-2 h-2 rounded-full bg-[#4F46E5]" />
            Applicant Score
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full border border-dashed border-emerald-600" />
            70% Benchmark (T)
          </span>
        </div>
      </div>

      <div className="relative" style={{ width: size, height: size * 0.95 }}>
        <svg viewBox="0 0 340 325" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="radarFillGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366F1" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.08" />
            </linearGradient>
            <linearGradient id="radarStrokeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366F1" />
              <stop offset="100%" stopColor="#8B5CF6" />
            </linearGradient>
            <filter id="radarShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#6366F1" floodOpacity="0.25" />
            </filter>
          </defs>

          {/* Web grid polygons */}
          {webLevels.map((lvl, idx) => (
            <path
              key={idx}
              d={getWebPath(lvl)}
              fill="none"
              stroke="#E2E8F0"
              strokeWidth="1"
              strokeDasharray={lvl === 1 ? undefined : "4 4"}
              className="opacity-75"
            />
          ))}

          {/* 70% Benchmark Polygon (Emerald Dashed Line with subtle glow) */}
          <path
            d={benchmarkPolygonPath}
            fill="none"
            stroke="#10B981"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            className="opacity-80"
          />

          {/* Axis lines */}
          {components.map((_, i) => {
            const edge = getCoordinates(i, maxR);
            return (
              <line
                key={i}
                x1={center}
                y1={center}
                x2={edge.x}
                y2={edge.y}
                stroke="#E2E8F0"
                strokeWidth="1"
                className="opacity-80"
              />
            );
          })}

          {/* Applicant Score Filled Area */}
          <path
            d={scorePolygonPath}
            fill="url(#radarFillGrad)"
            stroke="url(#radarStrokeGrad)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            filter="url(#radarShadow)"
            className="transition-all duration-500 ease-out"
          />

          {/* Data Points (Vertices) */}
          {scoreCoords.map((c, i) => {
            const isHovered = hoveredIdx === i;
            return (
              <g
                key={i}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={isHovered ? "7" : "4.5"}
                  fill="#FFFFFF"
                  stroke="#6366F1"
                  strokeWidth={isHovered ? "3.5" : "2"}
                  style={{
                    filter: isHovered ? "drop-shadow(0 0 6px rgba(99, 102, 241, 0.5))" : undefined,
                  }}
                  className="transition-all duration-200"
                />
              </g>
            );
          })}

          {/* Axis Labels */}
          {components.map((c, i) => {
            const labelCoord = getCoordinates(i, maxR + 24);
            const isHovered = hoveredIdx === i;
            return (
              <g
                key={i}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
                style={{ opacity: hoveredIdx !== null && hoveredIdx !== i ? 0.7 : 1 }}
              >
                <text
                  x={labelCoord.x}
                  y={labelCoord.y - 2}
                  textAnchor="middle"
                  className={`text-[10px] font-semibold uppercase tracking-wider transition-colors duration-200 font-sans ${
                    isHovered ? "fill-indigo-600 font-bold" : "fill-slate-500"
                  }`}
                >
                  {c.shortName}
                </text>
                <text
                  x={labelCoord.x}
                  y={labelCoord.y + 10}
                  textAnchor="middle"
                  className={`text-[9px] font-mono font-bold transition-colors duration-200 ${
                    c.ratio >= 0.7 ? "fill-emerald-600" : c.ratio >= 0.4 ? "fill-amber-600" : "fill-rose-600"
                  }`}
                >
                  {c.score}/{c.maxScore} ({Math.round(c.ratio * 100)}%)
                </text>
              </g>
            );
          })}
        </svg>

        {/* Universal Dark Glass Tooltip */}
        {hoveredIdx !== null && (
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none bg-[#1E293B]/95 backdrop-blur-md text-white px-3.5 py-2.5 rounded-lg shadow-xl border border-slate-700/60 text-center min-w-[160px] z-20 transition-all duration-200"
            style={{ borderRadius: "8px" }}
          >
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300 block font-sans">
              {components[hoveredIdx].name}
            </span>
            <div className="text-base font-mono font-bold mt-1 text-white">
              {components[hoveredIdx].score}{" "}
              <span className="text-xs text-slate-300 font-normal">/ {components[hoveredIdx].maxScore} pts</span>
            </div>
            <div className="text-[10px] text-slate-300 mt-1 font-medium bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
              {components[hoveredIdx].evidence}
            </div>
          </div>
        )}
      </div>

      {/* Mini Score Bars Summary Footer with Gradients & Dimming on Non-hovered */}
      <div className="w-full grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-2 pt-3 border-t border-[#E2E8F0]">
        {components.map((c, i) => (
          <div
            key={i}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
            style={{ opacity: hoveredIdx !== null && hoveredIdx !== i ? 0.7 : 1 }}
            className={`p-2.5 rounded-xl transition-all duration-200 cursor-pointer border ${
              hoveredIdx === i
                ? "bg-[#EEF2FF] border-[#818CF8] ring-1 ring-[#818CF8]"
                : "bg-[#F8FAFC] border-[#E2E8F0] hover:bg-slate-100/70"
            }`}
          >
            <div className="flex justify-between items-center text-[10px] font-semibold text-slate-600 mb-1.5 font-sans">
              <span className="truncate max-w-[90px]">{c.shortName}</span>
              <span className="font-mono font-bold text-slate-800">
                {c.score}/{c.maxScore}
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  c.ratio >= 0.7
                    ? "bg-gradient-to-r from-[#818CF8] to-[#4F46E5]"
                    : c.ratio >= 0.4
                    ? "bg-gradient-to-r from-[#FBBF24] to-[#D97706]"
                    : "bg-gradient-to-r from-[#FB7185] to-[#E11D48]"
                }`}
                style={{ width: `${Math.round(c.ratio * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EVVRadarChart;
