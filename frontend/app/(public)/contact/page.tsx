import type { Metadata } from "next";
import ContactClient from "./ContactClient";

export const metadata: Metadata = {
    title: "Contact Us - Expert Education Loan Assistance",
    description: "Get in touch with our expert education loan counselors. Request a callback, inquire about loan options, or visit our office.",
    alternates: {
        canonical: "/contact",
    },
};

export default function ContactUsPage() {
    return <ContactClient />;
}
