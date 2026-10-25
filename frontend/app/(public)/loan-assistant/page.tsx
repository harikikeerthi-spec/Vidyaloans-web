import type { Metadata } from "next";
import LoanAssistantFlow from "@/components/LoanAssistantFlow";

export const metadata: Metadata = {
  title: "Loan Assistant - Guidance & EMI Calculator",
  description: "Get guided assistance for education loan eligibility, product recommendations, EMI calculations, and document requirements.",
  alternates: {
    canonical: "/loan-assistant",
  },
};

export default function LoanAssistantPage() {
  return (
    <main className="min-h-screen bg-white">
      <LoanAssistantFlow />
    </main>
  );
}
