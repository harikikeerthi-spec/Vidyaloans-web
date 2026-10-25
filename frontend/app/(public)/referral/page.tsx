import React from 'react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import ReferralClientPage from './ReferralClientPage';

export const metadata: Metadata = {
  title: "Refer & Earn ₹3,000 - Student Referral Program",
  description: "Invite your friends to apply for education loans through VidyaLoans. Earn ₹3,000 for every student who secures a loan sanction.",
  alternates: {
    canonical: "/referral",
  },
};

async function getReferralData(token: string) {
  try {
    const res = await fetch(`${process.env.BACKEND_URL || 'http://localhost:5000'}/api/referral/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 0 } // no cache
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error('[ReferralPage] Fetch failed:', error);
    return null;
  }
}

export default async function ReferralPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('accessToken')?.value;

  if (!token) {
    return (
      <div className="min-h-screen bg-[#0a051b] flex items-center justify-center px-6 pt-20 text-white">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-900/40">
            <span className="material-symbols-outlined text-4xl text-white">volunteer_activism</span>
          </div>
          <h1 className="text-3xl font-bold mb-4 font-display">Join Our Referral Program</h1>
          <p className="text-purple-300 mb-8">Sign in to get your unique referral code and start earning ₹3,000 for every successful referral.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/login?redirect=/referral" className="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-xl hover:-translate-y-0.5 transition-all">
              Sign In
            </Link>
            <Link href="/signup" className="px-8 py-4 bg-purple-950/40 border border-purple-500/20 text-purple-200 font-bold rounded-xl hover:bg-purple-950/60 transition-all">
              Create Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const data = await getReferralData(token);

  if (!data || !data.success) {
    // If token is invalid or request failed, render the login block as well
    return (
      <div className="min-h-screen bg-[#0a051b] flex items-center justify-center px-6 pt-20 text-white">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-900/40">
            <span className="material-symbols-outlined text-4xl text-white">volunteer_activism</span>
          </div>
          <h1 className="text-3xl font-bold mb-4 font-display">Session Expired</h1>
          <p className="text-purple-300 mb-8">Please sign in again to access your referral dashboard.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/login?redirect=/referral" className="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-xl hover:-translate-y-0.5 transition-all">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ReferralClientPage 
      initialData={{
        referralCode: data.referralCode,
        stats: data.stats,
        referrals: data.referrals
      }}
      userEmail=""
    />
  );
}
