import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Official Webmail - VidyaLoans',
  description: 'Confidential corporate communication portal.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function WebmailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
