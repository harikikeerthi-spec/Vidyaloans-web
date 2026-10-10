"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { blogApi } from "@/lib/api";

export type BlockType =
  | "heading"
  | "text"
  | "image"
  | "split_content"
  | "table"
  | "table_of_contents"
  | "quote"
  | "alert"
  | "list"
  | "video"
  | "button"
  | "code"
  | "tags"
  | "divider"
  | "spacer";

export interface SplitConfig {
  layoutType: "image_text" | "text_text" | "text_image" | "text_form" | "form_text";
  ratio?: "50_50" | "40_60" | "60_40" | "33_67";
  verticalAlign?: "top" | "center" | "bottom";
  cardStyle?: "clean" | "card" | "gradient" | "bordered";
  leftTitle?: string;
  leftContent?: string;
  leftImageUrl?: string;
  leftImageCaption?: string;
  leftImageAlt?: string;
  leftItems?: string[];
  rightTitle?: string;
  rightContent?: string;
  rightImageUrl?: string;
  rightImageCaption?: string;
  rightImageAlt?: string;
  rightItems?: string[];
  buttonText?: string;
  buttonUrl?: string;
  buttonNewTab?: boolean;
  // Lead Registration Form Fields
  formTitle?: string;
  formSubtitle?: string;
  formButtonText?: string;
  formRedirectUrl?: string;
  formSource?: string;
}

export interface TableData {
  headers: string[];
  rows: string[][];
  hasHeader: boolean;
  isStriped: boolean;
}

export interface Block {
  id: string;
  type: BlockType;
  content: string;
  title?: string;
  subtitle?: string;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  listType?: "ordered" | "unordered";
  items?: { id: string; title: string }[];
  alertTone?: "info" | "tip" | "warning" | "alert";
  splitConfig?: SplitConfig;
  tableData?: TableData;
  caption?: string;
  authorCitation?: string;
  buttonText?: string;
  buttonUrl?: string;
  buttonNewTab?: boolean;
  codeLanguage?: string;
  style?: {
    textAlign?: "left" | "center" | "right";
    fontSize?: string;
    fontFamily?: string;
    fontWeight?: string;
    color?: string;
    backgroundColor?: string;
    padding?: string;
    borderRadius?: string;
  };
}

interface DynamicBlogEditorProps {
  initialBlog?: any;
  onBack: () => void;
  onSaved: (blog: any) => void;
  currentUser?: any;
}

const CATEGORIES = [
  "Loan Guidance",
  "Bank Reviews",
  "Student Life",
  "Visa & Admissions",
  "Interest Rates",
  "Global Universities",
  "Financial Tips",
];

const SUGGESTED_TAGS = [
  "EducationLoan",
  "StudyAbroad",
  "UnsecuredLoan",
  "BankComparison",
  "LowInterestRate",
  "USALoan",
  "UKAdmissions",
  "GermanyStudy",
  "MoratoriumPeriod",
  "80EDeduction",
  "FastApproval",
];

const CURATED_COVERS = [
  {
    label: "Global Campus",
    url: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=80",
  },
  {
    label: "University Library",
    url: "https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?auto=format&fit=crop&w=1200&q=80",
  },
  {
    label: "Graduation Success",
    url: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1200&q=80",
  },
  {
    label: "Financial Analytics",
    url: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80",
  },
  {
    label: "Modern Campus Life",
    url: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=1200&q=80",
  },
];

const HIGHLIGHT_COLORS = [
  { name: "Yellow", bg: "#fef08a", text: "#854d0e" },
  { name: "Mint", bg: "#bbf7d0", text: "#14532d" },
  { name: "Sky", bg: "#bae6fd", text: "#0369a1" },
  { name: "Pink", bg: "#fbcfe8", text: "#9d174d" },
  { name: "Purple", bg: "#e9d5ff", text: "#6b21a8" },
  { name: "Amber", bg: "#fed7aa", text: "#9a3412" },
];

/**
 * Strips pasted black/dark background colors, external dark-theme styling,
 * white/light text overrides, and messy layouts while preserving semantic content (bold, links, lists, etc.)
 */
export const cleanHtmlContent = (rawHtml: string): string => {
  if (!rawHtml || typeof rawHtml !== "string") return "";

  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return rawHtml
      .replace(/background(-color)?\s*:\s*[^;"]+;?/gi, "")
      .replace(/bgcolor\s*=\s*["'][^"']*["']/gi, "");
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, "text/html");

    // Remove non-content / dangerous elements
    const toRemove = doc.querySelectorAll(
      "script, style, meta, link, iframe, object, embed, noscript"
    );
    toRemove.forEach((el) => el.remove());

    // Recursively clean all elements
    const allElements = doc.body.querySelectorAll("*");
    allElements.forEach((node) => {
      const el = node as HTMLElement;

      // Remove legacy background attributes
      el.removeAttribute("bgcolor");
      el.removeAttribute("background");
      el.removeAttribute("face");

      // Filter out external dark mode / background utility classes
      if (el.className && typeof el.className === "string") {
        const kept = el.className
          .split(/\s+/)
          .filter((cls) => {
            const lc = cls.toLowerCase();
            return (
              !lc.includes("dark") &&
              !lc.includes("theme") &&
              !lc.includes("bg-") &&
              !lc.includes("black") &&
              !lc.includes("night")
            );
          });
        if (kept.length > 0) {
          el.className = kept.join(" ");
        } else {
          el.removeAttribute("class");
        }
      }

      // Clean inline styles
      if (el.style) {
        const tagName = el.tagName.toLowerCase();

        // 1. Strip background colors unless it is our explicit highlight <mark>
        if (tagName !== "mark") {
          el.style.backgroundColor = "";
          el.style.background = "";
          el.style.backgroundImage = "";
        }

        // 2. Clean text color only if it is invisible white or near-white (from copied dark theme pages)
        const color = el.style.color?.toLowerCase().trim() || "";
        let isLightOrWhite = false;
        if (
          color === "white" ||
          color === "#fff" ||
          color === "#ffffff" ||
          color === "#fafafa" ||
          color === "#f8f9fa" ||
          color === "#f3f4f6" ||
          color === "#e5e7eb" ||
          color === "#e2e8f0"
        ) {
          isLightOrWhite = true;
        } else if (color.startsWith("rgb(") || color.startsWith("rgba(")) {
          const nums = color.match(/\d+/g);
          if (nums && nums.length >= 3) {
            const r = parseInt(nums[0], 10);
            const g = parseInt(nums[1], 10);
            const b = parseInt(nums[2], 10);
            if (r > 230 && g > 230 && b > 230) {
              isLightOrWhite = true;
            }
          }
        }

        if (isLightOrWhite) {
          el.style.color = "";
        }

        // 3. Strip rigid layout styles copied from web pages, but preserve font styling (fontSize, fontFamily, fontWeight)
        el.style.width = "";
        el.style.height = "";
        el.style.maxWidth = "";
        el.style.minWidth = "";
        el.style.position = "";
        el.style.boxShadow = "";
        el.style.textShadow = "";
        el.style.border = "";
        el.style.borderColor = "";

        if (!el.getAttribute("style") || el.getAttribute("style")?.trim() === "") {
          el.removeAttribute("style");
        }
      }
    });

    return doc.body.innerHTML;
  } catch (err) {
    console.error("Error cleaning HTML:", err);
    return rawHtml;
  }
};

export const TEXT_COLORS = [
  { name: "Default", color: "#1e293b", bg: "#1e293b" },
  { name: "Indigo", color: "#4f46e5", bg: "#4f46e5" },
  { name: "Blue", color: "#0284c7", bg: "#0284c7" },
  { name: "Emerald", color: "#059669", bg: "#059669" },
  { name: "Amber", color: "#d97706", bg: "#d97706" },
  { name: "Rose", color: "#e11d48", bg: "#e11d48" },
  { name: "Purple", color: "#7c3aed", bg: "#7c3aed" },
  { name: "Slate", color: "#64748b", bg: "#64748b" },
];

export const FONT_SIZES = [
  { label: "13px (Small)", value: "13px" },
  { label: "16px (Normal)", value: "16px" },
  { label: "18px (Medium)", value: "18px" },
  { label: "22px (Large)", value: "22px" },
  { label: "26px (Heading)", value: "26px" },
];

export const FONT_FAMILIES = [
  { label: "Modern Sans", value: "Inter, system-ui, -apple-system, sans-serif" },
  { label: "Classic Serif", value: "Georgia, Cambria, 'Times New Roman', serif" },
  { label: "Code Monospace", value: "ui-monospace, Menlo, Monaco, Consolas, monospace" },
  { label: "Display Outfit", value: "'Outfit', system-ui, sans-serif" },
];

export const FORMAT_PRESETS = [
  { label: "Normal Paragraph", value: "p", tag: "p" },
  { label: "Lead Paragraph", value: "lead", tag: "lead" },
  { label: "Heading 2", value: "h2", tag: "h2" },
  { label: "Heading 3", value: "h3", tag: "h3" },
  { label: "Heading 4", value: "h4", tag: "h4" },
  { label: "Blockquote", value: "blockquote", tag: "blockquote" },
];

/**
 * Rich text editable block component.
 * Maintains DOM content without re-rendering dangerouslySetInnerHTML on every input,
 * preventing cursor jumps to line start and preserving full cursor and selection integrity.
 */
export const RichTextBlock = React.memo(function RichTextBlock({
  block,
  onUpdateContent,
  onPaste,
  registerRef,
  onSaveSelection,
}: {
  block: Block;
  onUpdateContent: (content: string) => void;
  onPaste: (e: React.ClipboardEvent<HTMLDivElement>) => void;
  registerRef: (el: HTMLDivElement | null) => void;
  onSaveSelection: () => void;
}) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const lastContentRef = useRef(block.content || "");

  // Initialize innerHTML once on mount
  useEffect(() => {
    if (elRef.current) {
      elRef.current.innerHTML = block.content || "";
      lastContentRef.current = block.content || "";
    }
  }, []);

  // Update innerHTML when block.content changes externally (e.g. clean format, preset, draft restore)
  useEffect(() => {
    if (elRef.current) {
      if (block.content !== lastContentRef.current && elRef.current.innerHTML !== block.content) {
        elRef.current.innerHTML = block.content || "";
        lastContentRef.current = block.content || "";
      }
    }
  }, [block.content]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const html = e.currentTarget.innerHTML;
    lastContentRef.current = html;
    onUpdateContent(html);
  };

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    const html = e.currentTarget.innerHTML;
    lastContentRef.current = html;
    onUpdateContent(html);
    onSaveSelection();
  };

  return (
    <div
      ref={(el) => {
        elRef.current = el;
        registerRef(el);
      }}
      contentEditable
      suppressContentEditableWarning
      onPaste={onPaste}
      onInput={handleInput}
      onBlur={handleBlur}
      onKeyUp={onSaveSelection}
      onMouseUp={onSaveSelection}
      style={{
        fontSize: block.style?.fontSize,
        fontFamily: block.style?.fontFamily,
        textAlign: block.style?.textAlign,
        color: block.style?.color,
      }}
      className="min-h-[80px] text-base leading-relaxed text-slate-800 focus:outline-none p-3.5 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-white transition-all shadow-2xs [&_*[style*='255, 255, 255']]:!text-slate-800 [&_*[style*='255,255,255']]:!text-slate-800 [&_*[style*='#ffffff']]:!text-slate-800 [&_*[style*='#fff']]:!text-slate-800"
    />
  );
});

