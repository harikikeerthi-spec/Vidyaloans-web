import type { Metadata } from "next";
import PrivacyPolicyClient from "./PrivacyPolicyClient";

export const metadata: Metadata = {
    title: "Privacy Policy",
    description: "Read VidyaLoans' Privacy Policy to learn how we protect, collect, store, and process your personal and educational loan data.",
    alternates: {
        canonical: "/privacy-policy",
    },
};

export default function PrivacyPolicyPage() {
    return <PrivacyPolicyClient />;
}
