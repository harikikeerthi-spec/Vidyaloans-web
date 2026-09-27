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

interface ComparisonGridProps {
  universities: University[];
  onExportPdf?: () => void;
  onSaveShortlist?: () => void;
}

const metrics = [
  {
    label: "World Rank",
    key: "rank",
    format: (val?: number) => (val ? `QS #${val}` : "N/A"),
  },
  {
    label: "Acceptance Rate",
    key: "accept",
    format: (val?: number) => (val ? `${val}%` : "N/A"),
  },
  {
    label: "Annual Tuition",
    key: "tuition",
    format: (val?: number) => (val ? `$${val.toLocaleString()}` : "N/A"),
  },
  {
    label: "Scholarships Available",
    key: "scholarships",
    format: (val?: number) =>
      val ? `$${(val / 1000000).toFixed(1)}M` : "N/A",
  },
  {
    label: "Avg Starting Salary",
    key: "avgjobSalary",
    format: (val?: number) => (val ? `$${val.toLocaleString()}` : "N/A"),
  },
  {
    label: "Employment Rate",
    key: "employment",
    format: (val?: number) => (val ? `${val}%` : "N/A"),
  },
];

export default function ComparisonGrid({
  universities,
  onExportPdf,
  onSaveShortlist,
}: ComparisonGridProps) {
  const handleExport = () => {
    if (onExportPdf) {
      onExportPdf();
    } else {
      exportUniversityComparisonPdf({ universities });
    }
  };

  const handleSave = () => {
    if (onSaveShortlist) {
      onSaveShortlist();
    } else {
      try {
        localStorage.setItem("vidyaloans_saved_shortlist", JSON.stringify(universities));
        alert("Universities shortlisted and saved to your browser session.");
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <div className="bg-white/70 backdrop-blur-xl border border-white p-6 rounded-[2.5rem] shadow-[0_20px_50px_-15px_rgba(102,5,199,0.1)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="sticky left-0 px-6 py-5 text-left bg-[#fcfaff] text-xs font-black text-gray-400 uppercase tracking-widest z-10 rounded-tl-2xl">
                Metric Comparison
              </th>
              {universities.map((uni, idx) => (
                <th
                  key={`head-${uni.id}-${idx}`}
                  className="px-6 py-5 text-center min-w-[200px]"
                >
                  <div className="text-sm font-black text-gray-900 leading-tight">
                    {uni.name}
                  </div>
                  <div className="text-[10px] font-black text-[#6605c7] uppercase tracking-wider mt-1">
                    {uni.city}, {uni.country}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100/50">
            {metrics.map((metric) => (
              <tr
                key={metric.key}
                className="hover:bg-white/40 transition-colors"
              >
                <td className="sticky left-0 px-6 py-4.5 text-xs font-bold text-gray-500 bg-[#fcfaff] border-r border-gray-50 z-10 whitespace-nowrap">
                  {metric.label}
                </td>
                {universities.map((uni, idx) => (
                  <td
                    key={`cell-${uni.id}-${idx}`}
                    className="px-6 py-4.5 text-center text-sm font-bold text-gray-900"
                  >
                    {metric.format(
                      uni[metric.key as keyof University] as number | undefined
                    )}
                  </td>
                ))}
              </tr>
            ))}

            {/* Top Recruiters Row */}
            <tr className="hover:bg-white/40 transition-colors">
              <td className="sticky left-0 px-6 py-5 text-xs font-bold text-gray-500 bg-[#fcfaff] border-r border-gray-50 z-10 whitespace-nowrap">
                Top Recruiters
              </td>
              {universities.map((uni) => (
                <td
                  key={uni.id}
                  className="px-6 py-5 text-sm text-gray-700 text-center"
                >
                  <div className="flex flex-wrap gap-1.5 justify-center max-w-[220px] mx-auto">
                    {uni.topRecruiters && uni.topRecruiters.length > 0 ? (
                      <>
                        {uni.topRecruiters.slice(0, 3).map((recruiter, i) => (
                          <span
                            key={i}
                            className="inline-block px-2.5 py-1 bg-[#6605c7]/5 border border-[#6605c7]/10 text-[#6605c7] rounded-lg text-[10px] font-bold"
                          >
                            {recruiter}
                          </span>
                        ))}
                        {uni.topRecruiters.length > 3 && (
                          <span className="inline-block px-2 py-1 text-gray-400 text-[10px] font-bold">
                            +{uni.topRecruiters.length - 3} more
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-[11px] text-gray-400 italic">N/A</span>
                    )}
                  </div>
                </td>
              ))}
            </tr>

            {/* Loan Ready Row */}
            <tr className="hover:bg-white/40 transition-colors">
              <td className="sticky left-0 px-6 py-5 text-xs font-bold text-gray-500 bg-[#fcfaff] border-r border-gray-50 z-10 rounded-bl-2xl whitespace-nowrap">
                Loan Direct Path
              </td>
              {universities.map((uni) => (
                <td key={uni.id} className="px-6 py-5 text-center">
                  {uni.loan ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-lg text-xs font-black uppercase tracking-wider">
                      ✓ Instant Loan Match
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-50 border border-gray-200 text-gray-400 rounded-lg text-xs font-black uppercase tracking-wider">
                      ✗ Check Eligibility
                    </span>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Bottom Action Pane */}
      <div className="border-t border-gray-100/60 mt-6 pt-6 flex flex-wrap gap-3 justify-end">
        <button
          onClick={handleSave}
          className="px-5 py-3 border border-[#6605c7]/20 text-[#6605c7] rounded-xl hover:bg-[#6605c7]/5 transition-all font-black text-[11px] uppercase tracking-widest cursor-pointer shadow-sm flex items-center gap-2"
        >
          <span>💾 Save Shortlist</span>
        </button>
        <button
          onClick={handleExport}
          className="px-5 py-3 bg-gradient-to-r from-[#6605c7] to-[#8b24e5] text-white rounded-xl hover:opacity-90 active:scale-[0.98] transition-all font-black text-[11px] uppercase tracking-widest cursor-pointer shadow-md shadow-[#6605c7]/20 flex items-center gap-2"
        >
          <span>📊 Export comparison PDF</span>
        </button>
      </div>
    </div>
  );
}