export default function DynamicBlogEditor({
  initialBlog,
  onBack,
  onSaved,
  currentUser,
}: DynamicBlogEditorProps) {
  // Editorial post meta
  const [title, setTitle] = useState(initialBlog?.title || "");
  const [slug, setSlug] = useState(initialBlog?.slug || "");
  const [subtitle, setSubtitle] = useState(
    initialBlog?.subtitle || initialBlog?.excerpt || ""
  );
  const [category, setCategory] = useState(
    initialBlog?.category || "Loan Guidance"
  );
  const [coverImage, setCoverImage] = useState(
    initialBlog?.coverImage || initialBlog?.featuredImage || CURATED_COVERS[0].url
  );
  const [tags, setTags] = useState<string[]>(
    Array.isArray(initialBlog?.tags)
      ? initialBlog.tags.map((t: any) =>
        typeof t === "string" ? t : t?.name || ""
      )
      : ["EducationLoan", "StudyAbroad", "FintechGuidance"]
  );
  const [newTagInput, setNewTagInput] = useState("");
  const [authorName, setAuthorName] = useState(
    initialBlog?.authorName ||
    (currentUser?.firstName
      ? `${currentUser.firstName} ${currentUser.lastName || ""}`.trim()
      : "VidyaLoan Editorial Desk")
  );

  // Content blocks
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  // UI state
  const [viewMode, setViewMode] = useState<"edit" | "split" | "preview" | "mobile">("edit");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>("Draft");
  const [lastSavedTime, setLastSavedTime] = useState<string>("Just now");
  const [activeHighlightBlockId, setActiveHighlightBlockId] = useState<string | null>(null);
  const [activeColorBlockId, setActiveColorBlockId] = useState<string | null>(null);
  const [activeFontSizeBlockId, setActiveFontSizeBlockId] = useState<string | null>(null);
  const [activeFontFamilyBlockId, setActiveFontFamilyBlockId] = useState<string | null>(null);
  const [activeFormatBlockId, setActiveFormatBlockId] = useState<string | null>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const editorRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [showSeoPreview, setShowSeoPreview] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [inserterOpenIndex, setInserterOpenIndex] = useState<number | null>(null);

  // Hyperlink modal
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkModalBlockId, setLinkModalBlockId] = useState<string | null>(null);
  const [linkModalUrl, setLinkModalUrl] = useState("https://");
  const [linkModalText, setLinkModalText] = useState("");
  const [linkModalNewTab, setLinkModalNewTab] = useState(true);

  // SEO & Social Distribution Meta state
  const initialSeoData = useMemo(() => {
    if (!initialBlog?.content) return null;
    const match = initialBlog.content.match(
      /<!--SEO_JSON_START-->([\s\S]*?)<!--SEO_JSON_END-->/
    );
    if (match && match[1]) {
      try {
        return JSON.parse(match[1]);
      } catch (_) {
        return null;
      }
    }
    return null;
  }, [initialBlog?.content]);

  const [metaTitle, setMetaTitle] = useState(
    initialBlog?.metaTitle || initialSeoData?.metaTitle || ""
  );
  const [metaDescription, setMetaDescription] = useState(
    initialBlog?.metaDescription || initialSeoData?.metaDescription || ""
  );
  const [focusKeyword, setFocusKeyword] = useState(
    initialBlog?.focusKeyword || initialSeoData?.focusKeyword || ""
  );
  const [canonicalUrl, setCanonicalUrl] = useState(
    initialBlog?.canonicalUrl || initialSeoData?.canonicalUrl || ""
  );
  const [noIndex, setNoIndex] = useState<boolean>(
    Boolean(initialBlog?.noIndex ?? initialSeoData?.noIndex ?? false)
  );
  const [seoTab, setSeoTab] = useState<"fields" | "checklist" | "preview">("fields");
  const [serpDevice, setSerpDevice] = useState<"desktop" | "mobile">("desktop");

  // Format date helper
  const nowFormattedDate = new Date().toLocaleDateString("en-IN", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const nowFormattedTime = new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Calculate live word count and reading time
  const calculateWordCount = useCallback(() => {
    let text = `${title} ${subtitle} `;
    blocks.forEach((b) => {
      text += `${b.content || ""} ${b.title || ""} `;
      if (b.splitConfig) {
        text += `${b.splitConfig.leftTitle || ""} ${b.splitConfig.leftContent || ""} `;
        text += `${b.splitConfig.rightTitle || ""} ${b.splitConfig.rightContent || ""} `;
        text += `${b.splitConfig.formTitle || ""} ${b.splitConfig.formSubtitle || ""} `;
      }
      if (b.items) {
        text += b.items.map((i) => i.title).join(" ") + " ";
      }
      if (b.tableData) {
        text += b.tableData.headers.join(" ") + " ";
        text += b.tableData.rows.flat().join(" ") + " ";
      }
    });
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return words;
  }, [title, subtitle, blocks]);

  const wordCount = calculateWordCount();
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  // Real-time SEO Analyzer
  const seoAnalysis = useMemo(() => {
    const effectiveTitle = (metaTitle.trim() || title.trim());
    const effectiveDesc = (metaDescription.trim() || subtitle.trim());
    const kw = focusKeyword.trim().toLowerCase();
    const effectiveSlug = (slug.trim() || title.toLowerCase().replace(/[^a-z0-9]+/g, "-")).toLowerCase();

    // Plain text content of all blocks
    let bodyText = "";
    let hasH2 = false;
    blocks.forEach((b) => {
      if (b.type === "heading" && (b.level === 2 || !b.level)) hasH2 = true;
      bodyText += " " + (b.content || "").replace(/<[^>]*>/g, " ");
      if (b.splitConfig) {
        bodyText += " " + (b.splitConfig.leftContent || "") + " " + (b.splitConfig.rightContent || "") + " " + (b.splitConfig.formTitle || "") + " " + (b.splitConfig.formSubtitle || "");
      }
    });

    const bodyLower = bodyText.toLowerCase();
    const kwCount = kw ? (bodyLower.match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")) || []).length : 0;

    const checklist: Array<{
      id: string;
      label: string;
      status: "pass" | "warn" | "fail";
      message: string;
      weight: number;
    }> = [];

    // 1. Meta Title Length
    if (effectiveTitle.length >= 40 && effectiveTitle.length <= 65) {
      checklist.push({
        id: "title-length",
        label: "Title Length",
        status: "pass",
        message: `Optimal length (${effectiveTitle.length}/65 characters). Displays fully on Google.`,
        weight: 15,
      });
    } else if (effectiveTitle.length > 65) {
      checklist.push({
        id: "title-length",
        label: "Title Length",
        status: "warn",
        message: `Too long (${effectiveTitle.length} chars). Google may truncate titles over 65 chars.`,
        weight: 8,
      });
    } else if (effectiveTitle.length > 0) {
      checklist.push({
        id: "title-length",
        label: "Title Length",
        status: "warn",
        message: `Too short (${effectiveTitle.length} chars). Aim for 40-65 chars for higher CTR.`,
        weight: 8,
      });
    } else {
      checklist.push({
        id: "title-length",
        label: "Title Length",
        status: "fail",
        message: "No article headline or meta title provided.",
        weight: 0,
      });
    }

    // 2. Meta Description Length
    if (effectiveDesc.length >= 120 && effectiveDesc.length <= 160) {
      checklist.push({
        id: "desc-length",
        label: "Meta Description Length",
        status: "pass",
        message: `Optimal length (${effectiveDesc.length}/160 characters).`,
        weight: 15,
      });
    } else if (effectiveDesc.length > 160) {
      checklist.push({
        id: "desc-length",
        label: "Meta Description Length",
        status: "warn",
        message: `Too long (${effectiveDesc.length} chars). Google may truncate descriptions over 160 chars.`,
        weight: 8,
      });
    } else if (effectiveDesc.length > 0) {
      checklist.push({
        id: "desc-length",
        label: "Meta Description Length",
        status: "warn",
        message: `Too short (${effectiveDesc.length} chars). Aim for 120-160 chars for best SERP snippet.`,
        weight: 8,
      });
    } else {
      checklist.push({
        id: "desc-length",
        label: "Meta Description Length",
        status: "fail",
        message: "No meta description or subtitle provided.",
        weight: 0,
      });
    }

    // 3. Focus Keyword Defined
    if (kw) {
      checklist.push({
        id: "kw-defined",
        label: "Focus Keyword Defined",
        status: "pass",
        message: `Focus keyword: "${focusKeyword}"`,
        weight: 10,
      });

      // 4. Keyword in Title
      if (effectiveTitle.toLowerCase().includes(kw)) {
        checklist.push({
          id: "kw-title",
          label: "Keyword in Title",
          status: "pass",
          message: `Focus keyword found in title.`,
          weight: 15,
        });
      } else {
        checklist.push({
          id: "kw-title",
          label: "Keyword in Title",
          status: "warn",
          message: `Focus keyword is missing from title.`,
          weight: 0,
        });
      }

      // 5. Keyword in Meta Description
      if (effectiveDesc.toLowerCase().includes(kw)) {
        checklist.push({
          id: "kw-desc",
          label: "Keyword in Meta Description",
          status: "pass",
          message: `Focus keyword found in meta description.`,
          weight: 10,
        });
      } else {
        checklist.push({
          id: "kw-desc",
          label: "Keyword in Meta Description",
          status: "warn",
          message: `Focus keyword is missing from meta description.`,
          weight: 0,
        });
      }

      // 6. Keyword in URL Slug
      const kwSlug = kw.replace(/\s+/g, "-");
      if (effectiveSlug.includes(kwSlug) || effectiveSlug.includes(kw.split(" ")[0])) {
        checklist.push({
          id: "kw-slug",
          label: "Keyword in URL Slug",
          status: "pass",
          message: `Focus keyword found in URL slug.`,
          weight: 10,
        });
      } else {
        checklist.push({
          id: "kw-slug",
          label: "Keyword in URL Slug",
          status: "warn",
          message: `Keyword missing from slug. Include target query in URL for ranking boost.`,
          weight: 0,
        });
      }

      // 7. Keyword in Content
      if (kwCount >= 2) {
        checklist.push({
          id: "kw-content",
          label: "Keyword Density in Body",
          status: "pass",
          message: `Found ${kwCount} occurrences in article content.`,
          weight: 10,
        });
      } else if (kwCount === 1) {
        checklist.push({
          id: "kw-content",
          label: "Keyword Density in Body",
          status: "warn",
          message: `Found only 1 occurrence in body. Consider mentioning it in section headings.`,
          weight: 5,
        });
      } else {
        checklist.push({
          id: "kw-content",
          label: "Keyword Density in Body",
          status: "fail",
          message: `Focus keyword not found in article body content.`,
          weight: 0,
        });
      }
    } else {
      checklist.push({
        id: "kw-defined",
        label: "Focus Keyword",
        status: "warn",
        message: `Set a target focus keyword to unlock search query optimization checks.`,
        weight: 0,
      });
    }

    // 8. Word Count / In-Depth Content
    if (wordCount >= 600) {
      checklist.push({
        id: "word-count",
        label: "Content Length",
        status: "pass",
        message: `Comprehensive depth (${wordCount} words). Search engines prioritize detailed guides.`,
        weight: 10,
      });
    } else if (wordCount >= 300) {
      checklist.push({
        id: "word-count",
        label: "Content Length",
        status: "pass",
        message: `Adequate word count (${wordCount} words). Expand towards 600+ words for competitive topics.`,
        weight: 7,
      });
    } else {
      checklist.push({
        id: "word-count",
        label: "Content Length",
        status: "warn",
        message: `Thin content warning (${wordCount} words). Aim for at least 300 words to rank well.`,
        weight: 2,
      });
    }

    // 9. Heading Hierarchy
    if (hasH2) {
      checklist.push({
        id: "h2-structure",
        label: "H2 Section Headings",
        status: "pass",
        message: `Structured with H2 subheadings for reader engagement and Google Featured Snippets.`,
        weight: 5,
      });
    } else {
      checklist.push({
        id: "h2-structure",
        label: "H2 Section Headings",
        status: "warn",
        message: `No H2 headings detected. Add Heading blocks to break content into scannable sections.`,
        weight: 0,
      });
    }

    // 10. Featured Image / Visual Assets
    if (coverImage) {
      checklist.push({
        id: "cover-image",
        label: "Social & Open Graph Visuals",
        status: "pass",
        message: `Cover image configured for Google Discover and Social share cards.`,
        weight: 5,
      });
    } else {
      checklist.push({
        id: "cover-image",
        label: "Social & Open Graph Visuals",
        status: "warn",
        message: `No cover image selected. Articles with images generate 94% more views.`,
        weight: 0,
      });
    }

    // 11. Indexing Status
    if (noIndex) {
      checklist.push({
        id: "noindex-check",
        label: "Search Engine Indexing",
        status: "fail",
        message: `Indexing blocked (noindex enabled). Google will NOT index this article!`,
        weight: 0,
      });
    } else {
      checklist.push({
        id: "noindex-check",
        label: "Search Engine Indexing",
        status: "pass",
        message: `Article is indexable (index, follow enabled).`,
        weight: 5,
      });
    }

    const totalWeight = checklist.reduce((acc, c) => acc + c.weight, 0);
    const score = Math.min(100, Math.round((totalWeight / 100) * 100));

    let rating = "Needs Work";
    if (score >= 80) rating = "Excellent";
    else if (score >= 60) rating = "Good";
    else if (score >= 40) rating = "Fair";

    return {
      score,
      rating,
      checklist,
      effectiveTitle,
      effectiveDesc,
      kwCount,
    };
  }, [metaTitle, title, metaDescription, subtitle, focusKeyword, slug, blocks, wordCount, coverImage, noIndex]);

  // Initialize blocks from initialBlog
  useEffect(() => {
    const sanitizeBlocks = (raw: any[]): Block[] => {
      return raw.map((b) => {
        if (b.type === "text" && b.content) {
          return { ...b, content: cleanHtmlContent(b.content) };
        }
        return b;
      });
    };

    if (initialBlog) {
      if (initialBlog.metaTitle && !metaTitle) setMetaTitle(initialBlog.metaTitle);
      if (initialBlog.metaDescription && !metaDescription) setMetaDescription(initialBlog.metaDescription);
      if (initialBlog.focusKeyword && !focusKeyword) setFocusKeyword(initialBlog.focusKeyword);
      if (initialBlog.canonicalUrl && !canonicalUrl) setCanonicalUrl(initialBlog.canonicalUrl);
      if (typeof initialBlog.noIndex === "boolean") setNoIndex(initialBlog.noIndex);

      if (initialBlog.content) {
        const seoMatch = initialBlog.content.match(
          /<!--SEO_JSON_START-->([\s\S]*?)<!--SEO_JSON_END-->/
        );
        if (seoMatch && seoMatch[1]) {
          try {
            const parsedSeo = JSON.parse(seoMatch[1]);
            if (parsedSeo.metaTitle) setMetaTitle(parsedSeo.metaTitle);
            if (parsedSeo.metaDescription) setMetaDescription(parsedSeo.metaDescription);
            if (parsedSeo.focusKeyword) setFocusKeyword(parsedSeo.focusKeyword);
            if (parsedSeo.canonicalUrl) setCanonicalUrl(parsedSeo.canonicalUrl);
            if (typeof parsedSeo.noIndex === "boolean") setNoIndex(parsedSeo.noIndex);
          } catch (_) { }
        }
      }

      if (Array.isArray(initialBlog.blocks) && initialBlog.blocks.length > 0) {
        setBlocks(sanitizeBlocks(initialBlog.blocks));
        return;
      }
      if (typeof initialBlog.blocks === "string") {
        try {
          const parsed = JSON.parse(initialBlog.blocks);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setBlocks(sanitizeBlocks(parsed));
            return;
          }
        } catch (_) { }
      }
      if (initialBlog.content) {
        // Parse embedded JSON comments or fallback
        const match = initialBlog.content.match(
          /<!--BLOCKS_JSON_START-->([\s\S]*?)<!--BLOCKS_JSON_END-->/
        );
        if (match && match[1]) {
          try {
            const parsed = JSON.parse(match[1]);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setBlocks(sanitizeBlocks(parsed));
              return;
            }
          } catch (_) { }
        } else {
          // If plain HTML content without blocks, wrap into text block
          setBlocks([
            {
              id: "imported-body",
              type: "text",
              content: cleanHtmlContent(initialBlog.content),
            },
          ]);
          return;
        }
      }
    }

    // Default starter blocks for a dynamic journalistic article
    if (blocks.length === 0) {
      setBlocks([
        {
          id: "lead-intro",
          type: "text",
          content:
            "Navigating higher education financing is one of the most critical decisions for aspiring global scholars. With interest concessions and expedited collateral-free sanctions taking center stage, here is what students and parents must know.",
          style: { fontSize: "18px", color: "#1e293b" },
        },
        {
          id: "toc-1",
          type: "table_of_contents",
          content: "In This Comprehensive Guide",
          title: "In This Comprehensive Guide",
        },
        {
          id: "head-1",
          type: "heading",
          level: 2,
          content: "1. Collateral-Free Education Loans: The New Standard",
        },
        {
          id: "split-1",
          type: "split_content",
          content: "",
          splitConfig: {
            layoutType: "image_text",
            ratio: "50_50",
            cardStyle: "clean",
            leftImageUrl:
              "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=800&q=80",
            leftImageCaption: "Campus of Stanford University, California",
            leftImageAlt: "University students walking on campus",
            rightTitle: "Sanctions Up to ₹75 Lakhs Without Property Pledges",
            rightContent:
              "Private lenders and leading NBFCs like HDFC Credila, IDFC FIRST, and Avanse now sanction uncollateralized loans based strictly on student GRE/IELTS scores, target university ranking, and future earning potential.",
            rightItems: [
              "Zero physical asset mortgage required",
              "Covers 100% tuition, living expenses & flight costs",
              "Disbursed directly before visa stamping appointments",
            ],
            buttonText: "Check Your Eligibility",
            buttonUrl: "/apply-loan",
            buttonNewTab: true,
          },
        },
        {
          id: "head-2",
          type: "heading",
          level: 2,
          content: "2. Bank Interest Rate & Sanction Comparison Matrix",
        },
        {
          id: "table-1",
          type: "table",
          content: "Bank Comparison",
          tableData: {
            headers: ["Lender Name", "Max Unsecured", "Floating Rate", "Processing Speed"],
            rows: [
              ["HDFC Credila", "Up to ₹75 Lakhs", "9.75% - 11.25%", "3 - 5 Working Days"],
              ["IDFC FIRST Bank", "Up to ₹50 Lakhs", "9.25% - 10.50%", "48-Hour Fast Track"],
              ["Avanse Financial", "Up to ₹75 Lakhs", "10.25% - 12.00%", "3 Working Days"],
              ["SBI Global Ed-Vantage", "Up to ₹1.5 Cr (Secured)", "8.50% - 9.15%", "10 - 14 Working Days"],
            ],
            hasHeader: true,
            isStriped: true,
          },
        },
        {
          id: "quote-1",
          type: "quote",
          content:
            "A well-structured education loan with moratorium interest relief ensures that financial constraints never stand between a qualified student and their academic aspirations.",
          authorCitation: "VidyaLoan Advisory Board • Delhi Bureau",
        },
        {
          id: "alert-1",
          type: "alert",
          alertTone: "tip",
          title: "Income Tax Benefit under Section 80E",
          content:
            "Did you know? The entire interest paid on education loans is 100% tax deductible under Section 80E of the Indian Income Tax Act for up to 8 continuous assessment years, with no upper monetary cap.",
        },
        {
          id: "cta-1",
          type: "button",
          content: "Get Expert Loan Advisory & 1-on-1 Guidance",
          buttonUrl: "/apply-loan",
          buttonNewTab: true,
        },
      ]);
    }
  }, [initialBlog]);

  // Auto-slug generator from title
  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!initialBlog?.id || !slug) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")
      );
    }
  };

  // Local draft autosave
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          "dynamic_blog_draft_backup",
          JSON.stringify({
            title,
            slug,
            subtitle,
            category,
            coverImage,
            tags,
            authorName,
            blocks,
            savedAt: new Date().toISOString(),
          })
        );
        setSaveStatus("Saved");
        setLastSavedTime(
          new Date().toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        );
      } catch (_) { }
    }, 1500);

    setSaveStatus("Saving...");
    return () => clearTimeout(timer);
  }, [title, slug, subtitle, category, coverImage, tags, authorName, blocks]);

  // Block management functions
  const addBlock = (
    type: BlockType,
    insertIndex?: number,
    customSplitLayout?: "image_text" | "text_image" | "text_text" | "text_form" | "form_text"
  ) => {
    const newId = `block-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    let newBlock: Block;

    switch (type) {
      case "heading":
        newBlock = {
          id: newId,
          type: "heading",
          level: 2,
          content: "Enter Section Headline...",
        };
        break;
      case "text":
        newBlock = {
          id: newId,
          type: "text",
          content:
            "Write your paragraph text here. Highlight any words to apply bold, italic, underline, custom color swatches, or embed URLs.",
        };
        break;
      case "split_content":
        newBlock = {
          id: newId,
          type: "split_content",
          content: "",
          splitConfig: customSplitLayout === "text_form" ? {
            layoutType: "text_form",
            ratio: "50_50",
            cardStyle: "clean",
            leftTitle: "Fast-Track Your Study Abroad Education Loan",
            leftContent:
              "VidyaLoans partners directly with 15+ leading public banks, private NBFCs, and global fintech lenders to guarantee the lowest interest rates with 100% paperless verification.",
            leftItems: [
              "Up to ₹75 Lakhs collateral-free sanctions",
              "Disbursement guaranteed before visa appointment",
              "Zero processing charges & doorstep documentation",
              "Tax exemption benefits under Section 80E",
            ],
            buttonText: "Explore Loan Options",
            buttonUrl: "/apply-loan",
            buttonNewTab: true,
            formTitle: "Quick Loan Assessment & Registration",
            formSubtitle: "Enter student details for immediate eligibility evaluation & dedicated counselor callback.",
            formButtonText: "Register & Check Eligibility",
            formRedirectUrl: "/apply-loan",
            formSource: "blog_split_form",
          } : {
            layoutType: customSplitLayout || "image_text",
            ratio: "50_50",
            cardStyle: "clean",
            leftImageUrl:
              "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=800&q=80",
            leftImageCaption: "International campus academic hall",
            leftImageAlt: "Campus building",
            rightTitle: "Accelerated Admission Funding",
            rightContent:
              "Secure your loan sanction letter before you receive your official I-20 or CAS letter to accelerate visa documentation.",
            rightItems: [
              "100% pre-visa disbursement sanction",
              "Direct wire transfer to foreign universities",
            ],
            buttonText: "Explore Partner Programs",
            buttonUrl: "/apply-loan",
            buttonNewTab: true,
            formTitle: "Quick Loan Assessment & Registration",
            formSubtitle: "Enter student details for immediate eligibility evaluation & dedicated counselor callback.",
            formButtonText: "Register & Check Eligibility",
            formRedirectUrl: "/apply-loan",
            formSource: "blog_split_form",
          },
        };
        break;
      case "table":
        newBlock = {
          id: newId,
          type: "table",
          content: "Data Table",
          tableData: {
            headers: ["Parameter", "Public Sector Banks", "Private NBFCs"],
            rows: [
              ["Max Collateral-Free", "Up to ₹7.5 Lakhs", "Up to ₹75 Lakhs"],
              ["Interest Rate", "8.25% - 9.50%", "9.75% - 11.50%"],
              ["Processing Time", "15 - 25 Days", "3 - 5 Days"],
            ],
            hasHeader: true,
            isStriped: true,
          },
        };
        break;
      case "table_of_contents":
        newBlock = {
          id: newId,
          type: "table_of_contents",
          content: "Table of Contents",
          title: "Table of Contents",
        };
        break;
      case "quote":
        newBlock = {
          id: newId,
          type: "quote",
          content:
            "Education is the most powerful weapon which you can use to change the world.",
          authorCitation: "Nelson Mandela",
        };
        break;
      case "alert":
        newBlock = {
          id: newId,
          type: "alert",
          alertTone: "info",
          title: "Crucial Visa Requirement",
          content:
            "Ensure your loan sanction letter clearly states that the loan is uncollateralized and liquid, which fulfills US F-1 and UK Student visa financial proof criteria.",
        };
        break;
      case "list":
        newBlock = {
          id: newId,
          type: "list",
          listType: "unordered",
          content: "",
          items: [
            { id: "1", title: "Valid Passport and University Offer of Admission" },
            { id: "2", title: "Academic Transcripts, GRE / GMAT / IELTS scorecard" },
            { id: "3", title: "Co-applicant 6-month bank statements and ITR filings" },
          ],
        };
        break;
      case "image":
        newBlock = {
          id: newId,
          type: "image",
          content:
            "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1200&q=80",
          caption: "Students celebrating graduation milestone",
        };
        break;
      case "video":
        newBlock = {
          id: newId,
          type: "video",
          content: "https://www.youtube.com/embed/dQw4w9WgXcQ",
          caption: "Video: Step-by-step education loan guide",
        };
        break;
      case "button":
        newBlock = {
          id: newId,
          type: "button",
          content: "Check Loan Eligibility Free",
          buttonText: "Check Loan Eligibility Free",
          buttonUrl: "/apply-loan",
          buttonNewTab: true,
        };
        break;
      case "code":
        newBlock = {
          id: newId,
          type: "code",
          content: `// Sample EMI Calculation Formula (Reducing Balance)
const P = 5000000; // ₹50 Lakhs
const r = 0.095 / 12; // 9.5% annual rate
const n = 120; // 10 years tenure
const emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
console.log("Estimated Monthly EMI: ₹" + Math.round(emi));`,
          codeLanguage: "javascript",
        };
        break;
      case "tags":
        newBlock = {
          id: newId,
          type: "tags",
          content: "EducationLoan, StudyAbroad, InterestRates, VisaGuidance",
        };
        break;
      case "divider":
        newBlock = {
          id: newId,
          type: "divider",
          content: "",
        };
        break;
      case "spacer":
        newBlock = {
          id: newId,
          type: "spacer",
          content: "32px",
        };
        break;
      default:
        newBlock = {
          id: newId,
          type: "text",
          content: "New paragraph block...",
        };
    }

    if (typeof insertIndex === "number" && insertIndex >= 0) {
      setBlocks((prev) => {
        const next = [...prev];
        next.splice(insertIndex + 1, 0, newBlock);
        return next;
      });
      setInserterOpenIndex(null);
    } else {
      setBlocks((prev) => [...prev, newBlock]);
    }
    setSelectedBlockId(newId);
  };

  const updateBlock = (id: string, patch: Partial<Block>) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...patch } : b))
    );
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    if (selectedBlockId === id) setSelectedBlockId(null);
  };

  const moveBlock = (index: number, direction: "up" | "down") => {
    setBlocks((prev) => {
      const next = [...prev];
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      const temp = next[index];
      next[index] = next[target];
      next[target] = temp;
      return next;
    });
  };

  const duplicateBlock = (block: Block, index: number) => {
    const clone: Block = JSON.parse(JSON.stringify(block));
    clone.id = `block-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    setBlocks((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, clone);
      return next;
    });
  };

  // Tag helper
  const addTag = (t: string) => {
    const clean = t.trim().replace(/^#/, "");
    if (clean && !tags.includes(clean)) {
      setTags((prev) => [...prev, clean]);
    }
    setNewTagInput("");
  };

  const removeTag = (t: string) => {
    setTags((prev) => prev.filter((x) => x !== t));
  };

  // Convert blocks to semantic HTML for public rendering
  const generateCompleteHtml = () => {
    const bodyHtml = blocks
      .map((block) => {
        switch (block.type) {
          case "heading": {
            const lvl = block.level || 2;
            const hId = (block.content || "")
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/(^-|-$)/g, "");
            const sizeClass =
              lvl === 1
                ? "text-3xl md:text-4xl font-black mt-10 mb-4"
                : lvl === 2
                  ? "text-2xl md:text-3xl font-black mt-8 mb-3"
                  : "text-xl md:text-2xl font-bold mt-6 mb-2";
            return `<h${lvl} id="${hId}" class="${sizeClass} text-slate-900 tracking-tight">${block.content || ""}</h${lvl}>`;
          }
          case "text": {
            const clean = cleanHtmlContent(block.content || "");
            return `<div class="text-base md:text-lg leading-relaxed text-slate-700 my-4 [&_*:not(mark)]:bg-transparent">${clean}</div>`;
          }
          case "table_of_contents": {
            const headings = blocks
              .filter((b) => b.type === "heading" && b.content?.trim())
              .map((b) => {
                const lvl = b.level || 2;
                const hId = (b.content || "")
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/(^-|-$)/g, "");
                return { title: b.content, level: lvl, id: hId };
              });

            const itemsHtml = headings
              .map(
                (h, idx) =>
                  `<li class="py-1" style="padding-left: ${(h.level - 1) * 16}px"><a href="#${h.id}" class="text-indigo-600 hover:text-indigo-800 font-semibold text-sm transition-colors flex items-center gap-2"><span class="text-xs text-slate-400 font-mono">${idx + 1}.</span><span>${h.title}</span></a></li>`
              )
              .join("");

            return `<nav class="my-8 p-6 bg-gradient-to-br from-slate-50 to-indigo-50/40 rounded-3xl border border-indigo-100/80 shadow-xs"><div class="flex items-center gap-2 text-indigo-900 font-black text-sm uppercase tracking-wider mb-3"><span class="material-symbols-outlined text-indigo-600 text-lg">toc</span><span>${block.title || "In This Article"}</span></div><ul class="space-y-1 list-none pl-0 mb-0">${itemsHtml}</ul></nav>`;
          }
          case "split_content": {
            const cfg: Partial<SplitConfig> = block.splitConfig || {};
            const layout = cfg.layoutType || "image_text";
            const ratio = cfg.ratio || "50_50";
            let leftSpan = "md:col-span-6";
            let rightSpan = "md:col-span-6";
            if (ratio === "40_60") {
              leftSpan = "md:col-span-5";
              rightSpan = "md:col-span-7";
            } else if (ratio === "60_40") {
              leftSpan = "md:col-span-7";
              rightSpan = "md:col-span-5";
            }

            const imgMarkup = (url?: string, caption?: string) => `
              <div class="rounded-3xl overflow-hidden shadow-md border border-slate-200/80 bg-slate-100">
                <img src="${url || CURATED_COVERS[0].url}" alt="Editorial Visual" class="w-full h-full object-cover max-h-[400px]" />
                ${caption ? `<div class="p-2.5 bg-slate-900/80 text-white text-xs text-center font-medium">${caption}</div>` : ""}
              </div>`;

            const textMarkup = (title?: string, content?: string, items?: string[], btnText?: string, btnUrl?: string) => `
              <div class="flex flex-col justify-center py-2">
                ${title ? `<h3 class="text-2xl font-black text-slate-900 tracking-tight mb-2">${title}</h3>` : ""}
                ${content ? `<p class="text-slate-600 text-base leading-relaxed mb-4">${content}</p>` : ""}
                ${items && items.length > 0 ? `<ul class="space-y-2 mb-5 pl-0 list-none">${items.map((it) => `<li class="flex items-center gap-2.5 text-sm text-slate-700 font-semibold"><span class="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold shrink-0">✓</span><span>${it}</span></li>`).join("")}</ul>` : ""}
                ${btnText ? `<div><a href="${btnUrl || "/apply-loan"}" class="inline-flex items-center gap-2 px-6 py-3 !bg-indigo-600 hover:!bg-indigo-700 !text-white font-bold rounded-2xl text-xs uppercase tracking-wider shadow-md transition-all" style="background-color: #4f46e5 !important; color: #ffffff !important; display: inline-flex;">${btnText} &rarr;</a></div>` : ""}
              </div>`;

            const formMarkup = (formTitle?: string, formSubtitle?: string, btnText?: string, redirectUrl?: string, source?: string) => `
              <div class="bg-white p-6 md:p-8 rounded-3xl border border-indigo-100 shadow-xl shadow-indigo-100/50 not-prose my-2">
                <div class="mb-4">
                  <span class="inline-block px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-wider rounded-lg mb-2">Instant Pre-Assessment</span>
                  <h4 class="text-xl font-black text-slate-900 tracking-tight mb-1">${formTitle || "Quick Loan Assessment & Registration"}</h4>
                  <p class="text-slate-500 text-xs leading-relaxed">${formSubtitle || "Enter student details for immediate eligibility evaluation & dedicated counselor callback."}</p>
                </div>
                <form action="${redirectUrl || "/apply-loan"}" method="GET" class="space-y-3.5">
                  <input type="hidden" name="source" value="${source || "blog_split_form"}" />
                  <div>
                    <label class="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Student Full Name</label>
                    <input type="text" name="name" required placeholder="Enter student full name" class="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all" />
                  </div>
                  <div>
                    <label class="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Mobile / WhatsApp Number</label>
                    <input type="tel" name="phone" required placeholder="+91 98765 43210" class="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all" />
                  </div>
                  <div class="grid grid-cols-2 gap-2.5">
                    <div>
                      <label class="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Target Country</label>
                      <select name="country" class="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all">
                        <option value="USA">USA</option>
                        <option value="UK">United Kingdom</option>
                        <option value="Canada">Canada</option>
                        <option value="Australia">Australia</option>
                        <option value="Germany">Germany</option>
                        <option value="Ireland">Ireland</option>
                        <option value="India">India</option>
                        <option value="Other">Other Global</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Loan Required</label>
                      <select name="amount" class="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all">
                        <option value="Up to ₹20L">Up to ₹20 Lakhs</option>
                        <option value="₹20L - ₹40L">₹20L - ₹40 Lakhs</option>
                        <option value="₹40L - ₹75L">₹40L - ₹75 Lakhs</option>
                        <option value="₹75L+">₹75 Lakhs+</option>
                      </select>
                    </div>
                  </div>
                  <div class="pt-2">
                    <button type="submit" class="w-full py-3 px-5 !bg-indigo-600 hover:!bg-indigo-700 !text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer" style="background-color: #4f46e5 !important; color: #ffffff !important;">
                      <span>${btnText || "Register & Check Eligibility"}</span>
                      <span>&rarr;</span>
                    </button>
                  </div>
                  <p class="text-[10px] text-slate-400 text-center flex items-center justify-center gap-1">
                    <span class="text-emerald-500 font-bold">✓</span> Free Assessment • No Credit Score Impact • 100% Privacy
                  </p>
                </form>
              </div>`;

            let leftPart = "";
            let rightPart = "";
            if (layout === "image_text") {
              leftPart = imgMarkup(cfg.leftImageUrl, cfg.leftImageCaption);
              rightPart = textMarkup(cfg.rightTitle, cfg.rightContent, cfg.rightItems, cfg.buttonText, cfg.buttonUrl);
            } else if (layout === "text_image") {
              leftPart = textMarkup(cfg.leftTitle, cfg.leftContent, cfg.leftItems, cfg.buttonText, cfg.buttonUrl);
              rightPart = imgMarkup(cfg.rightImageUrl, cfg.rightImageCaption);
            } else if (layout === "text_form") {
              leftPart = textMarkup(cfg.leftTitle, cfg.leftContent, cfg.leftItems, cfg.buttonText, cfg.buttonUrl);
              rightPart = formMarkup(cfg.formTitle, cfg.formSubtitle, cfg.formButtonText, cfg.formRedirectUrl, cfg.formSource);
            } else if (layout === "form_text") {
              leftPart = formMarkup(cfg.formTitle, cfg.formSubtitle, cfg.formButtonText, cfg.formRedirectUrl, cfg.formSource);
              rightPart = textMarkup(cfg.rightTitle, cfg.rightContent, cfg.rightItems, cfg.buttonText, cfg.buttonUrl);
            } else {
              leftPart = textMarkup(cfg.leftTitle, cfg.leftContent, cfg.leftItems);
              rightPart = textMarkup(cfg.rightTitle, cfg.rightContent, cfg.rightItems, cfg.buttonText, cfg.buttonUrl);
            }

            return `<div class="not-prose my-10 p-6 md:p-8 bg-slate-50/80 rounded-3xl border border-slate-200"><div class="grid grid-cols-1 md:grid-cols-12 gap-8 items-center"><div class="${leftSpan}">${leftPart}</div><div class="${rightSpan}">${rightPart}</div></div></div>`;
          }
          case "table": {
            const td = block.tableData || {
              headers: ["Feature", "Public Banks", "Private NBFCs"],
              rows: [["Limit", "₹7.5L", "₹75L"]],
              hasHeader: true,
              isStriped: true,
            };
            const headerMarkup = td.hasHeader
              ? `<thead class="bg-slate-100 text-slate-800 text-xs font-bold uppercase tracking-wider"><tr>${td.headers.map((h) => `<th class="px-5 py-3.5 text-left border-b border-slate-200">${h}</th>`).join("")}</tr></thead>`
              : "";
            const rowsMarkup = td.rows
              .map((row, rIdx) => {
                const bg = td.isStriped && rIdx % 2 === 1 ? "bg-slate-50/60" : "bg-white";
                return `<tr class="${bg} hover:bg-slate-50 transition-colors">${row.map((c) => `<td class="px-5 py-3.5 text-slate-700 text-sm border-b border-slate-100 font-medium">${c}</td>`).join("")}</tr>`;
              })
              .join("");

            return `<div class="my-8 overflow-x-auto rounded-2xl border border-slate-200 shadow-xs"><table class="min-w-full text-left border-collapse">${headerMarkup}<tbody>${rowsMarkup}</tbody></table></div>`;
          }
          case "quote": {
            return `<blockquote class="my-8 p-6 md:p-8 bg-gradient-to-r from-indigo-50/90 to-purple-50/60 border-l-4 border-indigo-600 rounded-r-3xl shadow-xs"><p class="text-xl md:text-2xl font-black text-slate-900 italic leading-relaxed mb-3">&ldquo;${block.content || ""}&rdquo;</p>${block.authorCitation ? `<cite class="block text-xs font-bold text-indigo-700 uppercase tracking-widest">— ${block.authorCitation}</cite>` : ""}</blockquote>`;
          }
          case "alert": {
            const toneMap = {
              info: { bg: "bg-blue-50 border-blue-200 text-blue-950", icon: "info", iconColor: "text-blue-600" },
              tip: { bg: "bg-emerald-50 border-emerald-200 text-emerald-950", icon: "lightbulb", iconColor: "text-emerald-600" },
              warning: { bg: "bg-amber-50 border-amber-200 text-amber-950", icon: "warning", iconColor: "text-amber-600" },
              alert: { bg: "bg-rose-50 border-rose-200 text-rose-950", icon: "campaign", iconColor: "text-rose-600" },
            };
            const currentTone = toneMap[block.alertTone || "info"];
            return `<div class="my-6 p-5 rounded-2xl border ${currentTone.bg} flex items-start gap-4"><span class="material-symbols-outlined ${currentTone.iconColor} text-2xl shrink-0 mt-0.5">${currentTone.icon}</span><div>${block.title ? `<h4 class="font-bold text-base mb-1">${block.title}</h4>` : ""}<p class="text-sm leading-relaxed opacity-90">${block.content || ""}</p></div></div>`;
          }
          case "list": {
            const tag = block.listType === "ordered" ? "ol" : "ul";
            const listClass = block.listType === "ordered" ? "list-decimal list-inside" : "list-disc list-inside";
            const items = (block.items || []).map((i) => `<li class="py-1 text-slate-700 text-base">${i.title}</li>`).join("");
            return `<${tag} class="my-6 space-y-1.5 pl-2 ${listClass}">${items}</${tag}>`;
          }
          case "image": {
            return `<figure class="my-8"><img src="${block.content || CURATED_COVERS[0].url}" alt="Article Illustration" class="w-full rounded-3xl shadow-lg object-cover max-h-[500px]" />${block.caption ? `<figcaption class="text-xs text-center text-slate-500 font-medium mt-2">${block.caption}</figcaption>` : ""}</figure>`;
          }
          case "video": {
            return `<div class="my-8 aspect-video rounded-3xl overflow-hidden shadow-lg border border-slate-200 bg-slate-950"><iframe src="${block.content || ""}" class="w-full h-full" frameborder="0" allowfullscreen></iframe></div>`;
          }
          case "button": {
            const btnText = block.buttonText || block.content || "Explore Loan Options";
            const btnUrl = block.buttonUrl || "/apply-loan";
            const isNewTab = block.buttonNewTab !== false;
            return `<div class="my-8 text-center not-prose blog-button-wrapper"><a href="${btnUrl}" target="${isNewTab ? "_blank" : "_self"}" ${isNewTab ? 'rel="noopener noreferrer"' : ""} class="blog-btn inline-flex items-center justify-center gap-2 px-8 py-3.5 !bg-indigo-600 hover:!bg-indigo-700 !text-white font-bold rounded-2xl shadow-xl shadow-indigo-600/25 text-sm uppercase tracking-wider transition-all transform hover:-translate-y-0.5" style="background-color: #4f46e5 !important; color: #ffffff !important; display: inline-flex; align-items: center; justify-content: center; padding: 14px 32px; border-radius: 16px; font-weight: 700; text-decoration: none; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.4);">${btnText} &rarr;</a></div>`;
          }
          case "code": {
            return `<pre class="my-8 p-6 bg-slate-900 text-emerald-400 rounded-3xl overflow-x-auto text-sm font-mono shadow-md"><code>${block.content || ""}</code></pre>`;
          }
          case "tags": {
            const pills = (block.content || "")
              .split(",")
              .map((t) => t.trim().replace(/^#/, ""))
              .filter(Boolean)
              .map((t) => `<span class="px-3.5 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold border border-indigo-100">#${t}</span>`)
              .join(" ");
            return `<div class="my-8 pt-6 border-t border-slate-100 flex flex-wrap gap-2">${pills}</div>`;
          }
          case "divider": {
            return `<hr class="my-10 border-slate-200" />`;
          }
          case "spacer": {
            return `<div class="h-10"></div>`;
          }
          default:
            return "";
        }
      })
      .join("\n");

    // Embed blocks JSON and SEO metadata comments for lossless round-trip reloading
    const jsonComment = `\n<!--BLOCKS_JSON_START-->${JSON.stringify(blocks)}<!--BLOCKS_JSON_END-->`;
    const seoComment = `\n<!--SEO_JSON_START-->${JSON.stringify({
      metaTitle: metaTitle.trim(),
      metaDescription: metaDescription.trim(),
      focusKeyword: focusKeyword.trim(),
      canonicalUrl: canonicalUrl.trim(),
      noIndex: Boolean(noIndex),
    })}<!--SEO_JSON_END-->`;
    return bodyHtml + jsonComment + seoComment;
  };

  // Save / Publish action
  const handleSave = async (publish: boolean = false) => {
    if (!title.trim()) {
      alert("Please provide an article headline before saving.");
      return;
    }

    setSaving(true);
    try {
      const finalSlug =
        slug.trim() ||
        title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");

      const htmlContent = generateCompleteHtml();

      const payload = {
        title: title.trim(),
        slug: finalSlug,
        subtitle: subtitle.trim(),
        category,
        coverImage,
        featuredImage: coverImage,
        content: htmlContent,
        blocks,
        tags,
        readTime: readingTime,
        authorName,
        metaTitle: metaTitle.trim() || undefined,
        metaDescription: metaDescription.trim() || undefined,
        focusKeyword: focusKeyword.trim() || undefined,
        canonicalUrl: canonicalUrl.trim() || undefined,
        noIndex: Boolean(noIndex),
        isPublished: publish,
        published: publish,
        status: publish ? "published" : "draft",
        authorId: currentUser?.id || "it-admin",
        userId: currentUser?.id || "it-admin",
        email: currentUser?.email || "it@vidyaloans.com",
      };

      let savedResult: any;
      if (initialBlog?.id || initialBlog?._id) {
        const id = initialBlog.id || initialBlog._id;
        savedResult = await blogApi.update(id, payload);
      } else {
        savedResult = await blogApi.create(payload);
      }

      // Clear draft backup
      localStorage.removeItem("dynamic_blog_draft_backup");
      alert(
        publish
          ? "🎉 Article successfully published live!"
          : "✅ Article draft successfully saved!"
      );
      onSaved(savedResult?.data || payload);
    } catch (err: any) {
      const errMsg = err?.message || String(err || "");
      if (
        errMsg.includes("401") ||
        errMsg.toLowerCase().includes("token") ||
        errMsg.toLowerCase().includes("unauthorized")
      ) {
        alert(
          "⚠️ Authentication Notice\n\nYour article draft is safely backed up in your browser storage.\n\nPlease ensure you are logged into your staff/admin session, or refresh your credentials."
        );
      } else {
        alert("Failed to save article: " + errMsg);
      }
    } finally {
      setSaving(false);
    }
  };

  // Selection helpers for inline formatting & modals
  const saveSelection = useCallback(() => {
    if (typeof window !== "undefined" && window.getSelection) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        try {
          savedRangeRef.current = sel.getRangeAt(0).cloneRange();
        } catch (_) { }
      }
    }
  }, []);

  const restoreSelection = useCallback((blockId?: string) => {
    if (blockId && editorRefs.current[blockId]) {
      editorRefs.current[blockId]?.focus();
    }
    if (savedRangeRef.current && typeof window !== "undefined" && window.getSelection) {
      const sel = window.getSelection();
      if (sel) {
        try {
          sel.removeAllRanges();
          sel.addRange(savedRangeRef.current);
        } catch (_) { }
      }
    }
  }, []);

  // Inline formatting command helper
  const applyInlineFormat = (cmd: string, val: string = "", blockId?: string) => {
    if (blockId) {
      restoreSelection(blockId);
    }
    try {
      document.execCommand(cmd, false, val);
    } catch (_) { }
    if (blockId && editorRefs.current[blockId]) {
      const newHtml = editorRefs.current[blockId]?.innerHTML || "";
      updateBlock(blockId, { content: newHtml });
    }
    saveSelection();
  };

  // Font size helper
  const applyFontSize = (blockId: string, sizePx: string) => {
    const el = editorRefs.current[blockId];
    if (!el) return;
    el.focus();
    restoreSelection(blockId);
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
      try {
        document.execCommand("fontSize", false, "7");
        const fontTags = el.querySelectorAll('font[size="7"]');
        fontTags.forEach((font) => {
          const span = document.createElement("span");
          span.style.fontSize = sizePx;
          span.innerHTML = font.innerHTML;
          font.parentNode?.replaceChild(span, font);
        });
      } catch (_) { }
      const newHtml = el.innerHTML;
      updateBlock(blockId, { content: newHtml });
    } else {
      updateBlock(blockId, {
        style: {
          ...(blocks.find((b) => b.id === blockId)?.style || {}),
          fontSize: sizePx,
        },
      });
    }
    saveSelection();
    setActiveFontSizeBlockId(null);
  };

  // Font family helper
  const applyFontFamily = (blockId: string, fontFamily: string) => {
    const el = editorRefs.current[blockId];
    if (!el) return;
    el.focus();
    restoreSelection(blockId);
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
      try {
        document.execCommand("fontName", false, fontFamily);
      } catch (_) { }
      const newHtml = el.innerHTML;
      updateBlock(blockId, { content: newHtml });
    } else {
      updateBlock(blockId, {
        style: {
          ...(blocks.find((b) => b.id === blockId)?.style || {}),
          fontFamily,
        },
      });
    }
    saveSelection();
    setActiveFontFamilyBlockId(null);
  };

  // Text color helper
  const applyTextColor = (blockId: string, colorHex: string) => {
    const el = editorRefs.current[blockId];
    if (!el) return;
    el.focus();
    restoreSelection(blockId);
    try {
      document.execCommand("foreColor", false, colorHex);
    } catch (_) { }
    const newHtml = el.innerHTML;
    updateBlock(blockId, { content: newHtml });
    saveSelection();
    setActiveColorBlockId(null);
  };

  // Apply highlight to selected text (preserving font size, family, and styles)
  const applyHighlight = (blockId: string, bg: string, _textColor?: string) => {
    const el = editorRefs.current[blockId];
    if (!el) return;
    el.focus();
    restoreSelection(blockId);
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (!el.contains(range.commonAncestorContainer)) {
        setActiveHighlightBlockId(null);
        return;
      }

      // 1. Remove background from any existing highlight elements inside or intersecting the range
      // to avoid stacking nested background colors
      const innerHighlights = Array.from(
        el.querySelectorAll('mark, [data-highlight="true"], span[style*="background"]')
      ) as HTMLElement[];
      innerHighlights.forEach((hl) => {
        if (hl !== el && (sel.containsNode(hl, true) || range.intersectsNode(hl))) {
          hl.style.backgroundColor = "";
          hl.style.background = "";
          hl.removeAttribute("data-highlight");
          if (hl.tagName === "MARK") {
            const parent = hl.parentNode;
            if (parent) {
              while (hl.firstChild) parent.insertBefore(hl.firstChild, hl);
              parent.removeChild(hl);
            }
          }
        }
      });

      // 2. Check if selection is already inside an existing highlight container
      let container: Node | null = range.commonAncestorContainer;
      if (container.nodeType === Node.TEXT_NODE) {
        container = container.parentNode;
      }
      const existing = (container as HTMLElement)?.closest?.('[data-highlight="true"], mark') as HTMLElement | null;
      if (existing && el.contains(existing) && existing.textContent?.trim() === range.toString().trim()) {
        existing.style.backgroundColor = bg;
        existing.style.background = bg;
        existing.setAttribute("data-highlight", "true");
        if (existing.tagName === "MARK") {
          const span = document.createElement("span");
          span.setAttribute("data-highlight", "true");
          span.style.backgroundColor = bg;
          span.innerHTML = existing.innerHTML;
          existing.parentNode?.replaceChild(span, existing);
        }
      } else {
        const span = document.createElement("span");
        span.setAttribute("data-highlight", "true");
        span.style.backgroundColor = bg;

        try {
          range.surroundContents(span);
        } catch (_) {
          try {
            const fragment = range.extractContents();
            span.appendChild(fragment);
            range.insertNode(span);
          } catch (e) {
            // Safe fallback
          }
        }
      }

      // 3. Convert any lingering <mark> tags into standard spans with their own background or unwrap
      const marks = Array.from(el.querySelectorAll("mark"));
      marks.forEach((m) => {
        const s = document.createElement("span");
        s.setAttribute("data-highlight", "true");
        s.style.backgroundColor = m.style.backgroundColor || bg;
        s.innerHTML = m.innerHTML;
        m.parentNode?.replaceChild(s, m);
      });

      const newHtml = el.innerHTML;
      updateBlock(blockId, { content: newHtml });
    }
    saveSelection();
    setActiveHighlightBlockId(null);
  };

  // Remove highlight (without modifying font size, font family, or font styles)
  const removeHighlight = (blockId: string) => {
    const el = editorRefs.current[blockId];
    if (!el) return;
    el.focus();
    restoreSelection(blockId);
    const sel = window.getSelection();

    const cleanHighlightNode = (node: HTMLElement) => {
      // 1. Clear background styles
      node.style.backgroundColor = "";
      node.style.background = "";
      node.removeAttribute("data-highlight");
      node.removeAttribute("data-color");

      // Clear legacy highlight text color if it was one of the swatch text colors
      const c = node.style.color?.toLowerCase().trim();
      if (
        c === "#854d0e" || c === "rgb(133, 77, 14)" ||
        c === "#14532d" || c === "rgb(20, 83, 45)" ||
        c === "#0369a1" || c === "rgb(3, 105, 161)" ||
        c === "#9d174d" || c === "rgb(157, 23, 77)" ||
        c === "#6b21a8" || c === "rgb(107, 33, 168)" ||
        c === "#9a3412" || c === "rgb(154, 52, 18)"
      ) {
        node.style.color = "";
      }

      // Clear legacy padding/borderRadius/fontWeight from old <mark> styling
      if (node.style.padding === "2px 5px" || node.style.padding === "2px 6px") {
        node.style.padding = "";
      }
      if (node.style.borderRadius === "4px") {
        node.style.borderRadius = "";
      }
      if (node.style.fontWeight === "600") {
        node.style.fontWeight = "";
      }

      // 2. If it's a <mark> tag, always unwrap it completely because browsers style <mark> with default yellow
      if (node.tagName === "MARK") {
        const parent = node.parentNode;
        if (parent) {
          while (node.firstChild) {
            parent.insertBefore(node.firstChild, node);
          }
          parent.removeChild(node);
        }
        return;
      }

      // 3. If it's a <span>, only unwrap if it has NO other inline styles (preserving font-size, color, etc.)
      if (node.tagName === "SPAN") {
        const remainingStyle = node.getAttribute("style")?.trim();
        if (!remainingStyle || remainingStyle === "" || remainingStyle === ";") {
          node.removeAttribute("style");
          const parent = node.parentNode;
          if (parent) {
            while (node.firstChild) {
              parent.insertBefore(node.firstChild, node);
            }
            parent.removeChild(node);
          }
        }
      }
    };

    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);

      // Check all ancestor highlight elements of the selection up to the editor container
      const ancestorNodes = [range.commonAncestorContainer, range.startContainer, range.endContainer];
      ancestorNodes.forEach((startNode) => {
        let curr: Node | null = startNode;
        if (curr.nodeType === Node.TEXT_NODE) {
          curr = curr.parentNode;
        }
        while (curr && curr !== el && el.contains(curr)) {
          const parentEl = curr as HTMLElement;
          if (
            parentEl.tagName === "MARK" ||
            parentEl.getAttribute("data-highlight") === "true" ||
            parentEl.style.backgroundColor ||
            parentEl.style.background
          ) {
            // Check if selection covers the full text of this parent element
            const fullText = parentEl.textContent || "";
            const selText = range.toString();
            if (selText.trim() === fullText.trim() || selText.length >= fullText.length) {
              cleanHighlightNode(parentEl);
            } else if (selText.length > 0 && fullText.includes(selText)) {
              // Partial selection inside an enclosing highlight element: split into before, clean middle, after
              const bg = parentEl.style.backgroundColor || parentEl.style.background;
              const idx = fullText.indexOf(selText);
              if (idx !== -1) {
                const beforeText = fullText.substring(0, idx);
                const afterText = fullText.substring(idx + selText.length);
                const frag = document.createDocumentFragment();

                if (beforeText) {
                  const bSpan = parentEl.cloneNode(false) as HTMLElement;
                  bSpan.textContent = beforeText;
                  bSpan.style.backgroundColor = bg;
                  bSpan.setAttribute("data-highlight", "true");
                  frag.appendChild(bSpan);
                }

                const mSpan = parentEl.cloneNode(false) as HTMLElement;
                mSpan.textContent = selText;
                mSpan.style.backgroundColor = "";
                mSpan.style.background = "";
                mSpan.removeAttribute("data-highlight");
                cleanHighlightNode(mSpan);
                frag.appendChild(mSpan);

                if (afterText) {
                  const aSpan = parentEl.cloneNode(false) as HTMLElement;
                  aSpan.textContent = afterText;
                  aSpan.style.backgroundColor = bg;
                  aSpan.setAttribute("data-highlight", "true");
                  frag.appendChild(aSpan);
                }

                parentEl.parentNode?.replaceChild(frag, parentEl);
                break;
              } else {
                cleanHighlightNode(parentEl);
              }
            } else {
              cleanHighlightNode(parentEl);
            }
          }
          curr = curr.parentNode;
        }
      });

      // Also clean all highlight elements inside or intersecting the range
      const allHighlights = Array.from(
        el.querySelectorAll('mark, [data-highlight="true"], span[style*="background"]')
      ) as HTMLElement[];

      allHighlights.forEach((candidate) => {
        if (candidate !== el) {
          if (
            sel.isCollapsed ||
            sel.containsNode(candidate, true) ||
            (range.intersectsNode && range.intersectsNode(candidate))
          ) {
            cleanHighlightNode(candidate);
          }
        }
      });
    }

    // Always unwrap any lingering <mark> tags inside the block to guarantee no default yellow background can appear
    const anyMarks = Array.from(el.querySelectorAll("mark"));
    anyMarks.forEach((m) => {
      const parent = m.parentNode;
      if (parent) {
        while (m.firstChild) {
          parent.insertBefore(m.firstChild, m);
        }
        parent.removeChild(m);
      }
    });

    el.normalize();
    const newHtml = el.innerHTML;
    updateBlock(blockId, { content: newHtml });
    saveSelection();
    setActiveHighlightBlockId(null);
  };

  // Block style / heading preset helper
  const applyBlockFormat = (blockId: string, tag: string) => {
    const el = editorRefs.current[blockId];
    if (!el) return;
    el.focus();
    restoreSelection(blockId);
    if (tag === "lead") {
      updateBlock(blockId, {
        style: {
          ...(blocks.find((b) => b.id === blockId)?.style || {}),
          fontSize: "18px",
          color: "#0f172a",
        },
      });
    } else {
      try {
        document.execCommand("formatBlock", false, `<${tag}>`);
      } catch (_) { }
      const newHtml = el.innerHTML;
      updateBlock(blockId, { content: newHtml });
    }
    saveSelection();
    setActiveFormatBlockId(null);
  };

  // Handle paste in WYSIWYG text block: cleans dark/black background colors
  const handleCleanPaste = (
    e: React.ClipboardEvent<HTMLDivElement>,
    blockId: string
  ) => {
    e.preventDefault();
    const clipboardData = e.clipboardData;
    const html = clipboardData.getData("text/html");
    const text = clipboardData.getData("text/plain");

    if (html) {
      const cleaned = cleanHtmlContent(html);
      if (cleaned) {
        try {
          document.execCommand("insertHTML", false, cleaned);
        } catch (_) {
          document.execCommand("insertText", false, text);
        }
      } else if (text) {
        document.execCommand("insertText", false, text);
      }
    } else if (text) {
      document.execCommand("insertText", false, text);
    }

    const currentTarget = e.currentTarget;
    setTimeout(() => {
      updateBlock(blockId, { content: currentTarget.innerHTML });
    }, 0);
  };

  // Clean formatting and remove black/dark backgrounds from a block
  const cleanBlockFormatting = (blockId: string) => {
    const el = editorRefs.current[blockId];
    if (el) {
      el.focus();
      try {
        document.execCommand("removeFormat", false, undefined);
      } catch (_) { }
      const cleaned = cleanHtmlContent(el.innerHTML);
      el.innerHTML = cleaned;
      updateBlock(blockId, { content: cleaned });
    } else {
      setBlocks((prev) =>
        prev.map((b) => {
          if (b.id !== blockId) return b;
          return {
            ...b,
            content: cleanHtmlContent(b.content || ""),
          };
        })
      );
    }
  };

  // Apply starter template
  const applyTemplate = (templateName: string) => {
    if (!confirm(`Apply the "${templateName}" template? This will load a structured article layout.`)) return;

    if (templateName === "Comprehensive Loan Guide") {
      setTitle("Complete Guide to Overseas Education Loans: Rates, Sanctions & Moratorium");
      setSubtitle("Everything students and parents need to know about collateral-free funding up to ₹75 Lakhs, tax deductions under 80E, and fast approvals.");
      setCategory("Loan Guidance");
      setCoverImage(CURATED_COVERS[0].url);
      setTags(["EducationLoan", "StudyAbroad", "Moratorium", "TaxBenefits"]);
    } else if (templateName === "Bank Review & Comparison") {
      setTitle("HDFC Credila vs IDFC FIRST vs Axis Bank: Best Study Abroad Loans Compared");
      setSubtitle("An independent, data-driven comparison of top education loan providers, processing turnarounds, hidden charges, and student satisfaction.");
      setCategory("Bank Reviews");
      setCoverImage(CURATED_COVERS[3].url);
      setTags(["BankComparison", "HDFCCredila", "IDFCFirst", "InterestRates"]);
    } else if (templateName === "Student Success Story") {
      setTitle("How Priya Secured a ₹65 Lakh Unsecured Loan for Columbia University in 4 Days");
      setSubtitle("From co-applicant salary documentation to instant pre-visa disbursement, read the inspiring journey of a tech scholar heading to New York.");
      setCategory("Student Life");
      setCoverImage(CURATED_COVERS[2].url);
      setTags(["StudentStory", "ColumbiaUniversity", "UnsecuredFunding"]);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 overflow-hidden font-sans">
      {/* 1. TOP EDITORIAL SUITE HEADER */}
      <header className="bg-slate-900 text-white px-4 md:px-6 py-3 flex items-center justify-between gap-3 border-b border-slate-800 shadow-md shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Back to CMS</span>
          </button>

          <div className="hidden sm:flex items-center gap-2 border-l border-slate-800 pl-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
              Live Editorial Desk
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400">
            <span className="text-slate-600">|</span>
            <span className="font-mono">{wordCount} words</span>
            <span>•</span>
            <span className="font-mono">{readingTime} min read</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400 text-[11px]">
              {saveStatus} ({lastSavedTime})
            </span>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
          <button
            type="button"
            onClick={() => setViewMode("edit")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${viewMode === "edit"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-400 hover:text-white"
              }`}
            title="Document Editor"
          >
            <span className="material-symbols-outlined text-[15px]">edit_document</span>
            <span className="hidden md:inline">Editor</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("split")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${viewMode === "split"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-400 hover:text-white"
              }`}
            title="Live Split-Screen Preview (Editor + Live Blog)"
          >
            <span className="material-symbols-outlined text-[15px]">vertical_split</span>
            <span className="hidden md:inline">Split View</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("preview")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${viewMode === "preview"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-400 hover:text-white"
              }`}
            title="Full Page Publication Preview"
          >
            <span className="material-symbols-outlined text-[15px]">visibility</span>
            <span className="hidden md:inline">Full Preview</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("mobile")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${viewMode === "mobile"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-400 hover:text-white"
              }`}
            title="Mobile Responsive Preview"
          >
            <span className="material-symbols-outlined text-[15px]">smartphone</span>
            <span className="hidden md:inline">Mobile</span>
          </button>
        </div>

        {/* Publish Actions */}
        <div className="flex items-center gap-2">
          {/* Quick template dropdown */}
          <div className="relative group">
            <button
              type="button"
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px] text-amber-400">auto_stories</span>
              <span className="hidden sm:inline">Templates</span>
              <span className="material-symbols-outlined text-[14px]">expand_more</span>
            </button>
            <div className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 hidden group-hover:block z-50 text-slate-800">
              <p className="px-3 py-1 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                Editorial Starters
              </p>
              <button
                type="button"
                onClick={() => applyTemplate("Comprehensive Loan Guide")}
                className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2 cursor-pointer"
              >
                <span>📘</span> Comprehensive Loan Guide
              </button>
              <button
                type="button"
                onClick={() => applyTemplate("Bank Review & Comparison")}
                className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2 cursor-pointer"
              >
                <span>🏦</span> Bank Review & Matrix
              </button>
              <button
                type="button"
                onClick={() => applyTemplate("Student Success Story")}
                className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2 cursor-pointer"
              >
                <span>🎓</span> Student Success Story
              </button>
            </div>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave(false)}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Draft"}
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave(true)}
            className="px-4 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-95 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">send</span>
            <span>{saving ? "Publishing..." : "Publish Live"}</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE (EDITOR / SPLIT / PREVIEW) */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT / CENTER PANEL: DOCUMENT EDITOR CANVAS */}
        {(viewMode === "edit" || viewMode === "split") && (
          <div
            className={`flex-1 overflow-y-auto px-4 md:px-8 py-6 transition-all ${viewMode === "split" ? "border-r border-slate-300/80 max-w-[55%]" : "max-w-4xl mx-auto w-full"
              }`}
          >
            <div className="bg-white rounded-3xl p-6 md:p-10 shadow-sm border border-slate-200 space-y-6">
              {/* Top Meta Bar */}
              <div className="space-y-4 pb-6 border-b border-slate-100">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                      Category:
                    </span>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-indigo-700 cursor-pointer focus:ring-2 focus:ring-indigo-500"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => setShowCoverPicker(!showCoverPicker)}
                      className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px] text-indigo-600">image</span>
                      <span>Change Cover Image</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowSeoPreview(!showSeoPreview)}
                      className={`px-3 py-1.5 border rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                        showSeoPreview
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                          : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                      }`}
                    >
                      <span className={`material-symbols-outlined text-[15px] ${showSeoPreview ? "text-white" : "text-emerald-600"}`}>
                        travel_explore
                      </span>
                      <span>SEO Studio</span>
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                          showSeoPreview
                            ? "bg-white/20 text-white"
                            : seoAnalysis.score >= 80
                            ? "bg-emerald-100 text-emerald-800"
                            : seoAnalysis.score >= 50
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {seoAnalysis.score}%
                      </span>
                    </button>
                  </div>

                  {/* Byline / Timestamp in IST */}
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Published Byline
                    </p>
                    <p className="text-xs font-bold text-slate-800">
                      {authorName} • {nowFormattedDate}
                    </p>
                  </div>
                </div>

                {/* Cover Image Picker Drawer */}
                {showCoverPicker && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-slate-600">
                        Select Hero Cover Photo
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowCoverPicker(false)}
                        className="text-slate-400 hover:text-slate-700 text-xs"
                      >
                        ✕ Close
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {CURATED_COVERS.map((cov) => (
                        <div
                          key={cov.url}
                          onClick={() => setCoverImage(cov.url)}
                          className={`relative rounded-xl overflow-hidden aspect-video cursor-pointer border-2 transition-all ${coverImage === cov.url
                              ? "border-indigo-600 shadow-md scale-102"
                              : "border-transparent opacity-75 hover:opacity-100"
                            }`}
                        >
                          <img
                            src={cov.url}
                            alt={cov.label}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute bottom-1 left-1 bg-slate-900/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                            {cov.label}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-xs font-bold text-slate-500">Custom URL:</span>
                      <input
                        type="text"
                        value={coverImage}
                        onChange={(e) => setCoverImage(e.target.value)}
                        placeholder="https://images.unsplash.com/..."
                        className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-800"
                      />
                    </div>
                  </div>
                )}

                {/* SEO & Search Engine Optimization Studio Drawer */}
                {showSeoPreview && (
                  <div className="p-6 bg-gradient-to-br from-white via-indigo-50/20 to-slate-50 rounded-3xl border border-indigo-100/80 shadow-lg space-y-6 animate-fade-in">
                    {/* Header with Health Score Bar */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-emerald-500 text-white flex items-center justify-center shadow-xs">
                            <span className="material-symbols-outlined text-lg">travel_explore</span>
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                              SEO & SERP Distribution Studio
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                  seoAnalysis.score >= 80
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                    : seoAnalysis.score >= 50
                                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                                    : "bg-rose-100 text-rose-800 border border-rose-200"
                                }`}
                              >
                                {seoAnalysis.rating} ({seoAnalysis.score}/100)
                              </span>
                            </h3>
                            <p className="text-xs text-slate-500">
                              Fine-tune meta tags, search rankings, JSON-LD schema, and social cards
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Overall score meter */}
                        <div className="w-36 hidden sm:block">
                          <div className="flex justify-between text-[11px] font-semibold text-slate-500 mb-1">
                            <span>SEO Health</span>
                            <span className="font-bold text-slate-800">{seoAnalysis.score}%</span>
                          </div>
                          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 ${
                                seoAnalysis.score >= 80
                                  ? "bg-emerald-500"
                                  : seoAnalysis.score >= 50
                                  ? "bg-amber-500"
                                  : "bg-rose-500"
                              }`}
                              style={{ width: `${seoAnalysis.score}%` }}
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowSeoPreview(false)}
                          className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* Studio Tabs */}
                    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/60 pb-2">
                      <button
                        type="button"
                        onClick={() => setSeoTab("fields")}
                        className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          seoTab === "fields"
                            ? "bg-indigo-600 text-white shadow-xs"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">tune</span>
                        <span>Meta Tags & Directives</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSeoTab("checklist")}
                        className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          seoTab === "checklist"
                            ? "bg-indigo-600 text-white shadow-xs"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">fact_check</span>
                        <span>
                          SEO Checklist ({seoAnalysis.checklist.filter((c) => c.status === "pass").length}/
                          {seoAnalysis.checklist.length})
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSeoTab("preview")}
                        className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          seoTab === "preview"
                            ? "bg-indigo-600 text-white shadow-xs"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">preview</span>
                        <span>Google SERP & Social Previews</span>
                      </button>
                    </div>

                    {/* Tab 1: Meta Tags & Directives */}
                    {seoTab === "fields" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                        {/* Left Column */}
                        <div className="space-y-4">
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                                <span className="material-symbols-outlined text-indigo-600 text-sm">key</span>
                                Focus Keyword
                              </label>
                              {focusKeyword && (
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    seoAnalysis.kwCount > 0
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-amber-100 text-amber-800"
                                  }`}
                                >
                                  {seoAnalysis.kwCount} in content
                                </span>
                              )}
                            </div>
                            <input
                              type="text"
                              value={focusKeyword}
                              onChange={(e) => setFocusKeyword(e.target.value)}
                              placeholder="e.g. study abroad education loan"
                              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            />
                            <p className="text-[11px] text-slate-400 mt-1">
                              Primary search term this article should rank for on Google.
                            </p>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-bold text-slate-700">
                                Meta Title (SEO Title)
                              </label>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  metaTitle.length >= 40 && metaTitle.length <= 65
                                    ? "bg-emerald-100 text-emerald-800"
                                    : metaTitle.length > 65
                                    ? "bg-rose-100 text-rose-800"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {metaTitle.length || (title ? title.length : 0)} / 60 chars
                              </span>
                            </div>
                            <input
                              type="text"
                              value={metaTitle}
                              onChange={(e) => setMetaTitle(e.target.value)}
                              placeholder={title || "Defaults to article headline"}
                              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            />
                            <p className="text-[11px] text-slate-400 mt-1">
                              Displayed in Google search results and browser tabs. Recommended 40-60 characters.
                            </p>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-bold text-slate-700">
                                Meta Description
                              </label>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  metaDescription.length >= 120 && metaDescription.length <= 160
                                    ? "bg-emerald-100 text-emerald-800"
                                    : metaDescription.length > 160
                                    ? "bg-rose-100 text-rose-800"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {metaDescription.length || (subtitle ? subtitle.length : 0)} / 155 chars
                              </span>
                            </div>
                            <textarea
                              rows={3}
                              value={metaDescription}
                              onChange={(e) => setMetaDescription(e.target.value)}
                              placeholder={subtitle || "Defaults to article subtitle/excerpt"}
                              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
                            />
                            <p className="text-[11px] text-slate-400 mt-1">
                              Summarizes content in search engine result snippets. Aim for 120-160 characters.
                            </p>
                          </div>
                        </div>

                        {/* Right Column */}
                        <div className="space-y-4">
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-bold text-slate-700">
                                Canonical URL
                              </label>
                              <span className="text-[10px] text-slate-400 font-semibold">Optional</span>
                            </div>
                            <input
                              type="text"
                              value={canonicalUrl}
                              onChange={(e) => setCanonicalUrl(e.target.value)}
                              placeholder={`https://vidyaloans.com/blog/${slug || "article-slug"}`}
                              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            />
                            <p className="text-[11px] text-slate-400 mt-1">
                              Prevents duplicate content penalties if republished from another domain.
                            </p>
                          </div>

                          {/* Indexing Directive */}
                          <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-xs font-bold text-slate-800 block">
                                  Search Engine Indexing
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  Allow Google, Bing, and web crawlers to index this page.
                                </span>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={!noIndex}
                                  onChange={(e) => setNoIndex(!e.target.checked)}
                                  className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                              </label>
                            </div>

                            {noIndex && (
                              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-800 text-xs">
                                <span className="material-symbols-outlined text-sm shrink-0">warning</span>
                                <span>
                                  <strong>Indexing Blocked:</strong> Search crawlers will receive <code>noindex, nofollow</code> headers and will exclude this article from search results.
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Automated SEO Infrastructure Summary */}
                          <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-2">
                            <span className="text-xs font-bold text-indigo-900 block flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-sm text-indigo-600">verified</span>
                              Automated SEO Infrastructure
                            </span>
                            <div className="space-y-1 text-[11px] text-indigo-950/80">
                              <p className="flex items-center gap-1.5">
                                <span className="text-emerald-600 font-bold">✓</span>
                                <strong>JSON-LD Schema:</strong> Injected server-side (<code>BlogPosting</code> & <code>BreadcrumbList</code>).
                              </p>
                              <p className="flex items-center gap-1.5">
                                <span className="text-emerald-600 font-bold">✓</span>
                                <strong>XML Sitemap:</strong> Auto-indexed at <code>/sitemap.xml</code> upon publishing.
                              </p>
                              <p className="flex items-center gap-1.5">
                                <span className="text-emerald-600 font-bold">✓</span>
                                <strong>SSR / Next.js Metadata:</strong> Fully rendered for WhatsApp, Twitter, LinkedIn & crawlers.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tab 2: SEO Checklist */}
                    {seoTab === "checklist" && (
                      <div className="space-y-3 animate-fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {seoAnalysis.checklist.map((check) => (
                            <div
                              key={check.id}
                              className={`p-3.5 rounded-2xl border flex items-start gap-3 transition-colors ${
                                check.status === "pass"
                                  ? "bg-emerald-50/40 border-emerald-200/80"
                                  : check.status === "warn"
                                  ? "bg-amber-50/40 border-amber-200/80"
                                  : "bg-rose-50/40 border-rose-200/80"
                              }`}
                            >
                              <span
                                className={`material-symbols-outlined text-lg shrink-0 mt-0.5 ${
                                  check.status === "pass"
                                    ? "text-emerald-600"
                                    : check.status === "warn"
                                    ? "text-amber-600"
                                    : "text-rose-600"
                                }`}
                              >
                                {check.status === "pass"
                                  ? "check_circle"
                                  : check.status === "warn"
                                  ? "info"
                                  : "cancel"}
                              </span>
                              <div className="space-y-0.5 flex-1">
                                <div className="flex items-center justify-between">
                                  <h5 className="text-xs font-bold text-slate-800">{check.label}</h5>
                                  <span
                                    className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                      check.status === "pass"
                                        ? "bg-emerald-100 text-emerald-800"
                                        : check.status === "warn"
                                        ? "bg-amber-100 text-amber-800"
                                        : "bg-rose-100 text-rose-800"
                                    }`}
                                  >
                                    {check.status === "pass"
                                      ? "Optimal"
                                      : check.status === "warn"
                                      ? "Improve"
                                      : "Fix"}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600 leading-snug">{check.message}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tab 3: SERP & Social Previews */}
                    {seoTab === "preview" && (
                      <div className="space-y-6 animate-fade-in">
                        {/* SERP Device Switcher */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                            Search Engine Snippet Simulation
                          </span>
                          <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200 text-xs font-bold">
                            <button
                              type="button"
                              onClick={() => setSerpDevice("desktop")}
                              className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                                serpDevice === "desktop"
                                  ? "bg-white text-indigo-700 shadow-xs"
                                  : "text-slate-500 hover:text-slate-800"
                              }`}
                            >
                              <span className="material-symbols-outlined text-sm">laptop</span>
                              Desktop SERP
                            </button>
                            <button
                              type="button"
                              onClick={() => setSerpDevice("mobile")}
                              className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                                serpDevice === "mobile"
                                  ? "bg-white text-indigo-700 shadow-xs"
                                  : "text-slate-500 hover:text-slate-800"
                              }`}
                            >
                              <span className="material-symbols-outlined text-sm">smartphone</span>
                              Mobile SERP
                            </button>
                          </div>
                        </div>

                        {/* Google SERP Container */}
                        {serpDevice === "desktop" ? (
                          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1.5 max-w-2xl font-sans">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 text-xs font-black">
                                V
                              </div>
                              <div className="leading-tight">
                                <span className="text-xs text-slate-900 font-medium block">
                                  VidyaLoans
                                </span>
                                <span className="text-[11px] text-slate-500 font-mono block">
                                  https://vidyaloans.com › blog › {slug || "article-slug"}
                                </span>
                              </div>
                            </div>
                            <h4 className="text-lg font-medium text-[#1a0dab] hover:underline cursor-pointer leading-snug pt-1">
                              {seoAnalysis.effectiveTitle || "Article Headline"} | VidyaLoan Hub
                            </h4>
                            <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                              {seoAnalysis.effectiveDesc ||
                                "Discover comprehensive education loan terms, interest rates, and approval turnarounds for study abroad students."}
                            </p>
                          </div>
                        ) : (
                          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2 max-w-sm font-sans">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 text-[10px] font-black">
                                  V
                                </div>
                                <span className="text-xs text-slate-800 font-medium">VidyaLoans</span>
                              </div>
                              <span className="text-[10px] text-slate-400">vidyaloans.com</span>
                            </div>
                            <div className="flex gap-3">
                              <div className="flex-1 space-y-1">
                                <h4 className="text-sm font-semibold text-[#1a0dab] leading-snug">
                                  {seoAnalysis.effectiveTitle || "Article Headline"}
                                </h4>
                                <p className="text-xs text-slate-600 line-clamp-2 leading-tight">
                                  {seoAnalysis.effectiveDesc ||
                                    "Comprehensive education loan rates and sanction insights."}
                                </p>
                              </div>
                              {coverImage && (
                                <img
                                  src={coverImage}
                                  alt="Preview"
                                  className="w-16 h-16 rounded-xl object-cover shrink-0"
                                />
                              )}
                            </div>
                          </div>
                        )}

                        {/* Social Share Preview (Open Graph) */}
                        <div className="space-y-2 pt-2 border-t border-slate-200/60">
                          <span className="text-xs font-black uppercase tracking-wider text-slate-500 block">
                            Social Media Card Preview (LinkedIn, WhatsApp, X/Twitter)
                          </span>
                          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden max-w-xl">
                            <div className="aspect-[1.91/1] bg-slate-100 overflow-hidden relative">
                              <img
                                src={coverImage}
                                alt="Social preview"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="p-3.5 space-y-1">
                              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                                VIDYALOANS.COM
                              </span>
                              <h5 className="text-sm font-bold text-slate-900 leading-snug truncate">
                                {seoAnalysis.effectiveTitle || "Article Headline"}
                              </h5>
                              <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                {seoAnalysis.effectiveDesc ||
                                  "Comprehensive education loan guidance, interest rates, and loan sanction steps."}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Hero Cover Image Preview */}
                <div className="relative aspect-[21/9] rounded-2xl overflow-hidden shadow-sm border border-slate-100 bg-slate-100 group">
                  <img
                    src={coverImage}
                    alt={title || "Cover Image"}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent flex items-end p-4 text-white">
                    <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider text-white">
                      {category}
                    </span>
                  </div>
                </div>

                {/* Dynamic Title Input (Editorial Style) */}
                <div>
                  <textarea
                    rows={2}
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="Write Catchy Editorial Headline..."
                    className="w-full text-2xl md:text-4xl font-black text-slate-900 placeholder-slate-300 resize-none border-0 focus:ring-0 focus:outline-none leading-tight font-display"
                  />
                </div>

                {/* Dynamic Subtitle / Standfirst */}
                <div>
                  <textarea
                    rows={2}
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="Enter editorial standfirst / lead summary (1-2 sentences)..."
                    className="w-full text-base md:text-lg text-slate-600 placeholder-slate-300 resize-none border-0 focus:ring-0 focus:outline-none leading-relaxed"
                  />
                </div>

                {/* Permalink Slug Bar */}
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-500 flex-wrap">
                  <span className="text-slate-400 font-bold">Public URL:</span>
                  <span className="text-indigo-600">/blog/</span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="custom-url-slug"
                    className="flex-1 bg-transparent text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-400 px-1 rounded"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const fullUrl = `${window.location.origin}/blog/${slug}`;
                      navigator.clipboard.writeText(fullUrl);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }}
                    className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[11px] font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[13px]">
                      {copiedLink ? "check" : "content_copy"}
                    </span>
                    <span>{copiedLink ? "Copied!" : "Copy"}</span>
                  </button>
                </div>

                {/* Tags Pill Cloud */}
                <div className="flex flex-wrap items-center gap-1.5 pt-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">
                    Tags:
                  </span>
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full text-xs font-bold flex items-center gap-1.5 group"
                    >
                      <span>#{t}</span>
                      <button
                        type="button"
                        onClick={() => removeTag(t)}
                        className="text-indigo-400 hover:text-indigo-800 text-[10px]"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          addTag(newTagInput);
                        }
                      }}
                      placeholder="+ Add tag..."
                      className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-full text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 w-24"
                    />
                  </div>
                </div>
              </div>

              {/* STICKY QUICK INSERTER TOOLBAR */}
              <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md py-2 border-b border-slate-200/80 -mx-6 md:-mx-10 px-6 md:px-10 flex items-center justify-between gap-2 overflow-x-auto shadow-2xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 shrink-0">
                  Quick Add:
                </span>
                <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                  <button
                    type="button"
                    onClick={() => addBlock("heading")}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-xs font-bold text-slate-700 flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">title</span>
                    <span>Heading</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addBlock("text")}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-xs font-bold text-slate-700 flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">text_fields</span>
                    <span>Text</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addBlock("split_content")}
                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                  >
                    <span className="material-symbols-outlined text-[15px]">view_column</span>
                    <span>Split 2-Col</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addBlock("split_content", undefined, "text_form")}
                    className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs border border-purple-200"
                    title="Insert Editorial Content with Registration / Lead Form beside it"
                  >
                    <span className="material-symbols-outlined text-[15px]">how_to_reg</span>
                    <span>Content + Reg Form</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addBlock("table")}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-xs font-bold text-slate-700 flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">table_chart</span>
                    <span>Table</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addBlock("table_of_contents")}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-xs font-bold text-slate-700 flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">toc</span>
                    <span>TOC Index</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addBlock("image")}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-xs font-bold text-slate-700 flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">image</span>
                    <span>Image</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addBlock("quote")}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-xs font-bold text-slate-700 flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">format_quote</span>
                    <span>Quote</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addBlock("alert")}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-xs font-bold text-slate-700 flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">campaign</span>
                    <span>Callout</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addBlock("list")}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-xs font-bold text-slate-700 flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">format_list_bulleted</span>
                    <span>List</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addBlock("video")}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-xs font-bold text-slate-700 flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">videocam</span>
                    <span>Video</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addBlock("button")}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-xs font-bold text-slate-700 flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">smart_button</span>
                    <span>CTA</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addBlock("divider")}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-xs font-bold text-slate-700 flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">horizontal_rule</span>
                    <span>Divider</span>
                  </button>
                </div>
              </div>

              {/* DYNAMIC CONTENT BLOCKS LIST */}
              <div className="space-y-4 pt-2">
                {blocks.map((block, index) => {
                  const isSelected = selectedBlockId === block.id;

                  return (
                    <div key={block.id} className="relative group">
                      {/* In-Between Block Inserter (+) */}
                      <div className="relative py-2 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-indigo-200/80" />
                        <button
                          type="button"
                          onClick={() =>
                            setInserterOpenIndex(
                              inserterOpenIndex === index ? null : index
                            )
                          }
                          className="relative z-10 px-2 py-0.5 bg-indigo-600 text-white rounded-full text-[10px] font-bold shadow-xs hover:scale-110 transition-transform flex items-center gap-1 cursor-pointer"
                          title="Insert block here"
                        >
                          <span className="material-symbols-outlined text-[12px]">add</span>
                          <span>Insert Element</span>
                        </button>
                      </div>

                      {/* Dropdown Inserter when open */}
                      {inserterOpenIndex === index && (
                        <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-xl flex items-center gap-2 overflow-x-auto my-2 animate-fade-in z-30">
                          <span className="text-[10px] font-black uppercase text-indigo-400 shrink-0">
                            Insert:
                          </span>
                          {(
                            [
                              "heading",
                              "text",
                              "split_content",
                              "table",
                              "quote",
                              "alert",
                              "list",
                              "image",
                              "video",
                              "button",
                            ] as BlockType[]
                          ).map((bt) => (
                            <button
                              key={bt}
                              type="button"
                              onClick={() => addBlock(bt, index)}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-indigo-600 rounded-lg text-xs font-bold capitalize shrink-0 cursor-pointer"
                            >
                              {bt.replace("_", " ")}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => addBlock("split_content", index, "text_form")}
                            className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold shrink-0 cursor-pointer flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[13px]">how_to_reg</span>
                            <span>Content + Form</span>
                          </button>
                        </div>
                      )}

                      {/* The Block Container */}
                      <div
                        onClick={() => setSelectedBlockId(block.id)}
                        className={`p-4 rounded-2xl transition-all border ${isSelected
                            ? "border-indigo-400 bg-indigo-50/15 shadow-sm ring-2 ring-indigo-500/10"
                            : "border-slate-200/90 hover:border-slate-300 bg-white"
                          }`}
                      >
                        {/* Block Header Control Bar */}
                        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-black uppercase text-[10px] tracking-wider">
                              {block.type.replace("_", " ")}
                            </span>
                            <span className="text-slate-400 text-[11px] font-mono">
                              #{index + 1}
                            </span>
                          </div>

                          {/* Action Buttons: Move Up, Move Down, Duplicate, Delete */}
                          <div className="flex items-center gap-1">
                            {/* Heading Level Pills if Heading */}
                            {block.type === "heading" && (
                              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg mr-2">
                                {([1, 2, 3] as const).map((lvl) => (
                                  <button
                                    key={lvl}
                                    type="button"
                                    onClick={() => updateBlock(block.id, { level: lvl })}
                                    className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${(block.level || 2) === lvl
                                        ? "bg-indigo-600 text-white"
                                        : "text-slate-600 hover:text-slate-900"
                                      }`}
                                  >
                                    H{lvl}
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Alert Tone Selector if Alert */}
                            {block.type === "alert" && (
                              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg mr-2">
                                {(["info", "tip", "warning", "alert"] as const).map(
                                  (t) => (
                                    <button
                                      key={t}
                                      type="button"
                                      onClick={() => updateBlock(block.id, { alertTone: t })}
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize cursor-pointer ${(block.alertTone || "info") === t
                                          ? "bg-slate-800 text-white"
                                          : "text-slate-600 hover:text-slate-900"
                                        }`}
                                    >
                                      {t}
                                    </button>
                                  )
                                )}
                              </div>
                            )}

                            {/* Split Config Switcher if Split Content */}
                            {block.type === "split_content" && (
                              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg mr-2 gap-0.5">
                                {(
                                  [
                                    { id: "image_text", label: "Img+Txt" },
                                    { id: "text_image", label: "Txt+Img" },
                                    { id: "text_text", label: "Txt+Txt" },
                                    { id: "text_form", label: "Txt+Form" },
                                    { id: "form_text", label: "Form+Txt" },
                                  ] as const
                                ).map((item) => (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() =>
                                      updateBlock(block.id, {
                                        splitConfig: {
                                          ...(block.splitConfig || {}),
                                          layoutType: item.id,
                                          formTitle: block.splitConfig?.formTitle || "Quick Loan Assessment & Registration",
                                          formSubtitle: block.splitConfig?.formSubtitle || "Enter student details for immediate eligibility evaluation & dedicated counselor callback.",
                                          formButtonText: block.splitConfig?.formButtonText || "Register & Check Eligibility",
                                          formRedirectUrl: block.splitConfig?.formRedirectUrl || "/apply-loan",
                                        },
                                      })
                                    }
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize cursor-pointer transition-all ${(block.splitConfig?.layoutType || "image_text") === item.id
                                        ? "bg-indigo-600 text-white shadow-xs"
                                        : "text-slate-600 hover:text-slate-900"
                                      }`}
                                  >
                                    {item.label}
                                  </button>
                                ))}
                              </div>
                            )}

                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => moveBlock(index, "up")}
                              className="w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center disabled:opacity-30 cursor-pointer"
                              title="Move Up"
                            >
                              <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
                            </button>
                            <button
                              type="button"
                              disabled={index === blocks.length - 1}
                              onClick={() => moveBlock(index, "down")}
                              className="w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center disabled:opacity-30 cursor-pointer"
                              title="Move Down"
                            >
                              <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => duplicateBlock(block, index)}
                              className="w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer"
                              title="Duplicate Block"
                            >
                              <span className="material-symbols-outlined text-[16px]">content_copy</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => removeBlock(block.id)}
                              className="w-7 h-7 rounded-lg hover:bg-rose-50 text-rose-500 flex items-center justify-center cursor-pointer"
                              title="Delete Block"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </div>
                        </div>

                        {/* SPECIFIC BLOCK CONTENT RENDERERS */}
                        {/* 1. HEADING */}
                        {block.type === "heading" && (
                          <input
                            type="text"
                            value={block.content}
                            onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                            placeholder="Enter Headline..."
                            className={`w-full font-black text-slate-900 border-0 focus:ring-0 focus:outline-none bg-transparent ${block.level === 1
                                ? "text-2xl md:text-3xl"
                                : block.level === 2
                                  ? "text-xl md:text-2xl"
                                  : "text-lg md:text-xl"
                              }`}
                          />
                        )}

                        {/* 2. TEXT (WITH INLINE FORMATTING TOOLBAR & FONTS) */}
                        {block.type === "text" && (
                          <div className="space-y-2">
                            {/* Rich Text & Font Styling Toolbar */}
                            <div className="flex items-center gap-1.5 p-1.5 bg-slate-50/90 rounded-xl border border-slate-200/80 flex-wrap">
                              {/* 1. Format / Preset Dropdown */}
                              <div className="relative">
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    saveSelection();
                                    setActiveFormatBlockId(activeFormatBlockId === block.id ? null : block.id);
                                    setActiveColorBlockId(null);
                                    setActiveHighlightBlockId(null);
                                    setActiveFontSizeBlockId(null);
                                    setActiveFontFamilyBlockId(null);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1 cursor-pointer shadow-2xs"
                                  title="Text Style Preset"
                                >
                                  <span>Style</span>
                                  <span className="material-symbols-outlined text-[14px]">arrow_drop_down</span>
                                </button>
                                {activeFormatBlockId === block.id && (
                                  <div
                                    onMouseDown={(e) => e.preventDefault()}
                                    className="absolute left-0 top-full mt-1 bg-white p-1.5 rounded-xl shadow-xl border border-slate-200 flex flex-col gap-1 z-30 min-w-[150px]"
                                  >
                                    {FORMAT_PRESETS.map((p) => (
                                      <button
                                        key={p.value}
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => applyBlockFormat(block.id, p.tag)}
                                        className="px-2.5 py-1 text-left text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg cursor-pointer"
                                      >
                                        {p.label}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* 2. Font Family Dropdown */}
                              <div className="relative">
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    saveSelection();
                                    setActiveFontFamilyBlockId(activeFontFamilyBlockId === block.id ? null : block.id);
                                    setActiveColorBlockId(null);
                                    setActiveHighlightBlockId(null);
                                    setActiveFontSizeBlockId(null);
                                    setActiveFormatBlockId(null);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1 cursor-pointer shadow-2xs"
                                  title="Font Family"
                                >
                                  <span>Font</span>
                                  <span className="material-symbols-outlined text-[14px]">font_download</span>
                                </button>
                                {activeFontFamilyBlockId === block.id && (
                                  <div
                                    onMouseDown={(e) => e.preventDefault()}
                                    className="absolute left-0 top-full mt-1 bg-white p-1.5 rounded-xl shadow-xl border border-slate-200 flex flex-col gap-1 z-30 min-w-[150px]"
                                  >
                                    {FONT_FAMILIES.map((f) => (
                                      <button
                                        key={f.value}
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => applyFontFamily(block.id, f.value)}
                                        className="px-2.5 py-1 text-left text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg cursor-pointer"
                                        style={{ fontFamily: f.value }}
                                      >
                                        {f.label}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* 3. Font Size Dropdown */}
                              <div className="relative">
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    saveSelection();
                                    setActiveFontSizeBlockId(activeFontSizeBlockId === block.id ? null : block.id);
                                    setActiveColorBlockId(null);
                                    setActiveHighlightBlockId(null);
                                    setActiveFontFamilyBlockId(null);
                                    setActiveFormatBlockId(null);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1 cursor-pointer shadow-2xs"
                                  title="Font Size"
                                >
                                  <span>Size</span>
                                  <span className="material-symbols-outlined text-[14px]">format_size</span>
                                </button>
                                {activeFontSizeBlockId === block.id && (
                                  <div
                                    onMouseDown={(e) => e.preventDefault()}
                                    className="absolute left-0 top-full mt-1 bg-white p-1.5 rounded-xl shadow-xl border border-slate-200 flex flex-col gap-1 z-30 min-w-[130px]"
                                  >
                                    {FONT_SIZES.map((s) => (
                                      <button
                                        key={s.value}
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => applyFontSize(block.id, s.value)}
                                        className="px-2.5 py-1 text-left text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg cursor-pointer"
                                      >
                                        {s.label}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="w-[1px] h-5 bg-slate-200 mx-0.5" />

                              {/* 4. Inline formatting: Bold, Italic, Underline, Strikethrough */}
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => applyInlineFormat("bold", "", block.id)}
                                className="w-7 h-7 rounded-lg hover:bg-white text-slate-700 font-black text-xs flex items-center justify-center transition-colors cursor-pointer border border-transparent hover:border-slate-200 shadow-2xs"
                                title="Bold (Ctrl+B)"
                              >
                                B
                              </button>
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => applyInlineFormat("italic", "", block.id)}
                                className="w-7 h-7 rounded-lg hover:bg-white text-slate-700 italic font-serif text-xs flex items-center justify-center transition-colors cursor-pointer border border-transparent hover:border-slate-200 shadow-2xs"
                                title="Italic (Ctrl+I)"
                              >
                                I
                              </button>
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => applyInlineFormat("underline", "", block.id)}
                                className="w-7 h-7 rounded-lg hover:bg-white text-slate-700 underline text-xs flex items-center justify-center transition-colors cursor-pointer border border-transparent hover:border-slate-200 shadow-2xs"
                                title="Underline (Ctrl+U)"
                              >
                                U
                              </button>
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => applyInlineFormat("strikeThrough", "", block.id)}
                                className="w-7 h-7 rounded-lg hover:bg-white text-slate-700 line-through text-xs flex items-center justify-center transition-colors cursor-pointer border border-transparent hover:border-slate-200 shadow-2xs"
                                title="Strikethrough"
                              >
                                S
                              </button>

                              <div className="w-[1px] h-5 bg-slate-200 mx-0.5" />

                              {/* 5. Text Color Picker */}
                              <div className="relative">
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    saveSelection();
                                    setActiveColorBlockId(activeColorBlockId === block.id ? null : block.id);
                                    setActiveHighlightBlockId(null);
                                    setActiveFontSizeBlockId(null);
                                    setActiveFontFamilyBlockId(null);
                                    setActiveFormatBlockId(null);
                                  }}
                                  className="px-2 py-1 rounded-lg hover:bg-white text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer border border-transparent hover:border-slate-200 shadow-2xs"
                                  title="Text Color"
                                >
                                  <span className="material-symbols-outlined text-[15px] text-indigo-600">format_color_text</span>
                                  <span className="w-2.5 h-2.5 rounded-full border border-slate-300" style={{ backgroundColor: block.style?.color || "#1e293b" }} />
                                </button>
                                {activeColorBlockId === block.id && (
                                  <div
                                    onMouseDown={(e) => e.preventDefault()}
                                    className="absolute left-0 top-full mt-1 bg-white p-2 rounded-xl shadow-xl border border-slate-200 grid grid-cols-4 gap-1.5 z-30 min-w-[150px]"
                                  >
                                    {TEXT_COLORS.map((c) => (
                                      <button
                                        key={c.name}
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => applyTextColor(block.id, c.color)}
                                        style={{ backgroundColor: c.bg }}
                                        className="w-6 h-6 rounded-lg border border-slate-300 hover:scale-110 transition-transform cursor-pointer"
                                        title={c.name}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* 6. Highlight Color Picker */}
                              <div className="relative">
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    saveSelection();
                                    setActiveHighlightBlockId(activeHighlightBlockId === block.id ? null : block.id);
                                    setActiveColorBlockId(null);
                                    setActiveFontSizeBlockId(null);
                                    setActiveFontFamilyBlockId(null);
                                    setActiveFormatBlockId(null);
                                  }}
                                  className="px-2 py-1 rounded-lg hover:bg-white text-amber-700 text-xs font-bold flex items-center gap-1 cursor-pointer border border-transparent hover:border-slate-200 shadow-2xs"
                                  title="Highlight Background"
                                >
                                  <span className="material-symbols-outlined text-[15px]">border_color</span>
                                </button>
                                {activeHighlightBlockId === block.id && (
                                  <div
                                    onMouseDown={(e) => e.preventDefault()}
                                    className="absolute left-0 top-full mt-1 bg-white p-2 rounded-xl shadow-xl border border-slate-200 flex flex-col gap-2 z-30"
                                  >
                                    <div className="flex items-center gap-1.5">
                                      {HIGHLIGHT_COLORS.map((h) => (
                                        <button
                                          key={h.name}
                                          type="button"
                                          onMouseDown={(e) => e.preventDefault()}
                                          onClick={() => applyHighlight(block.id, h.bg, h.text)}
                                          style={{ backgroundColor: h.bg }}
                                          className="w-6 h-6 rounded-full border border-slate-300 hover:scale-110 transition-transform cursor-pointer"
                                          title={h.name}
                                        />
                                      ))}
                                    </div>
                                    <button
                                      type="button"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => removeHighlight(block.id)}
                                      className="text-[11px] font-bold text-slate-500 hover:text-rose-600 text-center cursor-pointer"
                                    >
                                      Clear Highlight
                                    </button>
                                  </div>
                                )}
                              </div>

                              <div className="w-[1px] h-5 bg-slate-200 mx-0.5" />

                              {/* 7. Alignments: Left, Center, Right */}
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => applyInlineFormat("justifyLeft", "", block.id)}
                                className="w-7 h-7 rounded-lg hover:bg-white text-slate-700 flex items-center justify-center cursor-pointer transition-colors border border-transparent hover:border-slate-200 shadow-2xs"
                                title="Align Left"
                              >
                                <span className="material-symbols-outlined text-[15px]">format_align_left</span>
                              </button>
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => applyInlineFormat("justifyCenter", "", block.id)}
                                className="w-7 h-7 rounded-lg hover:bg-white text-slate-700 flex items-center justify-center cursor-pointer transition-colors border border-transparent hover:border-slate-200 shadow-2xs"
                                title="Align Center"
                              >
                                <span className="material-symbols-outlined text-[15px]">format_align_center</span>
                              </button>
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => applyInlineFormat("justifyRight", "", block.id)}
                                className="w-7 h-7 rounded-lg hover:bg-white text-slate-700 flex items-center justify-center cursor-pointer transition-colors border border-transparent hover:border-slate-200 shadow-2xs"
                                title="Align Right"
                              >
                                <span className="material-symbols-outlined text-[15px]">format_align_right</span>
                              </button>

                              <div className="w-[1px] h-5 bg-slate-200 mx-0.5" />

                              {/* 8. Lists: Bullets and Numbers */}
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => applyInlineFormat("insertUnorderedList", "", block.id)}
                                className="w-7 h-7 rounded-lg hover:bg-white text-slate-700 flex items-center justify-center cursor-pointer transition-colors border border-transparent hover:border-slate-200 shadow-2xs"
                                title="Bullet List"
                              >
                                <span className="material-symbols-outlined text-[15px]">format_list_bulleted</span>
                              </button>
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => applyInlineFormat("insertOrderedList", "", block.id)}
                                className="w-7 h-7 rounded-lg hover:bg-white text-slate-700 flex items-center justify-center cursor-pointer transition-colors border border-transparent hover:border-slate-200 shadow-2xs"
                                title="Numbered List"
                              >
                                <span className="material-symbols-outlined text-[15px]">format_list_numbered</span>
                              </button>

                              <div className="w-[1px] h-5 bg-slate-200 mx-0.5" />

                              {/* 9. Hyperlink */}
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  saveSelection();
                                  const sel = window.getSelection();
                                  setLinkModalText(sel ? sel.toString() : "");
                                  setLinkModalBlockId(block.id);
                                  setLinkModalOpen(true);
                                }}
                                className="px-2 py-1 rounded-lg hover:bg-white text-indigo-600 text-xs font-bold flex items-center gap-1 cursor-pointer border border-transparent hover:border-slate-200 shadow-2xs"
                                title="Insert Link"
                              >
                                <span className="material-symbols-outlined text-[14px]">link</span>
                                <span>Link</span>
                              </button>

                              {/* 10. Clean Format */}
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => cleanBlockFormatting(block.id)}
                                className="px-2 py-1 rounded-lg hover:bg-white text-slate-600 text-xs font-bold flex items-center gap-1 cursor-pointer border border-transparent hover:border-slate-200 shadow-2xs"
                                title="Clean formatting & remove dark overrides"
                              >
                                <span className="material-symbols-outlined text-[14px]">format_clear</span>
                                <span>Clean</span>
                              </button>
                            </div>

                            {/* Direct Rich Text WYSIWYG Editor Block with Cursor Protection */}
                            <RichTextBlock
                              block={block}
                              onUpdateContent={(content) => updateBlock(block.id, { content })}
                              onPaste={(e) => handleCleanPaste(e, block.id)}
                              registerRef={(el) => {
                                editorRefs.current[block.id] = el;
                              }}
                              onSaveSelection={saveSelection}
                            />
                          </div>
                        )}

                        {/* 3. SPLIT 2-COLUMN */}
                        {block.type === "split_content" && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50/70 rounded-2xl border border-slate-200">
                            {/* Left Column Config */}
                            <div className="space-y-3">
                              <span className="text-[10px] font-black uppercase text-indigo-600 block">
                                Left Column {block.splitConfig?.layoutType === "form_text" ? "(Registration Form)" : block.splitConfig?.layoutType === "image_text" ? "(Photo)" : "(Editorial Content)"}
                              </span>
                              {block.splitConfig?.layoutType === "image_text" ? (
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    value={block.splitConfig?.leftImageUrl || ""}
                                    onChange={(e) =>
                                      updateBlock(block.id, {
                                        splitConfig: {
                                          ...(block.splitConfig || { layoutType: "image_text" }),
                                          leftImageUrl: e.target.value,
                                        },
                                      })
                                    }
                                    placeholder="Left Image URL..."
                                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono"
                                  />
                                  <div className="aspect-video bg-slate-200 rounded-xl overflow-hidden">
                                    <img
                                      src={block.splitConfig?.leftImageUrl || CURATED_COVERS[0].url}
                                      alt="Preview"
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                  <input
                                    type="text"
                                    value={block.splitConfig?.leftImageCaption || ""}
                                    onChange={(e) =>
                                      updateBlock(block.id, {
                                        splitConfig: {
                                          ...(block.splitConfig || { layoutType: "image_text" }),
                                          leftImageCaption: e.target.value,
                                        },
                                      })
                                    }
                                    placeholder="Photo Caption..."
                                    className="w-full px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                                  />
                                </div>
                              ) : block.splitConfig?.layoutType === "form_text" ? (
                                <div className="space-y-3 bg-white p-4 rounded-xl border border-indigo-100 shadow-2xs">
                                  <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                                    <span className="text-xs font-black uppercase text-indigo-700 flex items-center gap-1">
                                      <span className="material-symbols-outlined text-sm">how_to_reg</span>
                                      Lead Registration Form
                                    </span>
                                    <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                                      Interactive
                                    </span>
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Form Header Title</label>
                                    <input
                                      type="text"
                                      value={block.splitConfig?.formTitle || "Quick Loan Assessment & Registration"}
                                      onChange={(e) =>
                                        updateBlock(block.id, {
                                          splitConfig: {
                                            ...(block.splitConfig || { layoutType: "form_text" }),
                                            formTitle: e.target.value,
                                          },
                                        })
                                      }
                                      placeholder="Form Title..."
                                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Form Subtitle</label>
                                    <input
                                      type="text"
                                      value={block.splitConfig?.formSubtitle || "Enter student details for immediate eligibility evaluation & callback."}
                                      onChange={(e) =>
                                        updateBlock(block.id, {
                                          splitConfig: {
                                            ...(block.splitConfig || { layoutType: "form_text" }),
                                            formSubtitle: e.target.value,
                                          },
                                        })
                                      }
                                      placeholder="Form Subtitle..."
                                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-[10px] font-bold text-slate-500 uppercase">Button Text</label>
                                      <input
                                        type="text"
                                        value={block.splitConfig?.formButtonText || "Register & Check Eligibility"}
                                        onChange={(e) =>
                                          updateBlock(block.id, {
                                            splitConfig: {
                                              ...(block.splitConfig || { layoutType: "form_text" }),
                                              formButtonText: e.target.value,
                                            },
                                          })
                                        }
                                        placeholder="Button Text..."
                                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-bold text-slate-500 uppercase">Action Route</label>
                                      <input
                                        type="text"
                                        value={block.splitConfig?.formRedirectUrl || "/apply-loan"}
                                        onChange={(e) =>
                                          updateBlock(block.id, {
                                            splitConfig: {
                                              ...(block.splitConfig || { layoutType: "form_text" }),
                                              formRedirectUrl: e.target.value,
                                            },
                                          })
                                        }
                                        placeholder="/apply-loan"
                                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                                      />
                                    </div>
                                  </div>
                                  {/* Form Mockup Preview */}
                                  <div className="p-3 bg-gradient-to-br from-indigo-50/50 to-purple-50/30 rounded-xl border border-indigo-100/80 space-y-2 mt-2">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                                      Form Preview:
                                    </span>
                                    <div className="space-y-1.5 opacity-80 pointer-events-none">
                                      <input disabled placeholder="Student Full Name" className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs" />
                                      <input disabled placeholder="Mobile / WhatsApp Number (+91)" className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs" />
                                      <div className="grid grid-cols-2 gap-1.5">
                                        <select disabled className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-500">
                                          <option>Target Country: USA / UK / Canada</option>
                                        </select>
                                        <select disabled className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-500">
                                          <option>Loan: ₹20L - ₹50L</option>
                                        </select>
                                      </div>
                                      <div className="w-full py-2 bg-indigo-600 text-white font-bold rounded-lg text-xs text-center shadow-xs">
                                        {block.splitConfig?.formButtonText || "Register & Check Eligibility"} &rarr;
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    value={block.splitConfig?.leftTitle || ""}
                                    onChange={(e) =>
                                      updateBlock(block.id, {
                                        splitConfig: {
                                          ...(block.splitConfig || { layoutType: "text_text" }),
                                          leftTitle: e.target.value,
                                        },
                                      })
                                    }
                                    placeholder="Left Column Title..."
                                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                                  />
                                  <textarea
                                    rows={3}
                                    value={block.splitConfig?.leftContent || ""}
                                    onChange={(e) =>
                                      updateBlock(block.id, {
                                        splitConfig: {
                                          ...(block.splitConfig || { layoutType: "text_text" }),
                                          leftContent: e.target.value,
                                        },
                                      })
                                    }
                                    placeholder="Left Column Content..."
                                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
                                  />
                                  <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                                      Key Highlights (one per line):
                                    </span>
                                    <textarea
                                      rows={2}
                                      value={(block.splitConfig?.leftItems || []).join("\n")}
                                      onChange={(e) =>
                                        updateBlock(block.id, {
                                          splitConfig: {
                                            ...(block.splitConfig || { layoutType: "text_form" }),
                                            leftItems: e.target.value.split("\n").filter(Boolean),
                                          },
                                        })
                                      }
                                      placeholder="Benefit 1&#10;Benefit 2"
                                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Right Column Config */}
                            <div className="space-y-3">
                              <span className="text-[10px] font-black uppercase text-purple-600 block">
                                Right Column {block.splitConfig?.layoutType === "text_form" ? "(Registration Form)" : block.splitConfig?.layoutType === "text_image" ? "(Photo)" : "(Editorial Content)"}
                              </span>
                              {block.splitConfig?.layoutType === "text_form" ? (
                                <div className="space-y-3 bg-white p-4 rounded-xl border border-indigo-100 shadow-2xs">
                                  <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                                    <span className="text-xs font-black uppercase text-indigo-700 flex items-center gap-1">
                                      <span className="material-symbols-outlined text-sm">how_to_reg</span>
                                      Lead Registration Form
                                    </span>
                                    <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                                      Interactive
                                    </span>
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Form Header Title</label>
                                    <input
                                      type="text"
                                      value={block.splitConfig?.formTitle || "Quick Loan Assessment & Registration"}
                                      onChange={(e) =>
                                        updateBlock(block.id, {
                                          splitConfig: {
                                            ...(block.splitConfig || { layoutType: "text_form" }),
                                            formTitle: e.target.value,
                                          },
                                        })
                                      }
                                      placeholder="Form Title..."
                                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Form Subtitle</label>
                                    <input
                                      type="text"
                                      value={block.splitConfig?.formSubtitle || "Enter student details for immediate eligibility evaluation & callback."}
                                      onChange={(e) =>
                                        updateBlock(block.id, {
                                          splitConfig: {
                                            ...(block.splitConfig || { layoutType: "text_form" }),
                                            formSubtitle: e.target.value,
                                          },
                                        })
                                      }
                                      placeholder="Form Subtitle..."
                                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-[10px] font-bold text-slate-500 uppercase">Button Text</label>
                                      <input
                                        type="text"
                                        value={block.splitConfig?.formButtonText || "Register & Check Eligibility"}
                                        onChange={(e) =>
                                          updateBlock(block.id, {
                                            splitConfig: {
                                              ...(block.splitConfig || { layoutType: "text_form" }),
                                              formButtonText: e.target.value,
                                            },
                                          })
                                        }
                                        placeholder="Button Text..."
                                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-bold text-slate-500 uppercase">Action Route</label>
                                      <input
                                        type="text"
                                        value={block.splitConfig?.formRedirectUrl || "/apply-loan"}
                                        onChange={(e) =>
                                          updateBlock(block.id, {
                                            splitConfig: {
                                              ...(block.splitConfig || { layoutType: "text_form" }),
                                              formRedirectUrl: e.target.value,
                                            },
                                          })
                                        }
                                        placeholder="/apply-loan"
                                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                                      />
                                    </div>
                                  </div>
                                  {/* Form Mockup Preview */}
                                  <div className="p-3 bg-gradient-to-br from-indigo-50/50 to-purple-50/30 rounded-xl border border-indigo-100/80 space-y-2 mt-2">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                                      Form Preview:
                                    </span>
                                    <div className="space-y-1.5 opacity-80 pointer-events-none">
                                      <input disabled placeholder="Student Full Name" className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs" />
                                      <input disabled placeholder="Mobile / WhatsApp Number (+91)" className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs" />
                                      <div className="grid grid-cols-2 gap-1.5">
                                        <select disabled className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-500">
                                          <option>Target Country: USA / UK / Canada</option>
                                        </select>
                                        <select disabled className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-500">
                                          <option>Loan: ₹20L - ₹50L</option>
                                        </select>
                                      </div>
                                      <div className="w-full py-2 bg-indigo-600 text-white font-bold rounded-lg text-xs text-center shadow-xs">
                                        {block.splitConfig?.formButtonText || "Register & Check Eligibility"} &rarr;
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : block.splitConfig?.layoutType === "text_image" ? (
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    value={block.splitConfig?.rightImageUrl || ""}
                                    onChange={(e) =>
                                      updateBlock(block.id, {
                                        splitConfig: {
                                          ...(block.splitConfig || { layoutType: "text_image" }),
                                          rightImageUrl: e.target.value,
                                        },
                                      })
                                    }
                                    placeholder="Right Image URL..."
                                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono"
                                  />
                                  <div className="aspect-video bg-slate-200 rounded-xl overflow-hidden">
                                    <img
                                      src={block.splitConfig?.rightImageUrl || CURATED_COVERS[0].url}
                                      alt="Preview"
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                  <input
                                    type="text"
                                    value={block.splitConfig?.rightImageCaption || ""}
                                    onChange={(e) =>
                                      updateBlock(block.id, {
                                        splitConfig: {
                                          ...(block.splitConfig || { layoutType: "text_image" }),
                                          rightImageCaption: e.target.value,
                                        },
                                      })
                                    }
                                    placeholder="Photo Caption..."
                                    className="w-full px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                                  />
                                </div>
                              ) : (
                                <>
                                  <input
                                    type="text"
                                    value={block.splitConfig?.rightTitle || ""}
                                    onChange={(e) =>
                                      updateBlock(block.id, {
                                        splitConfig: {
                                          ...(block.splitConfig || { layoutType: "image_text" }),
                                          rightTitle: e.target.value,
                                        },
                                      })
                                    }
                                    placeholder="Right Column Title..."
                                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                                  />
                                  <textarea
                                    rows={3}
                                    value={block.splitConfig?.rightContent || ""}
                                    onChange={(e) =>
                                      updateBlock(block.id, {
                                        splitConfig: {
                                          ...(block.splitConfig || { layoutType: "image_text" }),
                                          rightContent: e.target.value,
                                        },
                                      })
                                    }
                                    placeholder="Right Column Content..."
                                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
                                  />

                                  <div className="space-y-1.5">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                                      Bullet Points (one per line):
                                    </span>
                                    <textarea
                                      rows={2}
                                      value={(block.splitConfig?.rightItems || []).join("\n")}
                                      onChange={(e) =>
                                        updateBlock(block.id, {
                                          splitConfig: {
                                            ...(block.splitConfig || { layoutType: "image_text" }),
                                            rightItems: e.target.value.split("\n").filter(Boolean),
                                          },
                                        })
                                      }
                                      placeholder="Bullet 1&#10;Bullet 2"
                                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
                                    />
                                  </div>

                                  <div className="grid grid-cols-2 gap-2 pt-1">
                                    <input
                                      type="text"
                                      value={block.splitConfig?.buttonText || ""}
                                      onChange={(e) =>
                                        updateBlock(block.id, {
                                          splitConfig: {
                                            ...(block.splitConfig || { layoutType: "image_text" }),
                                            buttonText: e.target.value,
                                          },
                                        })
                                      }
                                      placeholder="CTA Button Text"
                                      className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                                    />
                                    <input
                                      type="text"
                                      value={block.splitConfig?.buttonUrl || ""}
                                      onChange={(e) =>
                                        updateBlock(block.id, {
                                          splitConfig: {
                                            ...(block.splitConfig || { layoutType: "image_text" }),
                                            buttonUrl: e.target.value,
                                          },
                                        })
                                      }
                                      placeholder="/apply-loan or URL"
                                      className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                                    />
                                  </div>

                                  {block.splitConfig?.buttonText && (
                                    <div className="pt-1">
                                      <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl text-xs shadow-md">
                                        <span>{block.splitConfig.buttonText}</span>
                                        <span>&rarr;</span>
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 4. DATA TABLE (COMPLETELY DYNAMIC) */}
                        {block.type === "table" && (() => {
                          const td = block.tableData || {
                            headers: ["Feature / Parameter", "Public Sector Banks", "Private NBFCs"],
                            rows: [
                              ["Collateral-Free Limit", "Up to ₹7.5 Lakhs", "Up to ₹75 Lakhs"],
                              ["Interest Rate Range", "8.25% - 9.50%", "9.75% - 11.50%"],
                              ["Turnaround Time", "15 - 25 Days", "3 - 5 Days"],
                            ],
                            hasHeader: true,
                            isStriped: true,
                          };

                          const headers = Array.isArray(td.headers) && td.headers.length > 0 ? td.headers : ["Column 1", "Column 2"];
                          const rows = Array.isArray(td.rows) ? td.rows : [["", ""]];
                          const hasHeader = td.hasHeader !== false;
                          const isStriped = !!td.isStriped;

                          const addColumn = (insertAfterIdx?: number) => {
                            const newColName = `Column ${headers.length + 1}`;
                            let newHeaders: string[];
                            let newRows: string[][];

                            if (typeof insertAfterIdx === "number" && insertAfterIdx >= 0) {
                              newHeaders = [...headers];
                              newHeaders.splice(insertAfterIdx + 1, 0, newColName);
                              newRows = rows.map((r) => {
                                const newR = Array.isArray(r) ? [...r] : [];
                                newR.splice(insertAfterIdx + 1, 0, "");
                                return newR;
                              });
                            } else {
                              newHeaders = [...headers, newColName];
                              newRows = rows.map((r) => [...(Array.isArray(r) ? r : []), ""]);
                            }

                            updateBlock(block.id, {
                              tableData: { ...td, headers: newHeaders, rows: newRows },
                            });
                          };

                          const removeColumn = (colIdx: number) => {
                            if (headers.length <= 1) {
                              alert("Table must have at least 1 column.");
                              return;
                            }
                            const newHeaders = headers.filter((_, idx) => idx !== colIdx);
                            const newRows = rows.map((r) => (Array.isArray(r) ? r.filter((_, idx) => idx !== colIdx) : []));
                            updateBlock(block.id, {
                              tableData: { ...td, headers: newHeaders, rows: newRows },
                            });
                          };

                          const moveColumn = (colIdx: number, direction: "left" | "right") => {
                            const targetIdx = direction === "left" ? colIdx - 1 : colIdx + 1;
                            if (targetIdx < 0 || targetIdx >= headers.length) return;
                            const newHeaders = [...headers];
                            const tempH = newHeaders[colIdx];
                            newHeaders[colIdx] = newHeaders[targetIdx];
                            newHeaders[targetIdx] = tempH;

                            const newRows = rows.map((r) => {
                              const newR = Array.isArray(r) ? [...r] : [];
                              while (newR.length < headers.length) newR.push("");
                              const tempC = newR[colIdx];
                              newR[colIdx] = newR[targetIdx];
                              newR[targetIdx] = tempC;
                              return newR;
                            });

                            updateBlock(block.id, {
                              tableData: { ...td, headers: newHeaders, rows: newRows },
                            });
                          };

                          const addRow = (insertIdx?: number) => {
                            const newRow = new Array(headers.length).fill("");
                            const newRows = [...rows];
                            if (typeof insertIdx === "number") {
                              newRows.splice(insertIdx + 1, 0, newRow);
                            } else {
                              newRows.push(newRow);
                            }
                            updateBlock(block.id, {
                              tableData: { ...td, rows: newRows },
                            });
                          };

                          const duplicateRow = (rIdx: number) => {
                            const source = Array.isArray(rows[rIdx]) ? [...rows[rIdx]] : new Array(headers.length).fill("");
                            const newRows = [...rows];
                            newRows.splice(rIdx + 1, 0, source);
                            updateBlock(block.id, {
                              tableData: { ...td, rows: newRows },
                            });
                          };

                          const removeRow = (rIdx: number) => {
                            if (rows.length <= 1) {
                              alert("Table must have at least 1 row.");
                              return;
                            }
                            const newRows = rows.filter((_, idx) => idx !== rIdx);
                            updateBlock(block.id, {
                              tableData: { ...td, rows: newRows },
                            });
                          };

                          const moveRow = (rIdx: number, direction: "up" | "down") => {
                            const targetIdx = direction === "up" ? rIdx - 1 : rIdx + 1;
                            if (targetIdx < 0 || targetIdx >= rows.length) return;
                            const newRows = [...rows];
                            const temp = newRows[rIdx];
                            newRows[rIdx] = newRows[targetIdx];
                            newRows[targetIdx] = temp;
                            updateBlock(block.id, {
                              tableData: { ...td, rows: newRows },
                            });
                          };

                          const applyPreset = (preset: "comparison" | "fees" | "eligibility" | "documents") => {
                            if (preset === "comparison") {
                              updateBlock(block.id, {
                                tableData: {
                                  headers: ["Lender / Bank", "Max Collateral-Free", "Floating Rate", "Sanction Speed"],
                                  rows: [
                                    ["HDFC Credila", "Up to ₹75 Lakhs", "9.75% - 11.25%", "3 - 5 Working Days"],
                                    ["IDFC FIRST Bank", "Up to ₹50 Lakhs", "9.25% - 10.50%", "48-Hour Fast Track"],
                                    ["Avanse Financial", "Up to ₹75 Lakhs", "10.25% - 12.00%", "3 Working Days"],
                                    ["SBI Global Ed-Vantage", "Up to ₹1.5 Cr (Secured)", "8.50% - 9.15%", "10 - 14 Days"],
                                  ],
                                  hasHeader: true,
                                  isStriped: true,
                                },
                              });
                            } else if (preset === "fees") {
                              updateBlock(block.id, {
                                tableData: {
                                  headers: ["Fee Component", "Public Sector Banks", "Private NBFCs", "VidyaLoan Advantage"],
                                  rows: [
                                    ["Processing Fee", "1.0% - 1.5%", "1.5% - 2.0%", "Up to 50% Concession"],
                                    ["Origination Charges", "Nil", "₹5,000 - ₹10,000", "Zero Upfront"],
                                    ["Prepayment Penalty", "0% (Floating Rate)", "0% (Float)", "Zero Charges"],
                                  ],
                                  hasHeader: true,
                                  isStriped: true,
                                },
                              });
                            } else if (preset === "eligibility") {
                              updateBlock(block.id, {
                                tableData: {
                                  headers: ["Eligibility Criterion", "Mandatory Requirement", "Acceptable Alternatives"],
                                  rows: [
                                    ["Target Country", "US, UK, Canada, Australia, Germany, Ireland", "All top-500 global ranked institutions"],
                                    ["Co-Applicant Income", "Minimum ₹35,000 / month salary", "ITR returns with 2-year profit statements"],
                                    ["Academic Baseline", "Minimum 55% in undergraduate degree", "GRE > 300 or relevant work experience"],
                                  ],
                                  hasHeader: true,
                                  isStriped: true,
                                },
                              });
                            } else {
                              updateBlock(block.id, {
                                tableData: {
                                  headers: ["Document Name", "Primary Student", "Salaried Co-Applicant", "Self-Employed Co-Applicant"],
                                  rows: [
                                    ["Proof of Identity & Address", "Aadhaar Card / Passport", "Aadhaar Card / Voter ID", "Aadhaar Card / Passport"],
                                    ["Academic Transcripts", "10th, 12th, Degree Marksheets", "N/A", "N/A"],
                                    ["Admission Offer Letter", "Conditional / Unconditional I-20", "N/A", "N/A"],
                                    ["Income Proof", "N/A", "Last 3 Months Salary Slips", "2 Years ITR with Computation"],
                                    ["Bank Statement", "Savings Account (6 Months)", "Salary Account (6 Months)", "Current Account (12 Months)"],
                                  ],
                                  hasHeader: true,
                                  isStriped: true,
                                },
                              });
                            }
                          };

                          return (
                            <div className="space-y-3.5 p-4 bg-slate-50/70 rounded-2xl border border-slate-200">
                              {/* Table Controls Toolbar */}
                              <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-slate-200/80">
                                <div className="flex items-center gap-2">
                                  <span className="material-symbols-outlined text-indigo-600 text-[18px]">table_chart</span>
                                  <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                                    Dynamic Data Grid ({headers.length} Cols × {rows.length} Rows)
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {/* Toggle Header */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateBlock(block.id, {
                                        tableData: { ...td, hasHeader: !hasHeader },
                                      })
                                    }
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${hasHeader
                                        ? "bg-indigo-600 text-white shadow-2xs"
                                        : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                      }`}
                                  >
                                    Header Row: {hasHeader ? "ON" : "OFF"}
                                  </button>

                                  {/* Toggle Striped */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateBlock(block.id, {
                                        tableData: { ...td, isStriped: !isStriped },
                                      })
                                    }
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${isStriped
                                        ? "bg-purple-600 text-white shadow-2xs"
                                        : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                      }`}
                                  >
                                    Zebra Stripes: {isStriped ? "ON" : "OFF"}
                                  </button>

                                  {/* Add Column */}
                                  <button
                                    type="button"
                                    onClick={() => addColumn()}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs cursor-pointer"
                                    title="Add column at the end"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">add</span>
                                    <span>Add Column</span>
                                  </button>

                                  {/* Add Row */}
                                  <button
                                    type="button"
                                    onClick={() => addRow()}
                                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs cursor-pointer"
                                    title="Add row at the end"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">add</span>
                                    <span>Add Row</span>
                                  </button>

                                  {/* Presets */}
                                  <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Presets:</span>
                                    <button
                                      type="button"
                                      onClick={() => applyPreset("comparison")}
                                      className="px-2 py-0.5 bg-white border border-slate-200 hover:bg-indigo-50 text-[11px] font-bold text-slate-700 rounded cursor-pointer"
                                      title="Load Bank Comparison template"
                                    >
                                      Comparison
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => applyPreset("fees")}
                                      className="px-2 py-0.5 bg-white border border-slate-200 hover:bg-indigo-50 text-[11px] font-bold text-slate-700 rounded cursor-pointer"
                                      title="Load Fees Breakdown template"
                                    >
                                      Fees
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => applyPreset("eligibility")}
                                      className="px-2 py-0.5 bg-white border border-slate-200 hover:bg-indigo-50 text-[11px] font-bold text-slate-700 rounded cursor-pointer"
                                      title="Load Eligibility Criteria template"
                                    >
                                      Eligibility
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => applyPreset("documents")}
                                      className="px-2 py-0.5 bg-white border border-slate-200 hover:bg-indigo-50 text-[11px] font-bold text-slate-700 rounded cursor-pointer"
                                      title="Load Document Checklist template"
                                    >
                                      Documents
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Interactive Responsive Grid Table */}
                              <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-2xs">
                                <table className="min-w-full text-left border-collapse text-xs">
                                  {hasHeader ? (
                                    <thead>
                                      <tr className="bg-slate-100 border-b border-slate-200">
                                        <th className="w-12 px-3 py-2 text-[10px] font-mono text-slate-400 text-center uppercase tracking-wider">
                                          #
                                        </th>
                                        {headers.map((h, colIdx) => (
                                          <th key={colIdx} className="p-2 border-r border-slate-200 last:border-r-0 min-w-[150px] group/col">
                                            <div className="flex items-center gap-1.5">
                                              <input
                                                type="text"
                                                value={h}
                                                onChange={(e) => {
                                                  const newH = [...headers];
                                                  newH[colIdx] = e.target.value;
                                                  updateBlock(block.id, {
                                                    tableData: { ...td, headers: newH },
                                                  });
                                                }}
                                                placeholder={`Header ${colIdx + 1}`}
                                                className="flex-1 bg-white font-black text-slate-900 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 px-2 py-1 rounded text-xs"
                                              />

                                              {/* Column Controls: Move Left, Move Right, Insert Right, Remove */}
                                              <div className="flex items-center gap-0.5">
                                                <button
                                                  type="button"
                                                  disabled={colIdx === 0}
                                                  onClick={() => moveColumn(colIdx, "left")}
                                                  className="w-5 h-5 rounded hover:bg-slate-200 text-slate-500 flex items-center justify-center disabled:opacity-20 cursor-pointer"
                                                  title="Move column left"
                                                >
                                                  ‹
                                                </button>
                                                <button
                                                  type="button"
                                                  disabled={colIdx === headers.length - 1}
                                                  onClick={() => moveColumn(colIdx, "right")}
                                                  className="w-5 h-5 rounded hover:bg-slate-200 text-slate-500 flex items-center justify-center disabled:opacity-20 cursor-pointer"
                                                  title="Move column right"
                                                >
                                                  ›
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => addColumn(colIdx)}
                                                  className="w-5 h-5 rounded bg-emerald-50 hover:bg-emerald-600 text-emerald-600 hover:text-white flex items-center justify-center text-[10px] font-bold transition-colors cursor-pointer"
                                                  title="Insert column to the right"
                                                >
                                                  +
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => removeColumn(colIdx)}
                                                  className="w-5 h-5 rounded bg-rose-50 hover:bg-rose-600 text-rose-500 hover:text-white flex items-center justify-center text-[11px] font-bold transition-colors cursor-pointer"
                                                  title={`Remove column: "${h}"`}
                                                >
                                                  ✕
                                                </button>
                                              </div>
                                            </div>
                                          </th>
                                        ))}
                                        <th className="w-20 p-2 text-center text-[10px] font-mono text-slate-400 uppercase">
                                          Actions
                                        </th>
                                      </tr>
                                    </thead>
                                  ) : (
                                    /* Always show a lightweight column management strip so columns can still be added/removed when header is OFF */
                                    <thead>
                                      <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="w-12 px-2 py-1 text-[9px] font-mono text-slate-400 text-center uppercase tracking-wider">
                                          Col
                                        </th>
                                        {headers.map((h, colIdx) => (
                                          <th key={colIdx} className="p-1.5 border-r border-slate-200 last:border-r-0 min-w-[150px]">
                                            <div className="flex items-center justify-between gap-1 text-[11px] text-slate-600 font-semibold px-1">
                                              <span className="truncate" title={h}>Col {colIdx + 1} ({h || "Untitled"})</span>
                                              <div className="flex items-center gap-0.5">
                                                <button
                                                  type="button"
                                                  disabled={colIdx === 0}
                                                  onClick={() => moveColumn(colIdx, "left")}
                                                  className="w-4 h-4 rounded hover:bg-slate-200 text-slate-500 flex items-center justify-center disabled:opacity-20 cursor-pointer text-[10px]"
                                                  title="Move column left"
                                                >
                                                  ‹
                                                </button>
                                                <button
                                                  type="button"
                                                  disabled={colIdx === headers.length - 1}
                                                  onClick={() => moveColumn(colIdx, "right")}
                                                  className="w-4 h-4 rounded hover:bg-slate-200 text-slate-500 flex items-center justify-center disabled:opacity-20 cursor-pointer text-[10px]"
                                                  title="Move column right"
                                                >
                                                  ›
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => addColumn(colIdx)}
                                                  className="w-4 h-4 rounded bg-emerald-50 hover:bg-emerald-600 text-emerald-600 hover:text-white flex items-center justify-center text-[9px] font-bold cursor-pointer"
                                                  title="Insert column"
                                                >
                                                  +
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => removeColumn(colIdx)}
                                                  className="w-4 h-4 rounded bg-rose-50 hover:bg-rose-600 text-rose-500 hover:text-white flex items-center justify-center text-[9px] font-bold cursor-pointer"
                                                  title="Remove column"
                                                >
                                                  ✕
                                                </button>
                                              </div>
                                            </div>
                                          </th>
                                        ))}
                                        <th className="w-20 p-1 text-center text-[9px] font-mono text-slate-400">
                                          (No Header)
                                        </th>
                                      </tr>
                                    </thead>
                                  )}

                                  <tbody>
                                    {rows.map((row, rIdx) => {
                                      const rowBg = isStriped && rIdx % 2 === 1 ? "bg-slate-50/70" : "bg-white";
                                      return (
                                        <tr key={rIdx} className={`${rowBg} hover:bg-indigo-50/20 border-b border-slate-100 last:border-b-0 transition-colors group/row`}>
                                          {/* Row Index Badge */}
                                          <td className="px-3 py-2 text-center text-[11px] font-mono text-slate-400 font-bold">
                                            {rIdx + 1}
                                          </td>

                                          {/* Row Cells */}
                                          {headers.map((_, colIdx) => {
                                            const cellVal = Array.isArray(row) && row[colIdx] !== undefined ? row[colIdx] : "";
                                            return (
                                              <td key={colIdx} className="p-2 border-r border-slate-100 last:border-r-0">
                                                <input
                                                  type="text"
                                                  value={cellVal}
                                                  onChange={(e) => {
                                                    const newRows = rows.map((r, i) => {
                                                      if (i !== rIdx) return Array.isArray(r) ? [...r] : [];
                                                      const updatedRow = Array.isArray(r) ? [...r] : [];
                                                      while (updatedRow.length < headers.length) updatedRow.push("");
                                                      updatedRow[colIdx] = e.target.value;
                                                      return updatedRow;
                                                    });
                                                    updateBlock(block.id, {
                                                      tableData: { ...td, rows: newRows },
                                                    });
                                                  }}
                                                  placeholder="Enter data..."
                                                  className="w-full bg-transparent hover:bg-white focus:bg-white text-slate-800 font-medium border border-transparent hover:border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 px-2 py-1 rounded text-xs transition-colors"
                                                />
                                              </td>
                                            );
                                          })}

                                          {/* Row Action Buttons: Move Up, Move Down, Insert Below, Duplicate, Delete */}
                                          <td className="p-2 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                              <button
                                                type="button"
                                                disabled={rIdx === 0}
                                                onClick={() => moveRow(rIdx, "up")}
                                                className="w-5 h-5 rounded hover:bg-slate-200 text-slate-500 flex items-center justify-center disabled:opacity-20 cursor-pointer text-[10px]"
                                                title="Move row up"
                                              >
                                                ▲
                                              </button>
                                              <button
                                                type="button"
                                                disabled={rIdx === rows.length - 1}
                                                onClick={() => moveRow(rIdx, "down")}
                                                className="w-5 h-5 rounded hover:bg-slate-200 text-slate-500 flex items-center justify-center disabled:opacity-20 cursor-pointer text-[10px]"
                                                title="Move row down"
                                              >
                                                ▼
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => addRow(rIdx)}
                                                className="w-5 h-5 rounded bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white flex items-center justify-center text-[10px] font-bold cursor-pointer"
                                                title="Insert row below"
                                              >
                                                +
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => duplicateRow(rIdx)}
                                                className="w-5 h-5 rounded bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white flex items-center justify-center text-[9px] font-bold cursor-pointer"
                                                title="Duplicate row"
                                              >
                                                ⎘
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => removeRow(rIdx)}
                                                className="w-5 h-5 rounded bg-rose-50 hover:bg-rose-600 text-rose-500 hover:text-white flex items-center justify-center text-[10px] font-bold transition-colors cursor-pointer"
                                                title={`Remove row #${rIdx + 1}`}
                                              >
                                                ✕
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })()}

                        {/* 5. TABLE OF CONTENTS */}
                        {block.type === "table_of_contents" && (
                          <div className="p-4 bg-gradient-to-br from-indigo-50/50 to-slate-50 rounded-2xl border border-indigo-100 space-y-2">
                            <input
                              type="text"
                              value={block.title || "Table of Contents"}
                              onChange={(e) => updateBlock(block.id, { title: e.target.value })}
                              className="font-bold text-sm text-indigo-900 bg-transparent border-0 focus:ring-0 p-0"
                            />
                            <div className="space-y-1 pt-1">
                              {blocks.filter((b) => b.type === "heading" && b.content.trim()).length > 0 ? (
                                blocks
                                  .filter((b) => b.type === "heading" && b.content.trim())
                                  .map((h, i) => (
                                    <div
                                      key={h.id}
                                      className="text-xs text-indigo-700 font-medium flex items-center gap-2"
                                      style={{ paddingLeft: `${((h.level || 2) - 1) * 12}px` }}
                                    >
                                      <span className="text-[10px] text-slate-400 font-mono">{i + 1}.</span>
                                      <span>{h.content}</span>
                                    </div>
                                  ))
                              ) : (
                                <p className="text-xs text-slate-400 italic">
                                  No headings yet. Add H1 or H2 headings anywhere in the document to see them indexed dynamically.
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 6. QUOTE */}
                        {block.type === "quote" && (
                          <div className="space-y-2">
                            <textarea
                              rows={2}
                              value={block.content}
                              onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                              placeholder="Enter an inspiring editorial quote..."
                              className="w-full text-base md:text-lg font-bold italic text-slate-800 border-0 focus:ring-0 focus:outline-none bg-transparent resize-none leading-relaxed"
                            />
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-400 font-bold">— Citation:</span>
                              <input
                                type="text"
                                value={block.authorCitation || ""}
                                onChange={(e) => updateBlock(block.id, { authorCitation: e.target.value })}
                                placeholder="Author / Source / Organization..."
                                className="flex-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
                              />
                            </div>
                          </div>
                        )}

                        {/* 7. ALERT / CALLOUT */}
                        {block.type === "alert" && (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={block.title || ""}
                              onChange={(e) => updateBlock(block.id, { title: e.target.value })}
                              placeholder="Callout Headline..."
                              className="w-full font-bold text-sm text-slate-900 border-0 focus:ring-0 focus:outline-none bg-transparent"
                            />
                            <textarea
                              rows={2}
                              value={block.content}
                              onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                              placeholder="Callout advice, tip, or warning text..."
                              className="w-full text-xs text-slate-700 border-0 focus:ring-0 focus:outline-none bg-transparent resize-none"
                            />
                          </div>
                        )}

                        {/* 8. LIST */}
                        {block.type === "list" && (
                          <div className="space-y-2">
                            <div className="space-y-1.5">
                              {(block.items || []).map((it, itIdx) => (
                                <div key={it.id || itIdx} className="flex items-center gap-2">
                                  <span className="text-xs font-mono text-slate-400">
                                    {block.listType === "ordered" ? `${itIdx + 1}.` : "•"}
                                  </span>
                                  <input
                                    type="text"
                                    value={it.title}
                                    onChange={(e) => {
                                      const items = [...(block.items || [])];
                                      items[itIdx] = { ...items[itIdx], title: e.target.value };
                                      updateBlock(block.id, { items });
                                    }}
                                    placeholder="List item..."
                                    className="flex-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const items = (block.items || []).filter((_, i) => i !== itIdx);
                                      updateBlock(block.id, { items });
                                    }}
                                    className="text-slate-400 hover:text-rose-500 text-xs"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const items = [
                                  ...(block.items || []),
                                  { id: `${Date.now()}`, title: "New list item" },
                                ];
                                updateBlock(block.id, { items });
                              }}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold"
                            >
                              + Add Item
                            </button>
                          </div>
                        )}

                        {/* 9. IMAGE */}
                        {block.type === "image" && (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={block.content}
                              onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                              placeholder="Image URL..."
                              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                            />
                            {block.content && (
                              <div className="aspect-[21/9] bg-slate-100 rounded-xl overflow-hidden max-h-[300px]">
                                <img
                                  src={block.content}
                                  alt="Preview"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            <input
                              type="text"
                              value={block.caption || ""}
                              onChange={(e) => updateBlock(block.id, { caption: e.target.value })}
                              placeholder="Image caption / credit attribution..."
                              className="w-full px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                            />
                          </div>
                        )}

                        {/* 10. VIDEO */}
                        {block.type === "video" && (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={block.content}
                              onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                              placeholder="YouTube or Vimeo URL (e.g. https://www.youtube.com/embed/...)..."
                              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                            />
                            {block.content && (
                              <div className="aspect-video bg-slate-900 rounded-xl overflow-hidden max-h-[320px]">
                                <iframe
                                  src={block.content}
                                  className="w-full h-full"
                                  frameBorder="0"
                                  allowFullScreen
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {/* 11. BUTTON CTA */}
                        {block.type === "button" && (
                          <div className="space-y-4">
                            {/* Live Button Display in Editor UI */}
                            <div className="p-6 bg-slate-50/90 rounded-2xl border border-slate-200/90 flex flex-col items-center justify-center gap-3 text-center my-1">
                              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                CTA Button Preview (Live Appearance)
                              </span>
                              <div className="py-1">
                                <a
                                  href={block.buttonUrl || "/apply-loan"}
                                  target={block.buttonNewTab !== false ? "_blank" : "_self"}
                                  onClick={(e) => e.preventDefault()}
                                  className="inline-flex items-center justify-center gap-2.5 px-8 py-3.5 !bg-indigo-600 hover:!bg-indigo-700 !text-white font-bold rounded-2xl shadow-xl shadow-indigo-600/25 text-sm uppercase tracking-wider transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
                                  style={{ backgroundColor: "#4f46e5", color: "#ffffff", display: "inline-flex" }}
                                >
                                  <span>{block.buttonText || block.content || "Explore Loan Options"}</span>
                                  <span className="text-base">&rarr;</span>
                                </a>
                              </div>
                              <span className="text-[11px] font-mono text-slate-500">
                                Target Route: <strong className="text-indigo-600 font-bold">{block.buttonUrl || "/apply-loan"}</strong>
                                {block.buttonNewTab !== false ? " (Opens in new tab)" : " (Same window)"}
                              </span>
                            </div>

                            {/* Button Configuration Inputs */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                                  Button Text / Label
                                </label>
                                <input
                                  type="text"
                                  value={block.buttonText || block.content || ""}
                                  onChange={(e) =>
                                    updateBlock(block.id, {
                                      content: e.target.value,
                                      buttonText: e.target.value,
                                    })
                                  }
                                  placeholder="e.g. Check Loan Eligibility Free"
                                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-indigo-600"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                                  Target Route / URL
                                </label>
                                <input
                                  type="text"
                                  value={block.buttonUrl || ""}
                                  onChange={(e) =>
                                    updateBlock(block.id, { buttonUrl: e.target.value })
                                  }
                                  placeholder="/apply-loan or https://..."
                                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-indigo-600"
                                />
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                              <label className="inline-flex items-center gap-2 text-xs text-slate-600 font-medium cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={block.buttonNewTab !== false}
                                  onChange={(e) =>
                                    updateBlock(block.id, { buttonNewTab: e.target.checked })
                                  }
                                  className="rounded text-indigo-600 accent-indigo-600 w-3.5 h-3.5"
                                />
                                <span>Open destination in a new browser tab</span>
                              </label>
                            </div>
                          </div>
                        )}

                        {/* 12. CODE */}
                        {block.type === "code" && (
                          <div className="space-y-2">
                            <textarea
                              rows={4}
                              value={block.content}
                              onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                              placeholder="// Enter code snippet..."
                              className="w-full p-3 bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl border-0 focus:ring-0"
                            />
                          </div>
                        )}

                        {/* 13. DIVIDER */}
                        {block.type === "divider" && (
                          <div className="py-2">
                            <hr className="border-slate-300" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* BOTTOM INSERTER BAR */}
              <div className="pt-6 border-t border-slate-200 flex flex-col items-center justify-center gap-3">
                <span className="text-xs font-black uppercase text-slate-400 tracking-wider">
                  Add Next Section:
                </span>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {(
                    [
                      { type: "heading", label: "+ Headline", icon: "title" },
                      { type: "text", label: "+ Paragraph", icon: "text_fields" },
                      { type: "split_content", label: "+ Split 2-Col", icon: "view_column" },
                      { type: "split_content", label: "+ Content + Reg Form", icon: "how_to_reg", layout: "text_form" as const },
                      { type: "table", label: "+ Comparison Table", icon: "table_chart" },
                      { type: "quote", label: "+ Pull Quote", icon: "format_quote" },
                      { type: "alert", label: "+ Callout Box", icon: "campaign" },
                      { type: "image", label: "+ Image", icon: "image" },
                      { type: "button", label: "+ CTA Button", icon: "smart_button" },
                    ] as const
                  ).map((btn, bIdx) => (
                    <button
                      key={`${btn.type}-${bIdx}`}
                      type="button"
                      onClick={() => addBlock(btn.type, undefined, (btn as any).layout)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer ${(btn as any).layout === "text_form"
                          ? "bg-purple-50 hover:bg-purple-600 hover:text-white text-purple-700 border border-purple-200"
                          : "bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700"
                        }`}
                    >
                      <span className="material-symbols-outlined text-[15px]">{btn.icon}</span>
                      <span>{btn.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RIGHT PANEL: LIVE EDITORIAL PREVIEW (FOR SPLIT OR FULL PREVIEW OR MOBILE) */}
        {(viewMode === "split" || viewMode === "preview" || viewMode === "mobile") && (
          <div
            className={`flex-1 overflow-y-auto bg-white transition-all ${viewMode === "mobile"
                ? "flex items-center justify-center p-8 bg-slate-200"
                : viewMode === "split"
                  ? "p-6 md:p-10"
                  : "max-w-4xl mx-auto w-full p-8 md:p-14"
              }`}
          >
            {/* MOBILE PHONE FRAME CONTAINER */}
            <div
              className={
                viewMode === "mobile"
                  ? "w-[390px] h-[780px] bg-white rounded-[48px] shadow-2xl border-[12px] border-slate-900 overflow-y-auto p-5 relative"
                  : "w-full"
              }
            >
              {viewMode === "mobile" && (
                <div className="w-32 h-4 bg-slate-900 rounded-full mx-auto mb-4" />
              )}

              {/* ARTICLE HERO SECTION */}
              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-2 text-xs font-black uppercase text-indigo-600 tracking-wider">
                  <span>{category}</span>
                  <span>•</span>
                  <span>{readingTime} min read</span>
                </div>

                <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight font-display">
                  {title || "Untitled Article"}
                </h1>

                {subtitle && (
                  <p className="text-lg md:text-xl text-slate-600 leading-relaxed font-medium">
                    {subtitle}
                  </p>
                )}

                {/* Author Metadata */}
                <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-md">
                    {authorName.charAt(0) || "V"}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">{authorName}</p>
                    <p className="text-[11px] text-slate-400">
                      Published {nowFormattedDate} at {nowFormattedTime} IST
                    </p>
                  </div>
                </div>

                {/* Hero Featured Image */}
                {coverImage && (
                  <div className="aspect-[21/9] rounded-3xl overflow-hidden shadow-xl border border-slate-100 my-6">
                    <img
                      src={coverImage}
                      alt={title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>

              {/* LIVE RENDERED ARTICLE CONTENT */}
              <div
                className="prose prose-lg prose-indigo max-w-none space-y-4"
                dangerouslySetInnerHTML={{ __html: generateCompleteHtml() }}
              />

              {/* TAGS FOOTER */}
              {tags.length > 0 && (
                <div className="mt-12 pt-6 border-t border-slate-100 flex flex-wrap gap-2">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="px-3.5 py-1.5 bg-slate-50 text-slate-600 rounded-full text-xs font-bold border border-slate-200"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* HYPERLINK MODAL */}
      {linkModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-up">
            <h4 className="text-base font-bold text-slate-900">Insert Hyperlink</h4>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  Anchor Text
                </label>
                <input
                  type="text"
                  value={linkModalText}
                  onChange={(e) => setLinkModalText(e.target.value)}
                  placeholder="Text to display"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  Target URL
                </label>
                <input
                  type="text"
                  value={linkModalUrl}
                  onChange={(e) => setLinkModalUrl(e.target.value)}
                  placeholder="https://example.com or /apply"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                />
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={linkModalNewTab}
                  onChange={(e) => setLinkModalNewTab(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                <span>Open link in a new browser tab</span>
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setLinkModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const editorEl = linkModalBlockId ? editorRefs.current[linkModalBlockId] : null;
                  if (editorEl) {
                    editorEl.focus();
                    restoreSelection(linkModalBlockId || undefined);
                  }
                  if (linkModalUrl.trim()) {
                    const targetAttr = linkModalNewTab ? ' target="_blank" rel="noopener noreferrer"' : "";
                    const linkHtml = `<a href="${linkModalUrl.trim()}"${targetAttr} class="text-indigo-600 underline font-bold">${linkModalText || linkModalUrl}</a>`;
                    try {
                      document.execCommand("insertHTML", false, linkHtml);
                    } catch (_) { }
                  }
                  if (linkModalBlockId && editorEl) {
                    updateBlock(linkModalBlockId, { content: editorEl.innerHTML });
                  }
                  setLinkModalOpen(false);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Apply Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
