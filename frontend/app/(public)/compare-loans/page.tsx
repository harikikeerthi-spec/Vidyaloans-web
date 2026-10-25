import type { Metadata } from "next";
import CompareLoansClient from "./CompareLoansClient";

export const metadata: Metadata = {
    title: "Compare Education Loans - Rates, Fees & Eligibility",
    description: "Compare education loan interest rates, margin money, processing fees, and moratorium periods across top banks and NBFCs.",
    alternates: {
        canonical: "/compare-loans",
    },
};

export default function CompareLoansPage() {
    return <CompareLoansClient />;
}
