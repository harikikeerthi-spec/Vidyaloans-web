import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "404 - Page Not Found | VidyaLoans",
  },
  description: "The page you are looking for does not exist on VidyaLoans.",
  robots: {
    index: false,
    follow: false,
  },
  // Explicitly drop canonical on 404 error page so search engines do not canonicalize /_not-found or dead URLs
  alternates: {
    canonical: null,
  },
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-purple-50/30 flex items-center justify-center px-4 py-16">
      <div className="max-w-xl w-full text-center space-y-8">
        {/* Decorative Badge & Code */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-violet-50 border border-violet-200/80 text-violet-700 text-xs font-black uppercase tracking-widest font-mono">
            <span className="material-symbols-outlined text-sm">error</span>
            Error 404
          </div>
          <h1 className="text-7xl sm:text-8xl font-black text-slate-900 tracking-tight font-serif">
            4<span className="text-violet-600">0</span>4
          </h1>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">
            Page Not Found
          </h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-md mx-auto leading-relaxed">
            The page you are looking for might have been moved, renamed, or is temporarily unavailable.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm shadow-md shadow-violet-500/20 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">home</span>
            Back to Homepage
          </Link>
          <Link
            href="/compare-loans"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-sm shadow-xs transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">payments</span>
            Compare Loans
          </Link>
        </div>

        {/* Helpful Links */}
        <div className="pt-6 border-t border-slate-200/60 flex items-center justify-center gap-6 text-xs font-semibold text-slate-500">
          <Link href="/about-us" className="hover:text-violet-600 transition-colors">
            About Us
          </Link>
          <span>•</span>
          <Link href="/faq" className="hover:text-violet-600 transition-colors">
            FAQs
          </Link>
          <span>•</span>
          <Link href="/contact" className="hover:text-violet-600 transition-colors">
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
}
