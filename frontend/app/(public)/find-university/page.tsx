import type { Metadata } from "next";
import UniversityFinderFlow from "@/components/UniversityFinderFlow";

export const metadata: Metadata = {
  title: "Find Your University - Smart Matching",
  description:
    "Find the perfect university based on your academic profile, program interests, and budget. AI-powered university matching and recommendations.",
  alternates: {
    canonical: "/find-university",
  },
};

export default function FindUniversityPage() {
  return (
    <main className="min-h-screen bg-white">
      <UniversityFinderFlow />
    </main>
  );
}
