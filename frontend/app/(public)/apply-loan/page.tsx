import type { Metadata } from "next";
import ApplyLoanClient from "./ApplyLoanClient";

export const metadata: Metadata = {
    title: "Apply for Education Loan Online - Fast Approval",
    description: "Apply for study abroad education loans online. Compare offers from 5+ partner banks and NBFCs with fast track approvals and dedicated counselor guidance.",
    alternates: {
        canonical: "/apply-loan",
    },
};

export default function ApplyLoanPage() {
    return <ApplyLoanClient />;
}
