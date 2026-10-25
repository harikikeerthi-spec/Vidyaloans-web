import type { Metadata } from "next";
import AdmitPredictorClient from "./AdmitPredictorClient";

export const metadata: Metadata = {
    title: "AI University Admit Predictor - Calculate Admission Chances",
    description: "Evaluate your admission chances for top universities worldwide with our AI Admit Predictor based on GPA, GRE, IELTS, and profile strength.",
    alternates: {
        canonical: "/admit-predictor",
    },
};

export default function AdmitPredictorPage() {
    return <AdmitPredictorClient />;
}
