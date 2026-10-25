import type { Metadata } from "next";
import LoanEligibilityClient from "./LoanEligibilityClient";

export const metadata: Metadata = {
    title: "Education Loan Eligibility Checker - Instant Assessment",
    description: "Check your study abroad education loan eligibility in seconds. Instant evaluation of collateral, co-applicant income, and lender match.",
    alternates: {
        canonical: "/loan-eligibility",
    },
};

export default function LoanEligibilityPage() {
    return <LoanEligibilityClient />;
}
