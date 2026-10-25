"use client";

import React, { useEffect, useState } from "react";
import UniversityDetailView from "@/components/UniversityDetailView";

interface Props {
  serverUniversity?: any | null;
  slug: string;
}

export default function UniversityPageClient({ serverUniversity, slug }: Props) {
  const [uni, setUni] = useState<any | null>(serverUniversity || null);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);

  useEffect(() => {
    if (uni) return;
    // Try localStorage first (set when user clicked Details)
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('selectedUniversity') : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        // If slug matches or name matches, use it
        const parsedSlug = parsed.slug || (parsed.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        // Skip stale cached data with placeholder URLs
        const isStale = !parsed.website || parsed.website === 'https://example.edu' || (!parsed.logo && !parsed.logoUrl);
        if (!isStale && (!slug || parsedSlug === slug)) {
          setUni(parsed);
          return;
        }
      }
    } catch (e) {
      // ignore
    }

    // Fallback: fetch server API for details
    const fetchDetail = async () => {
      setLoading(true);
      try {
        const resp = await fetch(`/api/ai-search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'university_detail', slug, query: slug })
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.university) setUni({ ...data.university, slug });
        }
      } catch (err) {
        console.error('client fetch failed', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [slug, uni]);

  // If we have a uni but it's missing images/logo, try to enrich via AI API
  useEffect(() => {
    if (!uni) return;
    const needsHero = !uni.heroImage && !uni.image;
    const needsLogo = !uni.logo && !uni.logoUrl;
    const needsGallery = !(uni.campusImages && uni.campusImages.length > 0) && !(uni.images && uni.images.length > 0);
    if (!needsHero && !needsLogo && !needsGallery) return;

    let cancelled = false;
    const enrich = async () => {
      setEnriching(true);
      try {
        const resp = await fetch('/api/ai-search', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'university_detail', query: uni.name, country: uni.country })
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.university) {
            const merged = { ...uni, ...data.university };
            if (!cancelled) {
              setUni(merged);
              try { window.localStorage.setItem('selectedUniversity', JSON.stringify(merged)); } catch (e) { /* ignore */ }
            }
          }
        }
      } catch (err) {
        console.error('enrich failed', err);
      } finally {
        if (!cancelled) setEnriching(false);
      }
    };

    enrich();
    return () => { cancelled = true; };
  }, [uni]);

  if (!uni && loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#fcfaff] p-10">
      <div className="w-16 h-16 border-4 border-purple-200 border-t-[#6605c7] rounded-full animate-spin mb-6" />
      <h2 className="text-2xl font-display font-bold text-gray-900 mb-2" style={{ fontFamily: "'Noto Serif', 'Playfair Display', serif" }}>Finding University Profile...</h2>
      <p className="text-gray-500 font-medium">Gathering official data and rankings</p>
    </div>
  );

  if (!uni) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#fcfaff] p-10">
      <span className="material-symbols-outlined text-gray-300 text-6xl mb-6">domain_disabled</span>
      <h2 className="text-2xl font-display font-bold text-gray-900 mb-2" style={{ fontFamily: "'Noto Serif', 'Playfair Display', serif" }}>University Not Found</h2>
      <p className="text-gray-500 font-medium mb-8">We couldn&apos;t locate this specific institution.</p>
      <button onClick={() => window.history.back()} className="px-8 py-3 bg-[#6605c7] text-white font-bold rounded-2xl shadow-xl hover:shadow-purple-500/30 transition-all">Go Back</button>
    </div>
  );

  // Normalize the university object to avoid runtime errors in the detail view
  const normalized = {
    slug: uni.slug || slug || '',
    name: uni.name || uni.title || 'Unknown University',
    shortName: uni.shortName || (uni.name ? uni.name.split(' ')[0] : 'University'),
    location: uni.loc || uni.location || uni.city || '',
    country: uni.country || uni.countryCode || '',
    countryCode: uni.countryCode || (uni.country ? (uni.country || '').slice(0, 2).toLowerCase() : ''),
    flag: uni.flag || undefined,
    founded: uni.founded || 1900,
    type: uni.type || 'University',
    rank: uni.rank || uni.qsRank || 999,
    rankBy: uni.rankBy || 'QS',
    acceptanceRate: uni.acceptanceRate || uni.accept || uni.acceptance || 0,
    tuition: uni.tuition || 0,
    currency: uni.currency || 'USD',
    description: uni.description || uni.summary || '',
    heroImage: (() => {
      const raw = uni.heroImage || uni.image || '';
      // Filter out broken unsplash source URLs
      if (raw && !raw.includes('source.unsplash.com')) return raw;
      // Country-based fallback
      const c = (uni.country || '').toLowerCase();
      const fallbacks: Record<string, string> = {
        'united kingdom': 'https://images.unsplash.com/photo-1607237138185-eedd9c632b0b?w=1600&q=80',
        'uk': 'https://images.unsplash.com/photo-1607237138185-eedd9c632b0b?w=1600&q=80',
        'usa': 'https://images.unsplash.com/photo-1562774053-701939374585?w=1600&q=80',
        'united states': 'https://images.unsplash.com/photo-1562774053-701939374585?w=1600&q=80',
        'canada': 'https://images.unsplash.com/photo-1580537659466-0a9bfa916a54?w=1600&q=80',
        'australia': 'https://images.unsplash.com/photo-1523482580672-f109ba8cb9be?w=1600&q=80',
        'germany': 'https://images.unsplash.com/photo-1597672890275-702a4953ff1f?w=1600&q=80',
        'ireland': 'https://images.unsplash.com/photo-1590089415225-401ed6f9db8e?w=1600&q=80',
        'france': 'https://images.unsplash.com/photo-1549144511-f099e773c147?w=1600&q=80',
        'singapore': 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=1600&q=80',
      };
      return fallbacks[c] || 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1600&q=80';
    })(),
    campusImages: (() => {
      const raw = uni.campusImages || uni.images || [];
      // Filter out broken unsplash source URLs
      const valid = raw.filter((img: string) => img && !img.includes('source.unsplash.com'));
      if (valid.length > 0) return valid;
      return [
        'https://images.unsplash.com/photo-1562774053-701939374585?w=800&q=80',
        'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&q=80',
        '/images/university-default.jpg',
      ];
    })(),
    logo: (() => {
      const raw = uni.logo || uni.logoUrl || '';
      if (raw && !raw.includes('placeholder') && !raw.includes('example')) return raw;
      // Auto-generate from website domain using Clearbit
      const web = uni.website || '';
      if (web) {
        try {
          const domain = new URL(web).hostname.replace(/^www\./, '');
          return `https://logo.clearbit.com/${domain}`;
        } catch { /* ignore */ }
      }
      return raw;
    })(),
    primaryColor: uni.primaryColor || '#6605c7',
    gradient: uni.gradient || '',
    badge: uni.badge || 'AI Verified',
    website: uni.website || uni.web_pages || (uni.website && uni.website[0]) || '',
    stats: (uni.stats && typeof uni.stats === 'object') ? {
      totalStudents: String(uni.stats.totalStudents || '—'),
      internationalStudents: String(uni.stats.internationalStudents || '—'),
      facultyRatio: String(uni.stats.facultyRatio || '—'),
      researchOutput: String(uni.stats.researchOutput || '—'),
      employmentRate: String(uni.stats.employmentRate || (uni.employmentStats?.employmentRate ? uni.employmentStats.employmentRate + '%' : '—')),
      avgSalary: String(uni.stats.avgSalary || uni.employmentStats?.averageSalary || '—'),
    } : { totalStudents: '—', internationalStudents: '—', facultyRatio: '—', researchOutput: '—', employmentRate: '—', avgSalary: '—' },
    programs: (Array.isArray(uni.programs) ? uni.programs : (Array.isArray(uni.courses) ? uni.courses : [])).map((p: any) => {
      if (typeof p === 'string') return { name: p, degree: 'Master\'s', duration: '2 Years', tuition: 'See Website', icon: 'school' };
      return {
        name: p.name || p.title || 'Unknown program',
        degree: p.degree || p.level || 'Master\'s',
        duration: p.duration || '2 Years',
        tuition: p.tuition || p.fees || 'Contact University',
        icon: p.icon || 'auto_stories'
      };
    }),
    topRecruiters: (typeof uni.topRecruiters === 'string' ? uni.topRecruiters.split(',').map((s: string) => s.trim()) : (Array.isArray(uni.topRecruiters) ? uni.topRecruiters : [])).map((r: any) => String(typeof r === 'object' ? (r.name || JSON.stringify(r)) : r)),
    requirements: (uni.requirements && typeof uni.requirements === 'object') ? {
      gpa: uni.requirements.gpa || '—',
      ielts: uni.requirements.ielts || '—',
      toefl: uni.requirements.toefl || '—',
      gre: uni.requirements.gre || '—'
    } : { gpa: '—', ielts: '—', toefl: '—', gre: '—' },
    loanInfo: typeof uni.loanInfo === 'object' && uni.loanInfo !== null ? uni.loanInfo : { availableLenders: [], avgLoanAmount: '', collateralFree: false, fastTrack: false, notes: '' },
    pros: Array.isArray(uni.pros) ? uni.pros : (typeof uni.pros === 'string' ? uni.pros.split('\n').filter(Boolean) : []),
    campusFacilities: (Array.isArray(uni.campusFacilities) ? uni.campusFacilities : []).map((f: any) => {
      if (typeof f === 'string') return f;
      return { 
        name: String(f.name || f.title || 'Facility'), 
        icon: String(f.icon || 'apartment') 
      };
    }),
    funFacts: (Array.isArray(uni.funFacts) ? uni.funFacts : []).map((f: any) => typeof f === 'object' ? String(f.fact || f.text || JSON.stringify(f)) : String(f)),
    whyStudyHere: (Array.isArray(uni.whyStudyHere) ? uni.whyStudyHere : []).map((f: any) => typeof f === 'object' ? String(f.reason || f.text || JSON.stringify(f)) : String(f)),
    notableAlumni: (Array.isArray(uni.notableAlumni) ? uni.notableAlumni : []).map((f: any) => {
      if (typeof f === 'string') return f;
      return {
        name: String(f.name || f.title || 'Notable Alumni'),
        role: String(f.role || f.position || 'Professional'),
        company: String(f.company || f.org || ''),
        img: String(f.img || f.image || '')
      };
    }),
  } as any;

  return <UniversityDetailView university={normalized} />;
}
