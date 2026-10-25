import type { Metadata } from "next";
import HowItWorksClient from "./HowItWorksClient";

export const metadata: Metadata = {
    title: "How It Works - Simple 4-Step Education Loan Process",
    description: "Learn how VidyaLoans simplifies your overseas education loan process from application and lender comparison to sanction and disbursement.",
    alternates: {
        canonical: "/how-it-works",
    },
};

export default function HowItWorksPage() {
    return <HowItWorksClient />;
}
