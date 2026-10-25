import type { Metadata } from "next";
import SOPAnalyzerClient from "./SOPAnalyzerClient";

export const metadata: Metadata = {
    title: "AI SOP Analyzer - Review & Score Your Statement of Purpose",
    description: "Analyze, score, and optimize your Statement of Purpose (SOP) with AI. Get actionable feedback on clarity, structure, and university alignment.",
    alternates: {
        canonical: "/sop-analyzer",
    },
};

export default function SOPAnalyzerPage() {
    return <SOPAnalyzerClient />;
}
