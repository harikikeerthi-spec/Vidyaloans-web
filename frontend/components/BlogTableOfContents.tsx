"use client";

import React, { useState, useEffect, useRef } from "react";

export interface BlogHeading {
  id: string;
  text: string;
  level: number;
}

interface BlogTableOfContentsProps {
  headings: BlogHeading[];
  title?: string;
  className?: string;
  isMobileOnly?: boolean;
}

export default function BlogTableOfContents({
  headings,
  title = "Table of Contents",
  className = "",
  isMobileOnly = false,
}: BlogTableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>("");
  const [readingProgress, setReadingProgress] = useState<number>(0);
  const [mobileExpanded, setMobileExpanded] = useState<boolean>(false);
  const isClickingRef = useRef<boolean>(false);

  // Set initial active heading to the first heading if available
  useEffect(() => {
    if (headings.length > 0 && !activeId) {
      setActiveId(headings[0].id);
    }
  }, [headings, activeId]);

  // Track scroll position to update reading progress & active heading
  useEffect(() => {
    if (headings.length === 0) return;

    const handleScroll = () => {
      // Calculate overall page/article reading progress
      const scrollY = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        const pct = Math.min(100, Math.max(0, Math.round((scrollY / docHeight) * 100)));
        setReadingProgress(pct);
      }

      // If user recently clicked a TOC item, let the smooth scroll finish before re-evaluating
      if (isClickingRef.current) return;

      // Determine active heading based on viewport position
      // Find the heading closest to the top of viewport (with 120px offset for sticky navbar)
      const headingElements = headings
        .map((h) => ({ id: h.id, el: document.getElementById(h.id) }))
        .filter((item): item is { id: string; el: HTMLElement } => item.el !== null);

      if (headingElements.length === 0) return;

      const offsetTop = 130;
      let currentActive = headingElements[0].id;

      for (const item of headingElements) {
        const rect = item.el.getBoundingClientRect();
        if (rect.top <= offsetTop) {
          currentActive = item.id;
        } else {
          break;
        }
      }

      setActiveId(currentActive);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial run

    return () => window.removeEventListener("scroll", handleScroll);
  }, [headings]);

  const scrollToHeading = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;

    isClickingRef.current = true;
    setActiveId(id);

    // Scroll smoothly to heading (scroll-margin-top takes care of navbar offset)
    el.scrollIntoView({ behavior: "smooth", block: "start" });

    if (window.history.pushState) {
      window.history.pushState(null, "", `#${id}`);
    }

    // Release click lock after smooth scroll animation completes
    setTimeout(() => {
      isClickingRef.current = false;
    }, 700);

    // On mobile, collapse after selection
    if (mobileExpanded) {
      setMobileExpanded(false);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!headings || headings.length === 0) {
    return null;
  }

  // Mobile Collapsible Bar View
  if (isMobileOnly) {
    return (
      <div className={`mb-8 border border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/40 rounded-2xl p-4 shadow-sm ${className}`}>
        <button
          type="button"
          onClick={() => setMobileExpanded(!mobileExpanded)}
          className="w-full flex items-center justify-between text-left focus:outline-none"
          aria-expanded={mobileExpanded}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[18px]">toc</span>
            </div>
            <div>
              <p className="text-xs font-black text-slate-900 uppercase tracking-wider">{title}</p>
              <p className="text-[11px] text-slate-500 font-medium">
                {headings.length} {headings.length === 1 ? "section" : "sections"} • {readingProgress}% read
              </p>
            </div>
          </div>
          <span
            className={`material-symbols-outlined text-slate-400 transition-transform duration-200 ${
              mobileExpanded ? "rotate-180 text-indigo-600" : ""
            }`}
          >
            expand_more
          </span>
        </button>

        {/* Reading progress strip on mobile */}
        <div className="w-full bg-slate-100 rounded-full h-1 mt-3 overflow-hidden">
          <div
            className="bg-gradient-to-r from-indigo-500 to-purple-600 h-full rounded-full transition-all duration-150"
            style={{ width: `${readingProgress}%` }}
          />
        </div>

        {mobileExpanded && (
          <nav className="mt-4 pt-3 border-t border-indigo-100/80 space-y-1 max-h-72 overflow-y-auto pr-1">
            {headings.map((h, idx) => {
              const isActive = activeId === h.id;
              const indent = h.level >= 3 ? "pl-5 text-[11px]" : "pl-2 text-xs";

              return (
                <button
                  key={`${h.id}-${idx}`}
                  type="button"
                  onClick={() => scrollToHeading(h.id)}
                  className={`w-full text-left py-1.5 px-2 rounded-lg transition-all flex items-center gap-2 ${indent} ${
                    isActive
                      ? "bg-indigo-600 text-white font-bold shadow-xs"
                      : "text-slate-700 hover:text-indigo-600 hover:bg-white font-medium"
                  }`}
                >
                  <span className={`text-[10px] font-mono shrink-0 ${isActive ? "text-indigo-200" : "text-slate-400"}`}>
                    {idx + 1}.
                  </span>
                  <span className="truncate">{h.text}</span>
                </button>
              );
            })}
          </nav>
        )}
      </div>
    );
  }

  // Desktop Side Sticky Card View
  return (
    <div
      className={`bg-white/95 backdrop-blur-md rounded-3xl border border-slate-200/90 shadow-sm p-6 space-y-5 ${className}`}
    >
      {/* Header with Title and Section Counter */}
      <div className="pb-4 border-b border-slate-100">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[18px]">toc</span>
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">{title}</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Quick Navigation
              </p>
            </div>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-100/80">
            {headings.length} {headings.length === 1 ? "Section" : "Sections"}
          </span>
        </div>

        {/* Reading Progress Indicator */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">
            <span>Reading Progress</span>
            <span className="text-indigo-600">{readingProgress}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-full rounded-full transition-all duration-150"
              style={{ width: `${readingProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Navigable Headings List */}
      <nav
        aria-label="Table of contents"
        className="space-y-1 max-h-[calc(100vh-22rem)] overflow-y-auto pr-1 text-slate-600 custom-scrollbar"
      >
        {headings.map((h, idx) => {
          const isActive = activeId === h.id;
          const isSub = h.level >= 3;

          return (
            <button
              key={`${h.id}-${idx}`}
              type="button"
              onClick={() => scrollToHeading(h.id)}
              className={`w-full text-left py-1.5 px-3 rounded-xl transition-all flex items-start gap-2.5 group cursor-pointer ${
                isSub ? "ml-3 text-[11px]" : "text-xs font-semibold"
              } ${
                isActive
                  ? "bg-indigo-50/90 text-indigo-700 font-bold border-l-3 border-indigo-600 shadow-2xs"
                  : "hover:bg-slate-50 hover:text-indigo-600 text-slate-700 font-medium"
              }`}
              title={h.text}
            >
              <span
                className={`text-[10px] font-mono shrink-0 mt-0.5 ${
                  isActive ? "text-indigo-600 font-black" : "text-slate-400 group-hover:text-indigo-500"
                }`}
              >
                {idx + 1}.
              </span>
              <span className="leading-snug line-clamp-2">{h.text}</span>
            </button>
          );
        })}
      </nav>

      {/* Helpful Quick Assistance Card inside Sticky Sidebar */}
      <div className="pt-4 border-t border-slate-100 space-y-3">
        <div className="p-3.5 bg-gradient-to-br from-indigo-50/80 to-purple-50/40 border border-indigo-100/80 rounded-2xl">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="material-symbols-outlined text-indigo-600 text-[18px]">school</span>
            <span className="text-[11px] font-black text-indigo-950 uppercase tracking-wider">
              Education Loan Desk
            </span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed mb-3">
            Compare education loan sanction offers from 5+ top banks and NBFCs with free doorstep service.
          </p>
          <a
            href="/apply-loan"
            className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs shadow-indigo-600/20"
          >
            <span>Check Eligibility Free</span>
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </a>
        </div>

        {/* Back to Top Smooth Button */}
        <button
          type="button"
          onClick={scrollToTop}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-all"
        >
          <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
          <span>Back to Top</span>
        </button>
      </div>
    </div>
  );
}

