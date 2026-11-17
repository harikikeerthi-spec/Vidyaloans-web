"use client";

import { useState } from "react";

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

interface ProfileBuilderProps {
  onComplete: (profile: UserProfile) => void;
}

const COUNTRIES = [
  "USA",
  "UK",
  "Canada",
  "Australia",
  "Germany",
  "Netherlands",
  "Singapore",
  "Ireland",
];

export default function ProfileBuilder({ onComplete }: ProfileBuilderProps) {
  const [gpaScale, setGpaScale] = useState<"4.0" | "10.0">("10.0");
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

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (gpaScale === "4.0") {
      if (!profile.gpa || profile.gpa <= 0 || profile.gpa > 4.0) {
        newErrors.gpa = "GPA must be between 0.1 and 4.0";
      }
    } else {
      if (!profile.gpa || profile.gpa <= 0 || profile.gpa > 10.0) {
        newErrors.gpa = "CGPA must be between 0.1 and 10.0";
      }
    }

    if (!profile.englishTest) {
      newErrors.englishTest = "Select an English proficiency test";
    } else if (!profile.englishScore || profile.englishScore <= 0) {
      newErrors.englishScore = "Enter a valid English score";
    } else if (profile.englishTest === "IELTS" && (profile.englishScore < 1 || profile.englishScore > 9)) {
      newErrors.englishScore = "IELTS score must be between 1.0 and 9.0";
    } else if (profile.englishTest === "TOEFL" && (profile.englishScore < 1 || profile.englishScore > 120)) {
      newErrors.englishScore = "TOEFL score must be between 1 and 120";
    }

    if (!profile.testType) {
      newErrors.testType = "Select a standardized test (GMAT/GRE)";
    } else if (!profile.testScore || profile.testScore <= 0) {
      newErrors.testScore = "Enter a valid test score";
    } else if (profile.testType === "GRE" && (profile.testScore < 260 || profile.testScore > 340)) {
      newErrors.testScore = "GRE score must be between 260 and 340";
    } else if (profile.testType === "GMAT" && (profile.testScore < 200 || profile.testScore > 800)) {
      newErrors.testScore = "GMAT score must be between 200 and 800";
    }

    if (!profile.budget || profile.budget <= 0) {
      newErrors.budget = "Enter a valid annual budget greater than $0";
    }
    if (profile.workExperience === null || profile.workExperience < 0) {
      newErrors.workExperience = "Enter years of work experience (0 or more)";
    }
    if (profile.targetCountries.length === 0) {
      newErrors.targetCountries = "Select at least one country";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field: string, value: string | number) => {
    setProfile((prev) => ({
      ...prev,
      [field]: value,
    }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleCountryToggle = (country: string) => {
    setProfile((prev) => ({
      ...prev,
      targetCountries: prev.targetCountries.includes(country)
        ? prev.targetCountries.filter((c) => c !== country)
        : [...prev.targetCountries, country],
    }));
    if (errors.targetCountries) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.targetCountries;
        return newErrors;
      });
    }
  };

  const handleSubmit = () => {
    if (validateForm()) {
      const normalizedGpa = profile.gpa && gpaScale === "10.0"
        ? parseFloat((profile.gpa / 2.5).toFixed(2))
        : profile.gpa;
      onComplete({
        ...profile,
        gpa: normalizedGpa,
      });
    }
  };

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-900 mb-2">
        Tell Us About Yourself
      </h2>
      <p className="text-gray-600 mb-8">
        Your academic profile helps us find the perfect universities for you
      </p>

      <div className="space-y-8">
        {/* Academic Scores */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* GPA */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                {gpaScale === "10.0" ? "CGPA (0 - 10.0 Scale)" : "GPA (0 - 4.0 Scale)"}
              </label>
              <div className="flex items-center text-xs font-bold gap-1 bg-gray-100 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => { setGpaScale("10.0"); handleChange("gpa", ""); }}
                  className={`px-2 py-0.5 rounded-md transition-all ${gpaScale === "10.0" ? "bg-white text-purple-700 shadow-sm" : "text-gray-500"}`}
                >
                  10.0 CGPA
                </button>
                <button
                  type="button"
                  onClick={() => { setGpaScale("4.0"); handleChange("gpa", ""); }}
                  className={`px-2 py-0.5 rounded-md transition-all ${gpaScale === "4.0" ? "bg-white text-purple-700 shadow-sm" : "text-gray-500"}`}
                >
                  4.0 GPA
                </button>
              </div>
            </div>
            <input
              type="number"
              step={gpaScale === "10.0" ? "0.1" : "0.01"}
              min="0.1"
              max={gpaScale === "10.0" ? "10" : "4"}
              placeholder={gpaScale === "10.0" ? "e.g. 8.5" : "e.g. 3.8"}
              value={profile.gpa || ""}
              onChange={(e) =>
                handleChange("gpa", parseFloat(e.target.value) || "")
              }
              className={`w-full px-4 py-3 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                errors.gpa ? "border-red-500 bg-red-50" : "border-gray-300"
              }`}
            />
            {errors.gpa && (
              <p className="text-red-500 text-sm mt-1">{errors.gpa}</p>
            )}
          </div>

          {/* Work Experience */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Work Experience (Years)
            </label>
            <input
              type="number"
              placeholder="2"
              value={profile.workExperience || ""}
              onChange={(e) =>
                handleChange("workExperience", parseInt(e.target.value) || "")
              }
              className={`w-full px-4 py-3 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                errors.workExperience
                  ? "border-red-500 bg-red-50"
                  : "border-gray-300"
              }`}
            />
            {errors.workExperience && (
              <p className="text-red-500 text-sm mt-1">
                {errors.workExperience}
              </p>
            )}
          </div>
        </div>

        {/* English Proficiency */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              English Test
            </label>
            <select
              value={profile.englishTest}
              onChange={(e) =>
                handleChange("englishTest", e.target.value)
              }
              className={`w-full px-4 py-3 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                errors.englishTest ? "border-red-500 bg-red-50" : "border-gray-300"
              }`}
            >
              <option value="">Select test type</option>
              <option value="IELTS">IELTS</option>
              <option value="TOEFL">TOEFL</option>
            </select>
            {errors.englishTest && (
              <p className="text-red-500 text-sm mt-1">{errors.englishTest}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Score {profile.englishTest === "IELTS" ? "(1.0 - 9.0)" : profile.englishTest === "TOEFL" ? "(1 - 120)" : ""}
            </label>
            <input
              type="number"
              step={profile.englishTest === "IELTS" ? "0.5" : "1"}
              min={profile.englishTest === "IELTS" ? "1" : "1"}
              max={profile.englishTest === "IELTS" ? "9" : "120"}
              placeholder={profile.englishTest === "IELTS" ? "e.g. 7.5 (Max 9.0)" : profile.englishTest === "TOEFL" ? "e.g. 105 (Max 120)" : "Score"}
              value={profile.englishScore || ""}
              onChange={(e) =>
                handleChange("englishScore", parseFloat(e.target.value) || "")
              }
              className={`w-full px-4 py-3 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                errors.englishScore
                  ? "border-red-500 bg-red-50"
                  : "border-gray-300"
              }`}
            />
            {errors.englishScore && (
              <p className="text-red-500 text-sm mt-1">{errors.englishScore}</p>
            )}
          </div>
        </div>

        {/* Standardized Test */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Standardized Test
            </label>
            <select
              value={profile.testType}
              onChange={(e) => handleChange("testType", e.target.value)}
              className={`w-full px-4 py-3 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                errors.testType ? "border-red-500 bg-red-50" : "border-gray-300"
              }`}
            >
              <option value="">Select test type</option>
              <option value="GRE">GRE</option>
              <option value="GMAT">GMAT</option>
            </select>
            {errors.testType && (
              <p className="text-red-500 text-sm mt-1">{errors.testType}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Score {profile.testType === "GRE" ? "(260 - 340)" : profile.testType === "GMAT" ? "(200 - 800)" : ""}
            </label>
            <input
              type="number"
              min={profile.testType === "GRE" ? "260" : "200"}
              max={profile.testType === "GRE" ? "340" : "800"}
              placeholder={profile.testType === "GRE" ? "e.g. 320 (260 - 340)" : profile.testType === "GMAT" ? "e.g. 700 (200 - 800)" : "Score"}
              value={profile.testScore || ""}
              onChange={(e) =>
                handleChange("testScore", parseInt(e.target.value) || "")
              }
              className={`w-full px-4 py-3 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                errors.testScore ? "border-red-500 bg-red-50" : "border-gray-300"
              }`}
            />
            {errors.testScore && (
              <p className="text-red-500 text-sm mt-1">{errors.testScore}</p>
            )}
          </div>
        </div>

        {/* Budget */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Annual Budget ($)
          </label>
          <input
            type="number"
            placeholder="50000"
            value={profile.budget || ""}
            onChange={(e) =>
              handleChange("budget", parseInt(e.target.value) || "")
            }
            className={`w-full px-4 py-3 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 ${
              errors.budget ? "border-red-500 bg-red-50" : "border-gray-300"
            }`}
          />
          {errors.budget && (
            <p className="text-red-500 text-sm mt-1">{errors.budget}</p>
          )}
        </div>

        {/* Target Countries */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Which countries interest you?
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {COUNTRIES.map((country) => (
              <button
                key={country}
                onClick={() => handleCountryToggle(country)}
                className={`px-4 py-2 rounded-lg border-2 font-medium transition-all ${
                  profile.targetCountries.includes(country)
                    ? "border-purple-600 bg-purple-50 text-purple-600"
                    : "border-gray-300 text-gray-700 hover:border-purple-400"
                }`}
              >
                {country}
              </button>
            ))}
          </div>
          {errors.targetCountries && (
            <p className="text-red-500 text-sm mt-1">{errors.targetCountries}</p>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        className="w-full mt-8 px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
      >
        Continue to Program Selection →
      </button>
    </div>
  );
}
