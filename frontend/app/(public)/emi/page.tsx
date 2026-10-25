import type { Metadata } from "next";
import EmiCalculatorClient from "./EmiCalculatorClient";

export const metadata: Metadata = {
    title: "Education Loan EMI Calculator - Plan Monthly Repayments",
    description: "Calculate your overseas education loan EMI, total interest payable, and amortization schedule with our interactive EMI calculator.",
    alternates: {
        canonical: "/emi",
    },
};

export default function EmiCalculatorPage() {
    return <EmiCalculatorClient />;
}
