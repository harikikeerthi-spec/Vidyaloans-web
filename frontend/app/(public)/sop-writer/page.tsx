import type { Metadata } from "next";
import SOPWriterClient from "./SOPWriterClient";

export const metadata: Metadata = {
    title: "AI Statement of Purpose (SOP) Writer & Generator",
    description: "Generate compelling, university-tailored Statements of Purpose (SOP) with VidyaLoans' AI SOP Writer. Boost your study abroad admission chances.",
    alternates: {
        canonical: "/sop-writer",
    },
};

export default function SOPWriterPage() {
    return <SOPWriterClient />;
}
