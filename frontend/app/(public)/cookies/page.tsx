import type { Metadata } from "next";
import CookiePolicyClient from "./CookiePolicyClient";

export const metadata: Metadata = {
    title: "Cookie Policy",
    description: "Learn about how VidyaLoans uses cookies and similar tracking technologies to enhance user browsing experiences, analytics, and personalization.",
    alternates: {
        canonical: "/cookies",
    },
};

export default function CookiePolicyPage() {
    return <CookiePolicyClient />;
}
