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

interface MetricComparisonProps {
  universities: University[];
  onExportPdf?: () => void;
}

const detailedMetrics = [
  {
    title: "Financial Profile & Cost Analysis",
    metrics: [
      {
        label: "Annual Program Tuition",
        key: "tuition",
        unit: "$",
        inverse: true, // Lower is better
        format: (val?: number) => (val ? val.toLocaleString() : "N/A"),
      },
      {
        label: "Scholarships Available",
        key: "scholarships",
        unit: "$",
        inverse: false,
        format: (val?: number) =>
          val ? (val / 1000000).toFixed(1) + "M" : "N/A",
      },
    ],
  },
  {
    title: "Academic Intake & Prestige",
    metrics: [
      {
        label: "World Rank",
        key: "rank",
        unit: "#",
        inverse: true, // Lower number is better rank
        format: (val?: number) => (val ? val.toString() : "N/A"),
      },
      {
        label: "Acceptance Rate",
        key: "accept",
        unit: "%",
        inverse: false,
        format: (val?: number) => (val ? val.toString() : "N/A"),
      },
    ],
  },
  {
    title: "Career Prospects & Employability",
    metrics: [
      {
        label: "Average Starting Graduate Salary",
        key: "avgjobSalary",
        unit: "$",
        inverse: false,
        format: (val?: number) => (val ? (val / 1000).toFixed(0) + "k" : "N/A"),
      },
      {
        label: "Employment Success Rate",
        key: "employment",
        unit: "%",
        inverse: false,
        format: (val?: number) => (val ? val.toString() : "N/A"),
      },
    ],
  },
];

export default function MetricComparison({
  universities,
  onExportPdf,
}: MetricComparisonProps) {
  const handleExport = () => {
    if (onExportPdf) {
      onExportPdf();
    } else {
      exportUniversityComparisonPdf({ universities });
    }
  };

  const getExtremeValue = (key: string, inverse: boolean) => {
    const values = universities.map((u) => (u[key as keyof University] as number) || 0);
    return inverse ? Math.min(...values) : Math.max(...values);
  };

  const getAbsoluteMax = (key: string) => {
    return Math.max(...universities.map((u) => (u[key as keyof University] as number) || 0));
  };

  const getPercentage = (value?: number, max?: number) => {
    if (!value || !max) return 0;
    return (value / max) * 100;
  };

  return (
    <div className="space-y-8">
      {detailedMetrics.map((section) => (
        <div
          key={section.title}
          className="bg-white/70 backdrop-blur-xl border border-white p-8 rounded-[2.5rem] shadow-[0_20px_50px_-15px_rgba(102,5,199,0.1)] space-y-8"
        >
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-[#6605c7] rounded-full" />
            <h3 className="text-lg font-black text-gray-900 leading-tight">
              {section.title}
            </h3>
          </div>

          <div className="space-y-8">
            {section.metrics.map((metric) => {
              const extremeValue = getExtremeValue(metric.key, metric.inverse);
              const absMax = getAbsoluteMax(metric.key);

              return (
                <div key={metric.key} className="space-y-4">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
                    {metric.label}
                  </p>

                  <div className="space-y-4">
                    {universities.map((uni, idx) => {
                      const value = uni[metric.key as keyof University] as number | undefined;
                      const percentage = getPercentage(value, absMax);
                      const isChampion = value === extremeValue;

                      return (
                        <div key={`met-${uni.id}-${idx}`} className="group">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-gray-800 flex items-center gap-2">
                              {uni.name}
                              {isChampion && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-50 border border-emerald-100 text-emerald-600 text-[9px] font-black uppercase tracking-wider">
                                  🏆 Best Option
                                </span>
                              )}
                            </span>
                            <span
                              className={`text-xs font-black ${
                                isChampion ? "text-emerald-600" : "text-gray-500"
                              }`}
                            >
                              {metric.format(value)} {metric.unit}
                            </span>
                          </div>
                          
                          {/* Progress bar tracks */}
                          <div className="w-full bg-gray-100 rounded-xl h-3 overflow-hidden shadow-inner border border-gray-50">
                            <div
                              className={`h-full rounded-xl transition-all duration-500 bg-gradient-to-r ${
                                isChampion
                                  ? "from-emerald-400 to-emerald-600 shadow-md shadow-emerald-500/20"
                                  : "from-purple-400 to-[#6605c7] opacity-80"
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Recruiter Matrix Glass Card */}
      <div className="bg-white/70 backdrop-blur-xl border border-white p-8 rounded-[2.5rem] shadow-[0_20px_50px_-15px_rgba(102,5,199,0.1)]">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-1.5 h-6 bg-[#6605c7] rounded-full" />
          <h3 className="text-lg font-black text-gray-900 leading-tight">
            Corporate & Recruiting Matrix
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {universities.map((uni, idx) => (
            <div
              key={`rec-${uni.id}-${idx}`}
              className="bg-white/60 p-6 rounded-2xl border border-white/80 shadow-sm flex flex-col justify-between"
            >
              <div>
                <h4 className="font-black text-gray-900 text-sm mb-1">{uni.name}</h4>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-4">
                  Top corporate recruiting pipeline
                </p>

                {uni.topRecruiters && uni.topRecruiters.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {uni.topRecruiters.map((recruiter, idx) => (
                      <span
                        key={idx}
                        className="inline-block px-3 py-1.5 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 text-[#6605c7] rounded-xl text-[11px] font-bold"
                      >
                        💼 {recruiter}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">No direct hiring partner list disclosed.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Primary Export Actions */}
      <div className="flex gap-3 justify-end">
        <button
          onClick={handleExport}
          className="px-6 py-3.5 bg-gradient-to-r from-[#6605c7] to-[#8b24e5] text-white rounded-2xl hover:opacity-90 active:scale-[0.98] transition-all font-black text-[11px] uppercase tracking-widest cursor-pointer shadow-md shadow-[#6605c7]/20 flex items-center gap-2"
        >
          <span>📊 Export Granular Analysis Report</span>
        </button>
      </div>
    </div>
  );
}
