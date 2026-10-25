import type { Metadata } from "next";
import CommunityClient from "./CommunityClient";

export const metadata: Metadata = {
    title: "Student Community & Study Abroad Discussions",
    description: "Join the VidyaLoans student community. Connect with alumni mentors, discuss university admissions, loan processes, and visa experiences.",
    alternates: {
        canonical: "/community",
    },
};

export default function CommunityPage() {
    return <CommunityClient />;
}
