import type { Metadata } from "next";
import RepaymentStressClient from "./RepaymentStressClient";

export const metadata: Metadata = {
    title: "Loan Repayment Stress Calculator - Affordability Index",
    description: "Stress test your education loan repayment. Check post-graduation salary vs EMI affordability across USA, UK, Canada, and Australia.",
    alternates: {
        canonical: "/repayment-stress",
    },
};

export default function RepaymentStressPage() {
    return <RepaymentStressClient />;
}
