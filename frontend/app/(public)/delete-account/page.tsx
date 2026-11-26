import type { Metadata } from "next";
import DeleteAccountClient from "./DeleteAccountClient";

export const metadata: Metadata = {
    title: {
        absolute: "Account & Data Deletion Request | VidyaLoans",
    },
    description:
        "Submit a request to delete your VidyaLoans account and associated personal data pursuant to the Digital Personal Data Protection Act, 2023 (DPDP Act) and Google Play Data Safety requirements.",
    alternates: {
        canonical: "https://vidyaloans.in/delete-account",
    },
    openGraph: {
        title: "Account & Data Deletion Request | VidyaLoans",
        description: "Submit a request to delete your VidyaLoans account and associated personal data.",
        url: "https://vidyaloans.in/delete-account",
        siteName: "VidyaLoans",
        type: "website",
        images: [
            {
                url: "https://vidyaloans.in/images/og-image.png",
                width: 1200,
                height: 630,
                alt: "VidyaLoans Account Deletion",
            },
        ],
    },
};

export default function DeleteAccountPage() {
    return <DeleteAccountClient />;
}

