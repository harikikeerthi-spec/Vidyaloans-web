import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "Webmail Login | VidyaLoans",
  },
  description: "Sign in to the VidyaLoans official webmail communication portal.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function WebmailLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
