"use client";

import { useState, useEffect } from "react";
import ProfileBuilder from "./university-finder/ProfileBuilder";
import ProgramExplorer from "./university-finder/ProgramExplorer";
import SmartMatches from "./university-finder/SmartMatches";
import UniversityCard from "./UniversityCard";

type Step = "profile" | "programs" | "matches" | "results";

type UserProfile = {
  gpa: number | null;
  englishScore: number | null;
  englishTest: "IELTS" | "TOEFL" | "";
  testScore: number | null;
  testType: "GMAT" | "GRE" | "";
  budget: number | null;
  workExperience: number | null;
  targetCountries: string[];
};

type University = {
  name: string;
  country: string;
  loc: string;
  rank?: number;
  accept?: number;
  tuition?: number;
  _score?: number;
  description?: string;
  slug?: string;
  loan?: boolean;
  website?: string;
};

export default function UniversityFinderFlow() {
  const [currentStep, setCurrentStep] = useState<Step>("profile");
  const [profile, setProfile] = useState<UserProfile>({
    gpa: null,
    englishScore: null,
    englishTest: "",
    testScore: null,
    testType: "",
    budget: null,
    workExperience: null,
    targetCountries: [],
  });
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [matchedUniversities, setMatchedUniversities] = useState<University[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);

  // Handle profile completion
  const handleProfileComplete = (profileData: UserProfile) => {
    setProfile(profileData);
    setCurrentStep("programs");
  };

  // Handle program selection
  const handleProgramsSelect = async (programs: string[]) => {
    setSelectedPrograms(programs);
    setIsLoading(true);

    // Simulate API call to match universities
    try {
      const allUniversities: University[] = [
        {
          name: "Massachusetts Institute of Technology (MIT)",
          country: "USA",
          loc: "Cambridge, USA",
          rank: 1,
          accept: 7,
          tuition: 59000,
          _score: 99,
          description: "World #1 university known for premier engineering, technology, and sciences.",
          slug: "mit",
          loan: true,
          website: "https://www.mit.edu",
        },
        {
          name: "University of Cambridge",
          country: "UK",
          loc: "Cambridge, UK",
          rank: 2,
          accept: 16,
          tuition: 44000,
          _score: 96,
          description: "Historic university with world-class collegiate academic programs.",
          slug: "cambridge",
          loan: true,
          website: "https://www.cam.ac.uk",
        },
        {
          name: "University of Oxford",
          country: "UK",
          loc: "Oxford, UK",
          rank: 3,
          accept: 14,
          tuition: 42000,
          _score: 95,
          description: "Leading collegiate research university renowned globally.",
          slug: "oxford",
          loan: true,
          website: "https://www.ox.ac.uk",
        },
        {
          name: "Harvard University",
          country: "USA",
          loc: "Cambridge, USA",
          rank: 4,
          accept: 3,
          tuition: 64000,
          _score: 97,
          description: "World-renowned Ivy League institution known for elite scholarship.",
          slug: "harvard",
          loan: true,
          website: "https://www.harvard.edu",
        },
        {
          name: "Stanford University",
          country: "USA",
          loc: "Palo Alto, California, USA",
          rank: 5,
          accept: 4,
          tuition: 62000,
          _score: 98,
          description: "World-leading technology and innovation powerhouse in Silicon Valley.",
          slug: "stanford-university",
          loan: true,
          website: "https://www.stanford.edu",
        },
        {
          name: "ETH Zurich",
          country: "Switzerland",
          loc: "Zurich, Switzerland",
          rank: 7,
          accept: 27,
          tuition: 1500,
          _score: 94,
          description: "Europe's premier science and technology institute with exceptional value.",
          slug: "eth-zurich",
          loan: true,
          website: "https://www.ethz.ch",
        },
        {
          name: "National University of Singapore (NUS)",
          country: "Singapore",
          loc: "Singapore",
          rank: 8,
          accept: 25,
          tuition: 32000,
          _score: 93,
          description: "Asia's premier global university with world-class tech and business programs.",
          slug: "nus",
          loan: true,
          website: "https://nus.edu.sg",
        },
        {
          name: "University of Melbourne",
          country: "Australia",
          loc: "Melbourne, Australia",
          rank: 14,
          accept: 70,
          tuition: 34000,
          _score: 85,
          description: "Australia's top research university offering flexible degrees.",
          slug: "melbourne",
          loan: true,
          website: "https://www.unimelb.edu.au",
        },
        {
          name: "University of Toronto",
          country: "Canada",
          loc: "Toronto, Canada",
          rank: 21,
          accept: 43,
          tuition: 38000,
          _score: 88,
          description: "Canada's leading research university with top global industry placement.",
          slug: "toronto",
          loan: true,
          website: "https://www.utoronto.ca",
        },
        {
          name: "Technical University of Munich (TUM)",
          country: "Germany",
          loc: "Munich, Germany",
          rank: 28,
          accept: 30,
          tuition: 6000,
          _score: 92,
          description: "Germany's top engineering powerhouse with low public tuition fees.",
          slug: "tum",
          loan: true,
          website: "https://www.tum.de",
        },
        {
          name: "Trinity College Dublin",
          country: "Ireland",
          loc: "Dublin, Ireland",
          rank: 81,
          accept: 33,
          tuition: 24000,
          _score: 84,
          description: "Ireland's premier university integrated with Silicon Docks tech employers.",
          slug: "trinity",
          loan: true,
          website: "https://www.tcd.ie",
        },
      ];

      // Filter by target countries if specified
      let filtered = allUniversities;
      if (profile.targetCountries && profile.targetCountries.length > 0) {
        const countryMatches = allUniversities.filter((u) =>
          profile.targetCountries.some(
            (c) =>
              u.country.toLowerCase() === c.toLowerCase() ||
              u.loc.toLowerCase().includes(c.toLowerCase())
          )
        );
        if (countryMatches.length > 0) {
          filtered = countryMatches;
        }
      }

      // Filter or sort by annual budget if specified
      if (profile.budget && profile.budget > 0) {
        const withinBudget = filtered.filter((u) => (u.tuition ?? 0) <= profile.budget!);
        if (withinBudget.length > 0) {
          filtered = withinBudget;
        } else {
          // If none strictly within budget, sort by closest tuition
          filtered = [...filtered].sort(
            (a, b) => (a.tuition ?? 0) - (b.tuition ?? 0)
          );
        }
      }

      setMatchedUniversities(filtered);
      setCurrentStep("results");
    } catch (error) {
      console.error("Error matching universities:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfaff] py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[50vw] h-[50vw] bg-purple-500/5 rounded-full blur-[120px] -mr-[20vw] -mt-[20vw] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[50vw] h-[50vw] bg-blue-500/5 rounded-full blur-[120px] -ml-[20vw] -mb-[20vw] pointer-events-none" />

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Header - Refined */}
        <div className="text-center mb-16 px-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white rounded-full border border-purple-100 shadow-sm mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest">AI Intelligence Engine</span>
            <span className="w-px h-3 bg-purple-100 mx-1" />
            <span className="text-[10px] font-bold text-gray-400">Powered by GradRight</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-6 tracking-tight leading-tight">
            Discover Your Perfect <br /><span className="text-[#6605c7] italic">Match</span>
          </h1>
          <p className="text-gray-500 font-medium max-w-xl mx-auto leading-relaxed">
            Our proprietary algorithms analyze 50,000+ data points to find institutions that align with your academic DNA and ROI goals.
          </p>
        </div>

        {/* Progress Indicator - Minimal & Premium */}
        <div className="mb-16 max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-8 relative">
            {/* Connecting Line */}
            <div className="absolute top-[1.125rem] left-0 right-0 h-0.5 bg-gray-100 -z-10" />
            <div
              className="absolute top-[1.125rem] left-0 h-0.5 bg-[#6605c7] -z-10 transition-all duration-700"
              style={{ width: `${(['profile', 'programs', 'results'].indexOf(currentStep ?? 'profile')) * 50}%` }}
            />

            {[
              { id: 'profile', label: 'Academic Profile', icon: 'person' },
              { id: 'programs', label: 'Program Choice', icon: 'explore' },
              { id: 'results', label: 'Smart Matches', icon: 'auto_awesome' }
            ].map((s, idx) => {
              const stepIndex = ['profile', 'programs', 'results'].indexOf(currentStep ?? 'profile');
              const isPast = stepIndex > idx;
              const isCurrent = stepIndex === idx;

              return (
                <div key={s.id} className="flex flex-col items-center">
                  <div
                    className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all duration-500 border-2 ${isCurrent
                        ? 'bg-[#6605c7] text-white border-purple-600 shadow-[0_10px_20px_rgba(102,5,199,0.3)]'
                        : isPast
                          ? 'bg-white text-[#6605c7] border-purple-100 shadow-sm'
                          : 'bg-white text-gray-300 border-gray-100'
                      }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {isPast ? 'check' : s.icon}
                    </span>
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest mt-4 transition-colors ${isCurrent ? 'text-gray-900' : 'text-gray-400'}`}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content Card - Clean Workspace */}
        <div className="bg-white/70 backdrop-blur-xl border border-white rounded-[3rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="p-8 md:p-12">
            {currentStep === "profile" && (
              <ProfileBuilder onComplete={handleProfileComplete} />
            )}

            {currentStep === "programs" && (
              <ProgramExplorer
                profile={profile}
                onComplete={handleProgramsSelect}
                isLoading={isLoading}
              />
            )}

            {currentStep === "results" && (
              <SmartMatches
                universities={matchedUniversities}
                profile={profile}
                programs={selectedPrograms}
                onBack={() => {
                  setCurrentStep("programs");
                  setSelectedPrograms([]);
                }}
              />
            )}
          </div>
        </div>

        {/* Support Footer */}
        <div className="mt-12 text-center">
          <p className="text-[11px] text-gray-400 font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> All Data Encrypted & Secured
          </p>
        </div>
      </div>
    </div>

  );
}
