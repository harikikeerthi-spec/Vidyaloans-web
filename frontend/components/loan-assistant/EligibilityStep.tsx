"use client";

import { useState } from "react";

type EligibilityData = {
  annualIncome: number | null;
  creditScore: number | null;
  employmentType: string;
  yearsOfEmployment: number | null;
};

interface EligibilityStepProps {
  onComplete: (data: EligibilityData) => void;
  isLoading: boolean;
}

export default function EligibilityStep({
  onComplete,
  isLoading,
}: EligibilityStepProps) {
  const [formData, setFormData] = useState<EligibilityData>({
    annualIncome: null,
    creditScore: null,
    employmentType: "",
    yearsOfEmployment: null,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.annualIncome || formData.annualIncome <= 0) {
      newErrors.annualIncome = "Annual income must be greater than ₹0";
    }
    if (!formData.creditScore || formData.creditScore < 300 || formData.creditScore > 900) {
      newErrors.creditScore = "CIBIL score must be between 300 and 900";
    }
    if (!formData.employmentType) {
      newErrors.employmentType = "Please select employment type";
    }
    if (!formData.yearsOfEmployment || formData.yearsOfEmployment < 0) {
      newErrors.yearsOfEmployment = "Please enter years of employment";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (
    field: keyof EligibilityData,
    value: string | number
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: field === "employmentType" ? value : Number(value),
    }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleEmploymentTypeChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      employmentType: value,
    }));
    if (errors.employmentType) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.employmentType;
        return newErrors;
      });
    }
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onComplete(formData);
    }
  };

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-900 mb-2">
        Loan Eligibility Assessment
      </h2>
      <p className="text-gray-600 mb-8">
        Help us understand your financial profile to recommend the best loan
        products
      </p>

      <div className="space-y-6">
        {/* Annual Income */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Annual Income (₹)
          </label>
          <input
            type="number"
            placeholder="e.g., 500000"
            value={formData.annualIncome || ""}
            onChange={(e) =>
              handleChange("annualIncome", parseInt(e.target.value) || "")
            }
            className={`w-full px-4 py-3 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 ${
              errors.annualIncome
                ? "border-red-500 bg-red-50"
                : "border-gray-300"
            }`}
          />
          {errors.annualIncome && (
            <p className="text-red-500 text-sm mt-1">{errors.annualIncome}</p>
          )}
        </div>

        {/* Credit Score */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Credit Score (CIBIL)
          </label>
          <input
            type="number"
            placeholder="e.g., 750"
            value={formData.creditScore || ""}
            onChange={(e) =>
              handleChange("creditScore", parseInt(e.target.value) || "")
            }
            className={`w-full px-4 py-3 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 ${
              errors.creditScore
                ? "border-red-500 bg-red-50"
                : "border-gray-300"
            }`}
          />
          {errors.creditScore && (
            <p className="text-red-500 text-sm mt-1">{errors.creditScore}</p>
          )}
          <p className="text-gray-500 text-xs mt-1">
            Don't know your score? Get it free at cibil.com
          </p>
        </div>

        {/* Employment Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Employment Type
          </label>
          <div className="grid grid-cols-2 gap-3">
            {["Service", "Self-Employed", "Business", "Student"].map(
              (type) => (
                <button
                  key={type}
                  onClick={() => handleEmploymentTypeChange(type)}
                  className={`px-4 py-3 rounded-lg border-2 font-medium transition-all ${
                    formData.employmentType === type
                      ? "border-purple-600 bg-purple-50 text-purple-600"
                      : "border-gray-300 text-gray-700 hover:border-purple-400"
                  }`}
                >
                  {type}
                </button>
              )
            )}
          </div>
          {errors.employmentType && (
            <p className="text-red-500 text-sm mt-1">{errors.employmentType}</p>
          )}
        </div>

        {/* Years of Employment */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Years of Employment
          </label>
          <input
            type="number"
            placeholder="e.g., 3"
            value={formData.yearsOfEmployment || ""}
            onChange={(e) =>
              handleChange("yearsOfEmployment", parseInt(e.target.value) || "")
            }
            className={`w-full px-4 py-3 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 ${
              errors.yearsOfEmployment
                ? "border-red-500 bg-red-50"
                : "border-gray-300"
            }`}
          />
          {errors.yearsOfEmployment && (
            <p className="text-red-500 text-sm mt-1">
              {errors.yearsOfEmployment}
            </p>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={isLoading}
        className="w-full mt-8 px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
      >
        {isLoading ? "Checking Eligibility..." : "Get Personalized Recommendations →"}
      </button>
    </div>
  );
}
