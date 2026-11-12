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
  readTime?: number | string;
  category?: string;
}

export default function BlogTableOfContents({
  headings,
  title = "Table of Contents",
  className = "",
  isMobileOnly = false,
  readTime,
  category,
}: BlogTableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>("");
  const [readingProgress, setReadingProgress] = useState<number>(0);
  const [mobileExpanded, setMobileExpanded] = useState<boolean>(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);
  const [showFloatingButton, setShowFloatingButton] = useState<boolean>(false);
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
      const scrollY = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        const pct = Math.min(100, Math.max(0, Math.round((scrollY / docHeight) * 100)));
        setReadingProgress(pct);
      }

      // Show floating mobile jump button after user scrolls down 300px
      setShowFloatingButton(scrollY > 300);

      // If user recently clicked a TOC item, let the smooth scroll finish before re-evaluating
      if (isClickingRef.current) return;

      // Determine active heading based on viewport position
      const headingElements = headings
        .map((h) => ({ id: h.id, el: document.getElementById(h.id) }))
        .filter((item): item is { id: string; el: HTMLElement } => item.el !== null);

      if (headingElements.length === 0) return;

      const offsetTop = 140;
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

    // Scroll smoothly to heading
    el.scrollIntoView({ behavior: "smooth", block: "start" });

    if (window.history.pushState) {
      window.history.pushState(null, "", `#${id}`);
    }

    // Release click lock after smooth scroll animation completes
    setTimeout(() => {
      isClickingRef.current = false;
    }, 700);

    // Close mobile menus after selection
    if (mobileExpanded) setMobileExpanded(false);
    if (mobileDrawerOpen) setMobileDrawerOpen(false);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!headings || headings.length === 0) {
    return null;
  }

  // Mobile Top Collapsible View
  if (isMobileOnly) {
    return (
      <>
        <div className={`mb-8 border border-indigo-100 bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/50 rounded-2xl p-4 shadow-sm ${className}`}>
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
                  {headings.length} {headings.length === 1 ? "section" : "sections"} {readTime ? `• ${readTime} min read` : ""} • {readingProgress}% read
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
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-indigo-500 to-purple-600 h-full rounded-full transition-all duration-150"
              style={{ width: `${readingProgress}%` }}
            />
          </div>

          {mobileExpanded && (
            <nav className="mt-4 pt-3 border-t border-indigo-100/80 space-y-1 max-h-80 overflow-y-auto pr-1">
              {headings.map((h, idx) => {
                const isActive = activeId === h.id;
                const indent = h.level >= 3 ? "pl-5 text-[11px]" : "pl-2 text-xs";

                return (
                  <button
                    key={`${h.id}-${idx}`}
                    type="button"
                    onClick={() => scrollToHeading(h.id)}
                    className={`w-full text-left py-2 px-2.5 rounded-xl transition-all flex items-center gap-2.5 ${indent} ${
                      isActive
                        ? "bg-indigo-600 text-white font-bold shadow-xs"
                        : "text-slate-700 hover:text-indigo-600 hover:bg-white font-medium"
                    }`}
                  >
                    <span className={`text-[10px] font-mono shrink-0 font-bold ${isActive ? "text-indigo-200" : "text-slate-400"}`}>
                      {String(idx + 1).padStart(2, "0")}.
                    </span>
                    <span className="truncate">{h.text}</span>
                  </button>
                );
              })}
            </nav>
          )}
        </div>

        {/* Mobile Floating TOC Button (Appears as user scrolls) */}
        {showFloatingButton && (
          <div className="fixed bottom-6 right-5 z-40 lg:hidden animate-fade-in">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-900/95 backdrop-blur-md text-white rounded-full shadow-2xl border border-white/20 text-xs font-bold hover:bg-black active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[16px] text-indigo-400">toc</span>
              <span>Table of Contents</span>
              <span className="px-1.5 py-0.5 rounded-md bg-indigo-600 text-[10px] font-mono">
                {readingProgress}%
              </span>
            </button>
          </div>
        )}

        {/* Mobile Slide-Up Drawer */}
        {mobileDrawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end">
            <div
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-fade-in"
              onClick={() => setMobileDrawerOpen(false)}
            />
            <div className="relative z-10 bg-white rounded-t-3xl max-h-[80vh] flex flex-col p-6 shadow-2xl border-t border-slate-100 animate-slide-up">
              <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-4" />

              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                    <span className="material-symbols-outlined text-[16px]">toc</span>
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">{title}</h3>
                    <p className="text-[10px] text-slate-400 font-semibold">
                      {headings.length} Topics • {readingProgress}% read
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>

              <nav className="overflow-y-auto space-y-1.5 pr-1 py-1">
                {headings.map((h, idx) => {
                  const isActive = activeId === h.id;
                  const isSub = h.level >= 3;

                  return (
                    <button
                      key={`mob-drawer-${h.id}-${idx}`}
                      type="button"
                      onClick={() => scrollToHeading(h.id)}
                      className={`w-full text-left py-2 px-3 rounded-xl transition-all flex items-start gap-2.5 ${
                        isSub ? "ml-3 text-[11px]" : "text-xs font-semibold"
                      } ${
                        isActive
                          ? "bg-indigo-600 text-white font-bold shadow-xs"
                          : "hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <span className={`text-[10px] font-mono shrink-0 mt-0.5 ${isActive ? "text-indigo-200" : "text-slate-400"}`}>
                        {String(idx + 1).padStart(2, "0")}.
                      </span>
                      <span className="line-clamp-2 leading-snug">{h.text}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="pt-3 border-t border-slate-100 mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={scrollToTop}
                  className="flex-1 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">arrow_upward</span>
                  <span>Top of Page</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Desktop Side Fixed/Sticky Card View
  return (
    <>
      {/* Sleek Top-of-Viewport Fixed Reading Progress Bar */}
      <div
        className="fixed top-0 left-0 right-0 h-1 z-[60] bg-transparent pointer-events-none"
        aria-hidden="true"
      >
        <div
          className="h-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 transition-[width] duration-150 ease-out shadow-xs"
          style={{ width: `${readingProgress}%` }}
        />
      </div>

      <div
        className={`bg-white/95 backdrop-blur-md rounded-3xl border border-slate-200/90 shadow-md p-6 max-h-[calc(100vh-8.5rem)] flex flex-col ${className}`}
      >
        {/* Header with Title and Section Counter */}
        <div className="shrink-0 pb-3 border-b border-slate-100">
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
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-100/80">
              {headings.length} {headings.length === 1 ? "Topic" : "Topics"}
            </span>
          </div>

          {/* Reading Progress Indicator */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">
              <span>Reading Progress</span>
              <span className="text-indigo-600 font-mono font-black">{readingProgress}%</span>
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
          className="flex-1 min-h-0 overflow-y-auto pr-1 my-3 space-y-1 text-slate-600 custom-scrollbar"
        >
          {headings.map((h, idx) => {
            const isActive = activeId === h.id;
            const isSub = h.level >= 3;

            return (
              <button
                key={`${h.id}-${idx}`}
                type="button"
                onClick={() => scrollToHeading(h.id)}
                className={`w-full text-left py-2 px-3 rounded-xl transition-all flex items-start gap-2.5 group cursor-pointer ${
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
                  {String(idx + 1).padStart(2, "0")}.
                </span>
                <span className="leading-snug line-clamp-2">{h.text}</span>
              </button>
            );
          })}
        </nav>

        {/* Helpful Quick Assistance Card inside Sticky Sidebar */}
        <div className="shrink-0 pt-3 border-t border-slate-100 space-y-3">
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
    </>
  );
}
