import type { Metadata } from "next";
import BlogClient from "./BlogClient";

export const metadata: Metadata = {
    title: "Blog - Education Loan & Study Abroad Guides",
    description: "Read expert guides, tips, and success stories about education loans and studying abroad.",
    alternates: {
        canonical: "/blog",
    },
};

export default function BlogPage() {
    return (
        <div className="min-h-screen bg-transparent">
            <BlogClient />
        </div>
    );
}
