import type { Metadata } from "next";
import CommunityEventsClient from "./CommunityEventsClient";

export const metadata: Metadata = {
    title: "Community Events & Webinars - Study Abroad & Loans",
    description: "Join live webinars, expert Q&A sessions, and workshops on overseas education loans, visa guidance, and university admissions.",
    alternates: {
        canonical: "/community-events",
    },
};

export default function CommunityEventsPage() {
    return <CommunityEventsClient />;
}
