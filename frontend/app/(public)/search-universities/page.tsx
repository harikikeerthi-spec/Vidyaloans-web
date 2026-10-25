import type { Metadata } from "next";
import SearchUniversitiesClient from "./SearchUniversitiesClient";

export const metadata: Metadata = {
    title: "Global Universities Directory - Search & Compare",
    description: "Explore 500+ verified institutions, global rankings, acceptance rates, tuition costs & education loan options across USA, UK, Canada, and Europe.",
    alternates: {
        canonical: "/search-universities",
    },
};

export default function SearchUniversitiesPage() {
    return <SearchUniversitiesClient />;
}
