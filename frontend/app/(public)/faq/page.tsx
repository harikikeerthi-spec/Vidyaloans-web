import type { Metadata } from "next";
import FAQClient from "./FAQClient";

export const metadata: Metadata = {
    title: "Frequently Asked Questions (FAQ)",
    description: "Get answers to common questions about study abroad education loans, interest rates, eligibility, collateral requirements, and disbursement process.",
    alternates: {
        canonical: "/faq",
    },
};

export default function FAQPage() {
    return <FAQClient />;
}
