"use client";

import React, { useCallback } from "react";

interface SkipLinkProps {
  targetId?: string;
  label?: string;
}

export default function SkipLink({
  targetId = "main-content",
  label = "Skip to main content",
}: SkipLinkProps) {
  const handleSkip = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement> | React.KeyboardEvent<HTMLAnchorElement>) => {
      // Find the main target by ID or fallback to <main>
      const target =
        document.getElementById(targetId) ||
        document.querySelector("main") ||
        document.querySelector("[role='main']");

      if (target) {
        // Prevent default hash jump if custom smooth scroll is handled
        e.preventDefault();

        // Ensure target is focusable
        if (!target.hasAttribute("tabindex")) {
          target.setAttribute("tabindex", "-1");
        }

        // Programmatically shift focus to the main content landmark
        (target as HTMLElement).focus({ preventScroll: true });

        // Scroll smoothly to top of main content
        target.scrollIntoView({ behavior: "smooth", block: "start" });

        // Update URL hash cleanly without scroll jump
        if (typeof window !== "undefined" && window.history.pushState) {
          window.history.pushState(null, "", `#${targetId}`);
        }
      }
    },
    [targetId]
  );

  return (
    <a
      href={`#${targetId}`}
      onClick={handleSkip}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          handleSkip(e);
        }
      }}
      className="skip-to-content sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[99999] focus:px-5 focus:py-3 focus:bg-[#6605c7] focus:text-white focus:font-bold focus:text-sm focus:rounded-xl focus:shadow-[0_10px_30px_rgba(102,5,199,0.4)] focus:ring-4 focus:ring-purple-300 focus:outline-none focus:ring-offset-2 transition-all cursor-pointer"
      aria-label={label}
    >
      <span className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
          arrow_downward
        </span>
        {label}
      </span>
    </a>
  );
}
