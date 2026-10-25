import type { Metadata } from "next";
import TermsConditionsClient from "./TermsConditionsClient";

export const metadata: Metadata = {
    title: "Terms & Conditions",
    description: "Review the Terms & Conditions governing your use of VidyaLoans' website, loan comparison tools, and education financing advisory services.",
    alternates: {
        canonical: "/terms-conditions",
    },
};

export default function TermsConditionsPage() {
    return <TermsConditionsClient />;
}
