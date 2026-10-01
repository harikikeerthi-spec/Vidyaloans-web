"use client";

import { useState, useEffect } from "react";
import ComparisonGrid from "./university-comparison/ComparisonGrid";
import MetricComparison from "./university-comparison/MetricComparison";
import WeightedScorer from "./university-comparison/WeightedScorer";
import { aiApi, referenceApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
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

interface UniversityComparisonFlowProps {
  initialUnis?: string[];
}

export default function UniversityComparisonFlow({
  initialUnis = [],
}: UniversityComparisonFlowProps) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [selectedUnis, setSelectedUnis] = useState<University[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<University[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "metrics" | "weighted">("grid");

  // AI Insights State
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiReport, setAiReport] = useState<any | null>(null);

  // Live database universities state
  const [dbUnis, setDbUnis] = useState<University[]>([]);

  const [weights, setWeights] = useState({
    cost: 25,
    roi: 30,
    employability: 20,
    reputation: 15,
    culture: 10,
  });

  // Export & Shortlist Feedback State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleExportPdf = async () => {
    if (selectedUnis.length < 2) {
      alert("Please select at least 2 universities to export comparison.");
      return;
    }
    showToast("Preparing official University Comparison PDF...");
    await exportUniversityComparisonPdf({
      universities: selectedUnis,
      aiReport,
      weights,
    });
  };

  const handleSaveShortlist = () => {
    if (selectedUnis.length === 0) return;
    try {
      localStorage.setItem("vidyaloans_saved_shortlist", JSON.stringify(selectedUnis));
      const uniIds = selectedUnis.map((u) => u.slug || u.id).join(",");
      if (typeof window !== "undefined" && navigator?.clipboard) {
        const shareUrl = `${window.location.origin}/compare-universities?unis=${encodeURIComponent(uniIds)}`;
        navigator.clipboard.writeText(shareUrl).catch(() => { });
      }
      showToast(`Shortlist saved! (${selectedUnis.length} universities saved, link copied)`);
    } catch (e) {
      showToast("Shortlist saved to your browser session.");
    }
  };

  const demoUnis: University[] = [
    {
      id: "1",
      name: "Stanford University",
      country: "USA",
      city: "Palo Alto, CA",
      rank: 5,
      accept: 4,
      tuition: 62000,
      scholarships: 1500000,
      avgjobSalary: 145000,
      employment: 96,
      topRecruiters: ["Google", "Apple", "NVIDIA", "Meta", "OpenAI"],
      description: "Leading technology and research institution in Silicon Valley.",
      slug: "stanford",
      website: "https://www.stanford.edu",
      loan: true,
      _score: 98,
    },
    {
      id: "2",
      name: "Massachusetts Institute of Technology (MIT)",
      country: "USA",
      city: "Cambridge, MA",
      rank: 1,
      accept: 7,
      tuition: 59000,
      scholarships: 1800000,
      avgjobSalary: 150000,
      employment: 98,
      topRecruiters: ["Google", "SpaceX", "NASA", "Microsoft", "Stripe"],
      description: "The gold standard for mathematics, engineering, and scientific research.",
      slug: "mit",
      website: "https://www.mit.edu",
      loan: true,
      _score: 99,
    },
    {
      id: "3",
      name: "University of Oxford",
      country: "UK",
      city: "Oxford",
      rank: 3,
      accept: 14,
      tuition: 42000,
      scholarships: 950000,
      avgjobSalary: 89000,
      employment: 93,
      topRecruiters: ["Goldman Sachs", "McKinsey", "BCG", "AstraZeneca", "HSBC"],
      description: "Oldest university in the English-speaking world, rich in history and prestige.",
      slug: "oxford",
      website: "https://www.ox.ac.uk",
      loan: true,
      _score: 95,
    },
    {
      id: "4",
      name: "University of Cambridge",
      country: "UK",
      city: "Cambridge",
      rank: 2,
      accept: 16,
      tuition: 44000,
      scholarships: 1100000,
      avgjobSalary: 92000,
      employment: 94,
      topRecruiters: ["DeepMind", "Barclays", "PwC", "JPMorgan", "Arup"],
      description: "World-renowned collegiate research university offering top-tier academics.",
      slug: "cambridge",
      website: "https://www.cam.ac.uk",
      loan: true,
      _score: 96,
    },
    {
      id: "5",
      name: "Harvard University",
      country: "USA",
      city: "Cambridge, MA",
      rank: 4,
      accept: 3,
      tuition: 64000,
      scholarships: 2000000,
      avgjobSalary: 148000,
      employment: 95,
      topRecruiters: ["Blackstone", "McKinsey", "Goldman Sachs", "Meta", "Google"],
      description: "Ivy League flagship known for producing globally influential leaders.",
      slug: "harvard",
      website: "https://www.harvard.edu",
      loan: true,
      _score: 97,
    },
    {
      id: "6",
      name: "University of Toronto",
      country: "Canada",
      city: "Toronto, ON",
      rank: 21,
      accept: 43,
      tuition: 38000,
      scholarships: 650000,
      avgjobSalary: 78000,
      employment: 89,
      topRecruiters: ["RBC", "Shopify", "TD Bank", "Amazon", "Deloitte"],
      description: "Canada's top research powerhouse located in the vibrant heart of Toronto.",
      slug: "toronto",
      website: "https://www.utoronto.ca",
      loan: true,
      _score: 88,
    },
    {
      id: "7",
      name: "National University of Singapore (NUS)",
      country: "Singapore",
      city: "Singapore",
      rank: 8,
      accept: 25,
      tuition: 32000,
      scholarships: 800000,
      avgjobSalary: 82000,
      employment: 92,
      topRecruiters: ["Shopee", "Grab", "DBS Bank", "ByteDance", "Temasek"],
      description: "Asia's leading global university offering highly competitive tech and biz programs.",
      slug: "nus",
      website: "https://nus.edu.sg",
      loan: true,
      _score: 93,
    },
    {
      id: "8",
      name: "University of Melbourne",
      country: "Australia",
      city: "Melbourne",
      rank: 14,
      accept: 70,
      tuition: 34000,
      scholarships: 500000,
      avgjobSalary: 72000,
      employment: 86,
      topRecruiters: ["ANZ", "Macquarie Group", "BHP", "Atlassian", "KPMG"],
      description: "Australia's distinguished research institution with highly flexible program formats.",
      slug: "melbourne",
      website: "https://www.unimelb.edu.au",
      loan: true,
      _score: 85,
    },
    {
      id: "9",
      name: "Technical University of Munich (TUM)",
      country: "Germany",
      city: "Munich",
      rank: 28,
      accept: 30,
      tuition: 6000, // Virtually free/low tuition in Germany
      scholarships: 120000,
      avgjobSalary: 68000,
      employment: 91,
      topRecruiters: ["Siemens", "BMW", "Allianz", "Audi", "Infineon"],
      description: "Europe's leading engineering hub with exceptionally high ROI due to low public tuition fees.",
      slug: "tum",
      website: "https://www.tum.de",
      loan: true,
      _score: 92,
    },
    {
      id: "10",
      name: "Trinity College Dublin",
      country: "Ireland",
      city: "Dublin",
      rank: 81,
      accept: 33,
      tuition: 24000,
      scholarships: 300000,
      avgjobSalary: 65000,
      employment: 88,
      topRecruiters: ["Stripe", "Google", "Meta", "Accenture", "Intel"],
      description: "Ireland's premier university, perfectly integrated with Dublin's Silicon Docks tech community.",
      slug: "trinity",
      website: "https://www.tcd.ie",
      loan: true,
      _score: 84,
    }
  ];

  const initialUnisSerialized = (initialUnis || []).join(",");

  const activeUnis = dbUnis.length > 0 ? dbUnis : demoUnis;

  useEffect(() => {
    const fetchAllUniversities = async () => {
      try {
        const res = await referenceApi.getUniversities() as any;
        if (res?.success && res.data?.length > 0) {
          const mapped = res.data.map((u: any, idx: number) => ({
            id: u.id || u._id || u.slug || `uni-${idx}`,
            name: u.name,
            country: u.country,
            city: u.city || u.location || '',
            rank: u.ranking || u.rank || 999,
            accept: u.acceptanceRate || u.accept || 50,
            tuition: u.tuition || u.fees || 25000,
            avgjobSalary: u.averageSalary || u.avgjobSalary || 65000,
            employment: u.employmentRate || u.employment || 85,
            topRecruiters: u.topRecruiters || [],
            description: u.description || '',
            website: u.website || '',
            loan: u.loanSupported ?? true,
            slug: u.slug || u.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          }));
          const uniqueMapped = mapped.filter((u: any, index: number, self: any[]) =>
            index === self.findIndex((t) => t.id === u.id)
          );
          setDbUnis(uniqueMapped);

          if (initialUnis && initialUnis.length > 0) {
            const unis = uniqueMapped.filter((u: any) =>
              initialUnis.some((id) => u.id === id || u.slug === id || u.name.toLowerCase().includes(id.toLowerCase()))
            );
            if (unis.length > 0) {
              setSelectedUnis(unis);
              return;
            }
          }
        }
      } catch (error) {
        console.error("Failed to load universities from database:", error);
      }
    };
    fetchAllUniversities();
  }, []);

  useEffect(() => {
    if (initialUnis && initialUnis.length > 0) {
      const unis = activeUnis.filter((u) =>
        initialUnis.some((id) => u.id === id || u.slug === id)
      );
      setSelectedUnis(unis);
    } else {
      setSelectedUnis([activeUnis[0], activeUnis[1]]);
    }
  }, [initialUnisSerialized, dbUnis]);

  useEffect(() => {
    if (activeUnis.length > 0 && typeof window !== "undefined") {
      const saved = localStorage.getItem("pending_compare_unis_data");
      if (saved) {
        try {
          const savedIds = JSON.parse(saved) as string[];
          const restoredUnis = activeUnis.filter(u => savedIds.includes(u.id));
          if (restoredUnis.length > 0) {
            setSelectedUnis(restoredUnis);
          }
        } catch (e) {
          console.error("Failed to restore comparison universities", e);
        }
        localStorage.removeItem("pending_compare_unis_data");
      }
    }
  }, [dbUnis, activeUnis]);

  // Reset AI report when list of selected universities changes
  useEffect(() => {
    setAiReport(null);
  }, [selectedUnis]);

  // Debounce AI search while typing
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    // Instantly filter locally first to keep UI responsive
    const localResults = activeUnis.filter(
      (u) =>
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.city.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setSearchResults(localResults);
    setIsSearching(true);

    const timer = setTimeout(async () => {
      try {
        const data: any = await aiApi.aiSearch({ query: searchQuery, type: 'university' });
        const results = data?.universities || data?.results || [];

        if (results.length > 0) {
          const mapped = results.map((u: any, i: number) => {
            const rawTuition = typeof u.tuition === 'string' ? parseFloat(u.tuition.replace(/[^0-9.]/g, '')) : u.tuition;
            const tuitionVal = isNaN(rawTuition) ? 25000 : rawTuition;

            const rawAccept = typeof u.accept === 'string' ? parseFloat(u.accept.replace(/[^0-9.]/g, '')) : u.accept || u.acceptanceRate;
            const parsedAccept = typeof rawAccept === 'string' ? parseFloat(rawAccept.replace(/[^0-9.]/g, '')) : rawAccept;
            const acceptVal = isNaN(parsedAccept) ? 40 : parsedAccept;

            const rawRank = typeof u.rank === 'string' ? parseInt(u.rank.replace(/[^0-9]/g, ''), 10) : u.rank || u.ranking;
            const parsedRank = typeof rawRank === 'string' ? parseInt(rawRank.replace(/[^0-9]/g, ''), 10) : rawRank;
            const rankVal = isNaN(parsedRank) ? 150 : parsedRank;

            const rawSalary = u.avgjobSalary || u.averageSalary;
            const parsedSalary = typeof rawSalary === 'string' ? parseFloat(rawSalary.replace(/[^0-9.]/g, '')) : rawSalary;
            const avgjobSalary = isNaN(parsedSalary) ? 65000 : parsedSalary;

            const rawEmp = u.employment || u.employmentRate;
            const parsedEmp = typeof rawEmp === 'string' ? parseFloat(rawEmp.replace(/[^0-9.]/g, '')) : rawEmp;
            const employment = isNaN(parsedEmp) ? 85 : parsedEmp;

            return {
              id: u.id || u._id || u.slug || `ai-uni-${i}-${Date.now()}`,
              name: u.name,
              country: u.country || u.loc?.split(',').pop()?.trim() || 'Global',
              city: u.city || u.loc?.split(',')[0]?.trim() || '',
              rank: rankVal,
              accept: acceptVal,
              tuition: tuitionVal,
              avgjobSalary: avgjobSalary,
              employment: employment,
              topRecruiters: u.topRecruiters || [],
              description: u.description || '',
              website: u.website || '',
              loan: u.loan ?? true,
              slug: u.slug || u.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            };
          });

          setSearchResults(mapped);
        }
      } catch (err) {
        console.error("AI Global Search Failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleAddUni = (uni: University) => {
    if (!selectedUnis.find((u) => u.id === uni.id) && selectedUnis.length < 5) {
      setSelectedUnis([...selectedUnis, uni]);
      setSearchQuery("");
      setSearchResults([]);
    }
  };

  const handleRemoveUni = (id: string) => {
    setSelectedUnis(selectedUnis.filter((u) => u.id !== id));
  };

  const generateAiInsights = async () => {
    if (selectedUnis.length < 2) return;

    if (!isAuthenticated) {
      localStorage.setItem("pending_compare_unis_data", JSON.stringify(selectedUnis.map(u => u.id)));
      alert("To view detailed AI university comparison insights and advice, please login. You will be redirected to the login page.");
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    setIsGeneratingAi(true);
    setAiReport(null);

    try {
      if (selectedUnis.length === 2) {
        const res = await aiApi.compareUniversities(selectedUnis[0].name, selectedUnis[1].name) as any;
        if (res?.success && res.data) {
          const aiData = res.data;

          const u1Tuition = parseFloat(aiData.uni1.tuition?.replace(/[^0-9.]/g, '')) || selectedUnis[0].tuition || 30000;
          const u1Salary = parseFloat(aiData.uni1.salary?.replace(/[^0-9.]/g, '')) || selectedUnis[0].avgjobSalary || 60000;
          const u2Tuition = parseFloat(aiData.uni2.tuition?.replace(/[^0-9.]/g, '')) || selectedUnis[1].tuition || 30000;
          const u2Salary = parseFloat(aiData.uni2.salary?.replace(/[^0-9.]/g, '')) || selectedUnis[1].avgjobSalary || 60000;

          const roi1 = u1Salary / u1Tuition;
          const roi2 = u2Salary / u2Tuition;

          const roiChamp = roi1 >= roi2 ? selectedUnis[0] : selectedUnis[1];
          const costChamp = u1Tuition <= u2Tuition ? selectedUnis[0] : selectedUnis[1];

          setAiReport({
            roiChampion: {
              ...roiChamp,
              tuition: roiChamp.id === selectedUnis[0].id ? u1Tuition : u2Tuition,
              avgjobSalary: roiChamp.id === selectedUnis[0].id ? u1Salary : u2Salary,
            },
            costChampion: {
              ...costChamp,
              tuition: costChamp.id === selectedUnis[0].id ? u1Tuition : u2Tuition,
            },
            summary: `Live AI Evaluation for ${aiData.uni1.name} (${aiData.uni1.loc}) vs ${aiData.uni2.name} (${aiData.uni2.loc}):\n\n` +
              `• ${aiData.uni1.name}: World Rank ${aiData.uni1.rank}, Acceptance Rate ${aiData.uni1.rate}, Annual Fees ${aiData.uni1.tuition}, Average Salary ${aiData.uni1.salary}.\n` +
              `• ${aiData.uni2.name}: World Rank ${aiData.uni2.rank}, Acceptance Rate ${aiData.uni2.rate}, Annual Fees ${aiData.uni2.tuition}, Average Salary ${aiData.uni2.salary}.\n\n` +
              `Expert Insights: ${aiData.uni1.name} and ${aiData.uni2.name} are both world-class pathways. ${roiChamp.name} displays exceptionally strong ROI potential, while ${costChamp.name} provides optimized upfront fee exposure.`,
            vidyaLoansRating: "Verified A-Grade",
            vidyaLoansAdvice: `Both ${selectedUnis[0].name} and ${selectedUnis[1].name} are officially listed in Vidya Loans prime channels. You qualify for up to 100% funding covering all study expenses with 0 collateral at prime interest rates starting at 8.25% p.a.`
          });

          const updatedSelected = selectedUnis.map(u => {
            if (u.name.toLowerCase() === selectedUnis[0].name.toLowerCase()) {
              return {
                ...u,
                rank: parseInt(aiData.uni1.rank?.replace(/[^0-9]/g, '')) || u.rank,
                accept: parseInt(aiData.uni1.rate?.replace(/[^0-9]/g, '')) || u.accept,
                tuition: u1Tuition,
                avgjobSalary: u1Salary,
                city: aiData.uni1.loc?.split(',')[0]?.trim() || u.city,
              };
            }
            if (u.name.toLowerCase() === selectedUnis[1].name.toLowerCase()) {
              return {
                ...u,
                rank: parseInt(aiData.uni2.rank?.replace(/[^0-9]/g, '')) || u.rank,
                accept: parseInt(aiData.uni2.rate?.replace(/[^0-9]/g, '')) || u.accept,
                tuition: u2Tuition,
                avgjobSalary: u2Salary,
                city: aiData.uni2.loc?.split(',')[0]?.trim() || u.city,
              };
            }
            return u;
          });
          setSelectedUnis(updatedSelected);
        }
      } else {
        const shortlist = selectedUnis.map(u => ({ name: u.name, course: 'Masters Program' }));
        const profile = { bachelors: 'Engineering/Business', workExp: '24', gpa: '8.5' };
        const res = await aiApi.compareShortlist(shortlist, profile) as any;
        if (res?.success && res.data) {
          const aiData = res.data;

          const roiChampName = aiData.universities?.sort((a: any, b: any) => (parseInt(b.roiScore) || 0) - (parseInt(a.roiScore) || 0))[0]?.name || selectedUnis[0].name;
          const roiChamp = selectedUnis.find(u => u.name.toLowerCase().includes(roiChampName.toLowerCase())) || selectedUnis[0];

          const costChamp = [...selectedUnis].sort((a, b) => (a.tuition || 0) - (b.tuition || 0))[0];

          setAiReport({
            roiChampion: roiChamp,
            costChampion: costChamp,
            summary: `${aiData.summary}\n\nExpert Recommendation: ${aiData.recommendation}`,
            vidyaLoansRating: "Highly Eligible",
            vidyaLoansAdvice: `All selected institutions have A-Grade verification status on Vidya Loans. Pre-approved collateral-free options are available with 48 hour processing.`
          });
        }
      }
    } catch (error) {
      console.warn("Backend AI comparison failed. Engaging local analytical engine.", error);

      const scoredUnis = selectedUnis.map(u => {
        const tuitionCost = u.tuition || 30000;
        const startSalary = u.avgjobSalary || 60000;
        const roi = startSalary / tuitionCost;
        return { uni: u, roi };
      });
      const sortedByRoi = [...scoredUnis].sort((a, b) => b.roi - a.roi);
      const roiChamp = sortedByRoi[0].uni;
      const sortedByCost = [...selectedUnis].sort((a, b) => (a.tuition || 0) - (b.tuition || 0));
      const costChamp = sortedByCost[0];

      setAiReport({
        roiChampion: roiChamp,
        costChampion: costChamp,
        summary: `[Analytical Synthesis] side-by-side comparison of ${selectedUnis.map(u => u.name).join(" and ")} indicates a strong return efficiency ratio for ${roiChamp.name}. The budget optimization index highlights ${costChamp.name} as the lowest financial commitment pathway.`,
        vidyaLoansRating: "Verified A-Grade",
        vidyaLoansAdvice: `Pre-approved loans at 8.5% p.a. are fully accessible for all selected institutions.`
      });
    } finally {
      setIsGeneratingAi(false);
    }
  };

  return (
    <div className="relative min-h-screen pt-32 pb-24 px-6 overflow-hidden" style={{ background: 'linear-gradient(135deg, #ede0ff 0%, #f3eaff 25%, #fdf6ff 55%, #fef3e8 80%, #fde8c8 100%)' }}>

      {/* Premium Floating Spheres & Grid Background */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-0 w-[600px] h-[600px] rounded-full blur-[120px] opacity-40" style={{ background: 'radial-gradient(circle, #d8b4fe, transparent)' }} />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full blur-[120px] opacity-35" style={{ background: 'radial-gradient(circle, #fed7aa, transparent)' }} />
        <div className="absolute top-1/3 right-1/3 w-64 h-64 rounded-full blur-[80px] opacity-15" style={{ background: 'radial-gradient(circle, #c4b5fd, transparent)' }} />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #6605c7 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header Section */}
        <div className="mb-12 text-center md:text-left">
          {/* <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-purple-100 shadow-sm mb-6">
            <span className="w-2.5 h-2.5 rounded-full bg-[#6605c7] animate-pulse" />
            <span className="text-[10px] font-black text-[#6605c7] uppercase tracking-widest">
              Smart Decision Engine
            </span>
            <span className="w-px h-3 bg-purple-100 mx-1" />
            <span className="text-[10px] font-bold text-gray-400">QS 2026 Database</span>
          </div> */}

          <h1 className="text-4xl md:text-6xl font-black text-gray-900 mb-6 tracking-tight leading-[1.1]">
            Compare <span className="text-[#6605c7]">Universities</span>
          </h1>
          <p className="text-[15px] text-gray-500 max-w-2xl leading-relaxed font-medium">
            Perform granular side-by-side analysis of total program costs, return on investment (ROI), scholarship pathways, employability ratios, and direct loan alignment.
          </p>
        </div>

        {/* Search, Selections & Popular Cards - Glass Card */}
        <div className="mb-8 bg-white/70 backdrop-blur-xl border border-white p-8 rounded-[2.5rem] shadow-[0_20px_50px_-15px_rgba(102,5,199,0.1)]">
          <h2 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-4">
            Search & Shortlist Institutions
          </h2>

          {/* Search Input Container */}
          <div className="relative mb-6">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-gray-400 text-[22px]">search</span>
            </div>
            <input
              type="text"
              placeholder="Search world-class institutions by name, city or country..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white/50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#6605c7]/20 focus:border-[#6605c7] transition-all text-sm font-medium shadow-sm outline-none"
            />

            {/* Auto-Complete Droplist */}
            {(searchResults.length > 0 || isSearching) && (
              <div className="absolute top-full left-0 right-0 mt-3 bg-white/95 backdrop-blur-md border border-gray-100 rounded-2xl shadow-2xl z-50 max-h-72 overflow-y-auto divide-y divide-gray-50 overflow-hidden">
                {isSearching && (
                  <div className="px-6 py-4 text-xs font-semibold text-[#6605c7] flex items-center gap-2 bg-[#6605c7]/5">
                    <div className="w-3.5 h-3.5 border-2 border-[#6605c7]/20 border-t-[#6605c7] rounded-full animate-spin" />
                    <span>AI searching globally...</span>
                  </div>
                )}
                {searchResults.map((uni, idx) => (
                  <button
                    key={`search-${uni.id}-${idx}`}
                    onClick={() => handleAddUni(uni)}
                    className="w-full text-left px-6 py-4 hover:bg-[#6605c7]/5 flex justify-between items-center transition-colors"
                  >
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{uni.name}</p>
                      <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wide mt-1">
                        {uni.city ? `${uni.city}, ` : ""}{uni.country}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-1 rounded bg-[#6605c7]/5 text-[#6605c7] text-[10px] font-black uppercase">
                        QS #{uni.rank}
                      </span>
                      <span className="material-symbols-outlined text-purple-600 text-lg">add_circle</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected Universities Tags */}
          <div className="flex flex-wrap gap-2.5 mb-6">
            {selectedUnis.map((uni, idx) => (
              <div
                key={`sel-${uni.id}-${idx}`}
                className="flex items-center gap-3 pl-4 pr-2 py-2 bg-gradient-to-r from-[#6605c7]/5 to-[#6605c7]/10 border border-[#6605c7]/10 rounded-xl"
              >
                <div className="flex flex-col">
                  <span className="text-[12px] font-bold text-gray-900 leading-tight">
                    {uni.name}
                  </span>
                  <span className="text-[9px] text-[#6605c7] font-black uppercase tracking-wider mt-0.5">
                    {uni.country} • QS #{uni.rank}
                  </span>
                </div>
                <button
                  onClick={() => handleRemoveUni(uni.id)}
                  className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-[#6605c7]/10 text-[#6605c7] transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            ))}
            {selectedUnis.length === 0 && (
              <p className="text-[12px] text-gray-400 italic py-2">
                No universities shortlisted yet. Select from quick-add or search above to begin comparing.
              </p>
            )}
          </div>

          {/* Quick-Add Popular Grid */}
          <div className="border-t border-gray-100/60 pt-6">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">
              Quick Add Popular Universities
            </p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {activeUnis.slice(0, 5).map((uni, idx) => {
                const isSelected = selectedUnis.some(u => u.id === uni.id);
                return (
                  <button
                    key={`pop-${uni.id}-${idx}`}
                    disabled={isSelected || selectedUnis.length >= 5}
                    onClick={() => handleAddUni(uni)}
                    className={`p-4 rounded-2xl border text-left transition-all relative ${isSelected
                      ? "bg-purple-50/50 border-purple-200/50 opacity-60 cursor-default"
                      : "bg-white/40 border-white/60 hover:bg-white/90 hover:border-purple-300 hover:shadow-md cursor-pointer"
                      }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black text-purple-600 uppercase tracking-wider bg-purple-50 px-2 py-0.5 rounded">
                        QS #{uni.rank}
                      </span>
                      {isSelected && (
                        <span className="material-symbols-outlined text-green-500 text-sm">check_circle</span>
                      )}
                    </div>
                    <p className="font-bold text-gray-900 text-[12px] line-clamp-1">{uni.name}</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight mt-0.5">{uni.country}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-between items-center mt-6 text-[11px] text-gray-400 font-black uppercase tracking-wider">
            <span>{selectedUnis.length} / 5 Shortlisted</span>
            <span>Max 5 Allowed</span>
          </div>
        </div>

        {/* View Mode Selector & AI trigger */}
        {selectedUnis.length >= 2 && (
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-8">
            <div className="bg-white/80 border border-white shadow-sm p-1.5 rounded-2xl flex items-center gap-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${viewMode === "grid"
                  ? "bg-[#6605c7] text-white shadow-lg shadow-purple-500/25"
                  : "text-gray-500 hover:text-gray-900 hover:bg-white/50"
                  }`}
              >
                📊 Grid View
              </button>
              <button
                onClick={() => setViewMode("metrics")}
                className={`px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${viewMode === "metrics"
                  ? "bg-[#6605c7] text-white shadow-lg shadow-purple-500/25"
                  : "text-gray-500 hover:text-gray-900 hover:bg-white/50"
                  }`}
              >
                📈 Metrics Comparison
              </button>
              <button
                onClick={() => setViewMode("weighted")}
                className={`px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${viewMode === "weighted"
                  ? "bg-[#6605c7] text-white shadow-lg shadow-purple-500/25"
                  : "text-gray-500 hover:text-gray-900 hover:bg-white/50"
                  }`}
              >
                ⚖️ Prioritized Score
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleExportPdf}
                className="px-5 py-3.5 bg-white hover:bg-purple-50 text-[#6605c7] border border-[#6605c7]/20 text-[11px] font-black uppercase tracking-widest rounded-2xl shadow-sm hover:shadow-md active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer"
                title="Export high-resolution university comparison PDF"
              >
                <span className="material-symbols-outlined text-[17px]">picture_as_pdf</span>
                <span>Export PDF</span>
              </button>

              <button
                onClick={generateAiInsights}
                disabled={isGeneratingAi}
                className="group relative px-6 py-3.5 bg-gradient-to-r from-amber-500 via-orange-500 to-[#6605c7] text-white text-[11px] font-black uppercase tracking-widest rounded-2xl shadow-xl hover:shadow-orange-500/20 active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isGeneratingAi ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Synthesizing...</span>
                  </>
                ) : (
                  <>
                    <span>✨ Generate AI Comparison Report</span>
                    <span className="material-symbols-outlined text-sm group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* AI Insight report card */}
        {aiReport && selectedUnis.length >= 2 && (
          <div className="mb-8 bg-gradient-to-r from-[#6605c7]/5 via-amber-500/[0.03] to-[#6605c7]/10 backdrop-blur-xl border border-white/50 p-8 rounded-[2.5rem] shadow-[0_20px_50px_-15px_rgba(102,5,199,0.08)]">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-xl shadow-inner">
                ✨
              </div>
              <div>
                <h3 className="font-black text-gray-900 text-lg leading-tight">AI Synthesis Report</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Vidya Loans Academic Engine</p>
              </div>
            </div>

            <p className="text-[14px] text-gray-700 leading-relaxed font-medium mb-8 bg-white/40 p-5 rounded-2xl border border-white/50">
              {aiReport.summary}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* ROI Card */}
              <div className="bg-white/80 p-6 rounded-2xl border border-white flex flex-col justify-between shadow-sm">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2.5 py-1 rounded-md">
                      ROI Champion
                    </span>
                    <span className="text-xl">📈</span>
                  </div>
                  <h4 className="font-bold text-gray-900 text-sm mb-1">{aiReport.roiChampion.name}</h4>
                  <p className="text-xs text-gray-500 leading-normal line-clamp-2">{aiReport.roiChampion.description}</p>
                </div>
                <div className="mt-6 pt-4 border-t border-gray-50 flex items-end justify-between">
                  <div>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Avg Salary</p>
                    <p className="text-lg font-black text-emerald-600">${aiReport.roiChampion.avgjobSalary?.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Tuition</p>
                    <p className="text-sm font-bold text-gray-900">${aiReport.roiChampion.tuition?.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Value Card */}
              <div className="bg-white/80 p-6 rounded-2xl border border-white flex flex-col justify-between shadow-sm">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black text-[#6605c7] uppercase tracking-widest bg-[#6605c7]/5 px-2.5 py-1 rounded-md">
                      Cost Efficiency
                    </span>
                    <span className="text-xl">💰</span>
                  </div>
                  <h4 className="font-bold text-gray-900 text-sm mb-1">{aiReport.costChampion.name}</h4>
                  <p className="text-xs text-gray-500 leading-normal line-clamp-2">{aiReport.costChampion.description}</p>
                </div>
                <div className="mt-6 pt-4 border-t border-gray-50 flex items-end justify-between">
                  <div>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Lowest Tuition</p>
                    <p className="text-lg font-black text-[#6605c7]">${aiReport.costChampion.tuition?.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">World Rank</p>
                    <p className="text-sm font-bold text-gray-900">#{aiReport.costChampion.rank}</p>
                  </div>
                </div>
              </div>

              {/* Loan Card */}
              <div className="bg-gradient-to-br from-purple-900 to-[#6605c7] text-white p-6 rounded-2xl flex flex-col justify-between shadow-md">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black text-amber-300 uppercase tracking-widest bg-white/10 px-2.5 py-1 rounded-md">
                      {aiReport.vidyaLoansRating}
                    </span>
                    <span className="text-xl">🏛️</span>
                  </div>
                  <h4 className="font-bold text-white text-sm mb-1">Vidya Loans Funding Analysis</h4>
                  <p className="text-xs text-purple-200 leading-normal">{aiReport.vidyaLoansAdvice}</p>
                </div>
                <div className="mt-6 pt-4 border-t border-white/10 flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-300">Rates from 8.5% p.a.</span>
                  <a href="/apply-loan" className="text-[10px] font-black uppercase tracking-wider bg-white text-[#6605c7] px-3.5 py-1.5 rounded-lg hover:opacity-90 transition-all flex items-center gap-1">
                    Apply Now
                    <span className="material-symbols-outlined text-xs">arrow_forward</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Selected Views Container */}
        {selectedUnis.length >= 2 ? (
          <div className="mt-6">
            {viewMode === "grid" && (
              <ComparisonGrid
                universities={selectedUnis}
                onExportPdf={handleExportPdf}
                onSaveShortlist={handleSaveShortlist}
              />
            )}
            {viewMode === "metrics" && (
              <MetricComparison
                universities={selectedUnis}
                onExportPdf={handleExportPdf}
              />
            )}
            {viewMode === "weighted" && (
              <WeightedScorer
                universities={selectedUnis}
                weights={weights}
                onWeightsChange={setWeights}
                onExportPdf={handleExportPdf}
                onSaveShortlist={handleSaveShortlist}
              />
            )}
          </div>
        ) : (
          <div className="bg-white/40 backdrop-blur-md rounded-[2.5rem] border border-white/60 border-dashed p-16 text-center h-72 flex flex-col justify-center items-center shadow-lg">
            <div className="w-14 h-14 bg-white rounded-2xl shadow-md border border-gray-100 flex items-center justify-center mb-5">
              <span className="material-symbols-outlined text-purple-600 text-3xl">compare_arrows</span>
            </div>
            <p className="text-gray-800 font-bold text-base mb-1">
              Select at least 2 universities to start comparing
            </p>
            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">
              Use the search or click popular colleges above
            </p>
          </div>
        )}

        {/* Dynamic Toast Feedback */}
        {toastMessage && (
          <div className="fixed bottom-8 right-8 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
            <div className="bg-gray-900/95 backdrop-blur-md text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-3 text-xs font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{toastMessage}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
