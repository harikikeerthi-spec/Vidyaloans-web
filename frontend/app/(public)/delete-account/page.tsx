import type { Metadata } from "next";
import DeleteAccountClient from "./DeleteAccountClient";

export const metadata: Metadata = {
    title: "Account & Data Deletion Request | VidyaLoans",
    description:
        "Submit a request to delete your VidyaLoans account and associated personal data pursuant to the Digital Personal Data Protection Act, 2023 (DPDP Act) and Google Play Data Safety requirements.",
    alternates: {
        canonical: "/delete-account",
    },
};

export default function DeleteAccountPage() {
    return <DeleteAccountClient />;
}

