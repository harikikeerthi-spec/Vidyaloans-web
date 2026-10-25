import type { Metadata } from "next";
import UniversityComparisonFlow from "@/components/UniversityComparisonFlow";

export const metadata: Metadata = {
  title: "Compare Universities - Cost, ROI & Career Outcomes",
  description:
    "Side-by-side comparison of universities with detailed metrics: tuition cost, living expenses, ROI, scholarships, and career employability.",
  alternates: {
    canonical: "/compare-universities",
  },
};

interface CompareUniversitiesPageProps {
  searchParams?: Promise<{ unis?: string; ids?: string }>;
}

export default async function CompareUniversitiesPage({
  searchParams,
}: CompareUniversitiesPageProps) {
  const resolvedParams = searchParams ? await searchParams : {};
  const unisParam = resolvedParams.unis || resolvedParams.ids;
  const initialUnis = unisParam
    ? unisParam.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;

  return (
    <main className="min-h-screen bg-transparent">
      <UniversityComparisonFlow initialUnis={initialUnis} />
    </main>
  );
}
