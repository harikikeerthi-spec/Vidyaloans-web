import UniversityComparisonFlow from "@/components/UniversityComparisonFlow";

export const metadata = {
  title: "Compare Universities - Cost, ROI & Career Outcomes | Vidya Loans",
  description:
    "Side-by-side comparison of universities with detailed metrics: cost, ROI, scholarships, employability, and more.",
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
