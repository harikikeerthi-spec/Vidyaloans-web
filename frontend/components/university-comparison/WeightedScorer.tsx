"use client";
import { exportUniversityComparisonPdf } from "@/lib/exportUniversityComparisonPdf";

type University = {
  id: string;
  name: string;
  country: string;
  city: string;
  logo?: string;
  rank?: number;
  accept?: number;
  tuition?: number;
  description?: string;
  slug?: string;
  website?: string;
  _score?: number;
  loan?: boolean;
  scholarships?: number;
  avgjobSalary?: number;
  employment?: number;
  topRecruiters?: string[];
};

interface WeightedScorerProps {
  universities: University[];
  weights: {
    cost: number;
    roi: number;
    employability: number;
    reputation: number;
    culture: number;
  };
  onWeightsChange: (weights: any) => void;
  onExportPdf?: () => void;
  onSaveShortlist?: () => void;
}

export default function WeightedScorer({
  universities,
  weights,
  onWeightsChange,
  onExportPdf,
  onSaveShortlist,
}: WeightedScorerProps) {
  const handleExport = () => {
    if (onExportPdf) {
      onExportPdf();
    } else {
      exportUniversityComparisonPdf({ universities, weights });
    }
  };

  const handleSave = () => {
    if (onSaveShortlist) {
      onSaveShortlist();
    } else {
      try {
        localStorage.setItem("vidyaloans_saved_shortlist", JSON.stringify(universities));
        alert("Prioritized matrix shortlisted and saved to your browser session.");
      } catch (e) {
        console.error(e);
      }
    }
  };
  const calculateWeightedScore = (uni: University) => {
    // Normalize scores (0-100 scale)
    const costScore = 100 - (uni.tuition || 40000) / 750; // Lower cost = higher score
    const roiScore = (uni.avgjobSalary || 70000) / 1500; // Higher salary = higher score
    const employabilityScore = uni.employment || 85; // Employment %
    const reputationScore = Math.max(0, 100 - ((uni.rank || 50) / 100) * 100); // Better rank = higher score
    const cultureScore = 80; // Default/Demo value

    const weightedScore =
      (costScore * weights.cost +
        roiScore * weights.roi +
        employabilityScore * weights.employability +
        reputationScore * weights.reputation +
        cultureScore * weights.culture) /
      (weights.cost +
        weights.roi +
        weights.employability +
        weights.reputation +
        weights.culture);

    return Math.min(100, Math.max(0, weightedScore));
  };

  const updateWeight = (key: string, value: number) => {
    onWeightsChange({
      ...weights,
      [key]: value,
    });
  };

  const sortedUnis = [...universities].sort(
    (a, b) => calculateWeightedScore(b) - calculateWeightedScore(a)
  );

  const maxScore = Math.max(...sortedUnis.map(calculateWeightedScore));

  const getRankBadgeStyle = (idx: number) => {
    switch (idx) {
      case 0:
        return "bg-gradient-to-r from-amber-400 to-yellow-500 text-white shadow-md shadow-amber-400/25";
      case 1:
        return "bg-gradient-to-r from-slate-400 to-slate-500 text-white shadow-md shadow-slate-400/25";
      case 2:
        return "bg-gradient-to-r from-amber-600 to-orange-700 text-white shadow-md shadow-amber-600/25";
      default:
        return "bg-gray-100 text-gray-500 border border-gray-200";
    }
  };

  return (
    <div className="space-y-8">
      {/* Weight Adjustments Glass Card */}
      <div className="bg-white/70 backdrop-blur-xl border border-white p-8 rounded-[2.5rem] shadow-[0_20px_50px_-15px_rgba(102,5,199,0.1)]">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1.5 h-6 bg-[#6605c7] rounded-full" />
          <h3 className="text-lg font-black text-gray-900 leading-tight">
            Prioritize What Matters Most
          </h3>
        </div>
        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-8">
          Adjust the sliders below to recalculate institution rankings based on your career goals.
        </p>

        <div className="space-y-6">
          {[
            {
              key: "cost",
              label: "Cost & Budget Efficiency",
              description: "Prioritizes lower tuition fees and scholarship availability.",
              icon: "💰",
            },
            {
              key: "roi",
              label: "ROI & Earning Acceleration",
              description: "Prioritizes starting salary cap and career growth rate.",
              icon: "📈",
            },
            {
              key: "employability",
              label: "Employability & Job Security",
              description: "Prioritizes immediate graduate job placement percentage.",
              icon: "💼",
            },
            {
              key: "reputation",
              label: "Global Reputation & QS Rank",
              description: "Prioritizes high international rankings and academic prestige.",
              icon: "🏅",
            },
            {
              key: "culture",
              label: "Campus Culture & Quality of Life",
              description: "Prioritizes campus lifestyle, local safety, and student feedback.",
              icon: "🎓",
            },
          ].map((factor) => (
            <div key={factor.key} className="border-b border-gray-100/60 pb-6 last:border-b-0">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-black text-gray-900 flex items-center gap-2">
                    <span>{factor.icon}</span>
                    <span>{factor.label}</span>
                  </p>
                  <p className="text-xs text-gray-400 font-medium leading-relaxed mt-0.5">{factor.description}</p>
                </div>
                <span className="text-[13px] font-black text-[#6605c7] bg-[#6605c7]/5 px-3 py-1 rounded-lg">
                  {weights[factor.key as keyof typeof weights]}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={weights[factor.key as keyof typeof weights]}
                onChange={(e) =>
                  updateWeight(factor.key, parseInt(e.target.value))
                }
                className="w-full h-2 rounded-xl appearance-none cursor-pointer accent-[#6605c7]"
                style={{
                  background: `linear-gradient(to right, #6605c7 0%, #6605c7 ${weights[factor.key as keyof typeof weights]}%, #f3f4f6 ${weights[factor.key as keyof typeof weights]}%, #f3f4f6 100%)`
                }}
              />
            </div>
          ))}
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100/60 flex items-center gap-2 text-xs text-gray-400 font-bold uppercase tracking-wider">
          <span>💡 Relative weight priority assigned. Total: {Object.values(weights).reduce((a, b) => a + b, 0)}%</span>
        </div>
      </div>

      {/* Ranked Results Glass Card */}
      <div className="bg-white/70 backdrop-blur-xl border border-white rounded-[2.5rem] shadow-[0_20px_50px_-15px_rgba(102,5,199,0.1)] overflow-hidden">
        <div className="px-8 py-6 bg-gradient-to-r from-purple-950 to-[#6605c7] flex justify-between items-center">
          <div>
            <h3 className="text-lg font-black text-white leading-tight">Ranked Comparison Outcomes</h3>
            <p className="text-[10px] text-purple-200/60 font-black uppercase tracking-widest mt-1">Calculated via customized criteria weights</p>
          </div>
          <span className="text-xl">⚖️</span>
        </div>

        <div className="divide-y divide-gray-100/50">
          {sortedUnis.map((uni, idx) => {
            const score = calculateWeightedScore(uni);
            const percentage = (score / maxScore) * 100;

            return (
              <div key={`score-${uni.id}-${idx}`} className="p-8 hover:bg-white/40 transition-colors">
                <div className="flex items-start justify-between mb-5 flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${getRankBadgeStyle(idx)}`}>
                      {idx + 1}
                    </span>
                    <div>
                      <p className="text-base font-black text-gray-900 leading-tight">
                        {uni.name}
                      </p>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1.5">
                        {uni.city}, {uni.country}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-3xl font-black text-[#6605c7] leading-none">
                      {score.toFixed(1)}
                    </div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Weighted Index Score</p>
                  </div>
                </div>

                {/* score progress track */}
                <div className="w-full bg-gray-100 rounded-xl h-3 overflow-hidden shadow-inner border border-gray-50 mb-5">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-[#6605c7] rounded-xl transition-all duration-500 shadow-sm"
                    style={{ width: `${percentage}%` }}
                  />
                </div>

                {/* Score breakdown metrics list */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs bg-white/40 p-4 rounded-xl border border-white/50">
                  <div className="flex justify-between md:flex-col md:gap-1">
                    <span className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Budget:</span>
                    <span className="font-black text-gray-800">
                      {(100 - (uni.tuition || 40000) / 750).toFixed(0)} / 100
                    </span>
                  </div>
                  <div className="flex justify-between md:flex-col md:gap-1">
                    <span className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">ROI Return:</span>
                    <span className="font-black text-gray-800">
                      {((uni.avgjobSalary || 70000) / 1500).toFixed(0)} / 100
                    </span>
                  </div>
                  <div className="flex justify-between md:flex-col md:gap-1">
                    <span className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Employability:</span>
                    <span className="font-black text-gray-800">
                      {uni.employment || 85} / 100
                    </span>
                  </div>
                  <div className="flex justify-between md:flex-col md:gap-1">
                    <span className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">QS Rep:</span>
                    <span className="font-black text-gray-800">
                      {Math.max(0, 100 - ((uni.rank || 50) / 100) * 100).toFixed(0)} / 100
                    </span>
                  </div>
                  <div className="flex justify-between md:flex-col md:gap-1">
                    <span className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Life & Culture:</span>
                    <span className="font-black text-gray-800">80 / 100</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Primary Export Actions */}
      <div className="flex gap-3 justify-end">
        <button
          onClick={handleSave}
          className="px-6 py-3.5 border border-[#6605c7]/20 text-[#6605c7] rounded-2xl hover:bg-[#6605c7]/5 transition-all font-black text-[11px] uppercase tracking-widest cursor-pointer shadow-sm flex items-center gap-2"
        >
          <span>📋 Save Prioritized Matrix</span>
        </button>
        <button
          onClick={handleExport}
          className="px-6 py-3.5 bg-gradient-to-r from-[#6605c7] to-[#8b24e5] text-white rounded-2xl hover:opacity-90 active:scale-[0.98] transition-all font-black text-[11px] uppercase tracking-widest cursor-pointer shadow-md shadow-[#6605c7]/20 flex items-center gap-2"
        >
          <span>📊 Export Ranked Verdict</span>
        </button>
      </div>
    </div>
  );
}
