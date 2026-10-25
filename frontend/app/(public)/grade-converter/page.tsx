import type { Metadata } from "next";
import GradeConverterClient from "./GradeConverterClient";

export const metadata: Metadata = {
    title: "International Grade & GPA Converter - Percentage to 4.0 Scale",
    description: "Convert Indian percentages and CGPA to US 4.0 GPA, UK grades, and European ECTS scales with our smart international grade converter.",
    alternates: {
        canonical: "/grade-converter",
    },
};

export default function GradeConverterPage() {
    return <GradeConverterClient />;
}
