import { notFound } from "next/navigation";
import UniversityDetailView from "@/components/UniversityDetailView";
import UniversityPageClient from '@/components/UniversityPageClient';
import { fetchUniversityData } from "@/lib/aiSearchService";

interface Props {
    params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
    const { slug } = await params;
    const universityName = slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    return {
        title: `${universityName} – Rankings & Education Loan | VidyaLoans`,
        description: `Explore ${universityName}'s rankings, programs, and apply for a VidyaLoans education loan today.`,
    };
}

export default async function UniversityPage({ params }: Props) {
    const { slug } = await params;
    let u = null;

    try {
        const universityName = slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        const data = await fetchUniversityData({ type: 'university_detail', slug, query: universityName });
        if (data && data.university) {
            u = {
                ...data.university,
                slug: data.university.slug || slug,
            };
        }
    } catch (e) {
        console.error('AI fetch failed', e);
    }

    // Render a client wrapper which will use server-side data if available,
    // otherwise attempt client-side fallback (localStorage or AI API).
    return <UniversityPageClient serverUniversity={u || null} slug={slug} />;
}
