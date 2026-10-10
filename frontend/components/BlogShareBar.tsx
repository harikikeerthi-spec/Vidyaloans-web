"use client";

import { useState } from "react";

interface BlogShareBarProps {
  title: string;
  url: string;
}

export default function BlogShareBar({ title, url }: BlogShareBarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  return (
    <div className="flex items-center gap-2 pt-6 border-t border-slate-100 mt-12 flex-wrap">
      <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 mr-2">
        Share Article:
      </span>

      {/* Copy Link */}
      <button
        type="button"
        onClick={handleCopy}
        className="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-indigo-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
        title="Copy link to clipboard"
      >
        <span className="material-symbols-outlined text-[16px] text-slate-500">
          {copied ? "check" : "link"}
        </span>
        <span>{copied ? "Copied!" : "Copy Link"}</span>
      </button>

      {/* WhatsApp */}
      <a
        href={`https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-all flex items-center gap-1.5"
      >
        <span className="material-symbols-outlined text-[16px] text-emerald-600">chat</span>
        <span>WhatsApp</span>
      </a>

      {/* X (Twitter) */}
      <a
        href={`https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold transition-all flex items-center gap-1.5"
      >
        <span>𝕏 Post</span>
      </a>

      {/* LinkedIn */}
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold transition-all flex items-center gap-1.5"
      >
        <span>LinkedIn</span>
      </a>
    </div>
  );
}
