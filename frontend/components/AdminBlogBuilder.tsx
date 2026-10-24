"use client";

import { useState, useEffect, useRef, DragEvent, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { adminApi, blogApi } from "@/lib/api";
import { cleanHtmlContent, RichTextBlock, TEXT_COLORS, FONT_SIZES, FONT_FAMILIES } from "./DynamicBlogEditor";

type BlockType = "heading" | "container" | "split_content" | "registration_form" | "text" | "image" | "video" | "button" | "list" | "quote" | "code" | "divider" | "spacer" | "tags";

export interface FormFieldConfig {
    id: string;
    label: string;
    name: string;
    type: "text" | "tel" | "email" | "number" | "select";
    placeholder?: string;
    required?: boolean;
    colSpan?: "full" | "half";
    options?: string[];
}

export interface FormConfig {
    formTitle?: string;
    formSubtitle?: string;
    formButtonText?: string;
    targetUrl?: string;
    badgeText?: string;
    footerNote?: string;
    fields: FormFieldConfig[];
}

export const DEFAULT_FORM_FIELDS: FormFieldConfig[] = [
    { id: "f_name", label: "Student Full Name", name: "name", type: "text", placeholder: "Enter student full name", required: true, colSpan: "full" },
    { id: "f_phone", label: "Mobile / WhatsApp Number", name: "phone", type: "tel", placeholder: "+91 98765 43210", required: true, colSpan: "half" },
    { id: "f_email", label: "Email Address", name: "email", type: "email", placeholder: "student@example.com", required: false, colSpan: "half" },
    { id: "f_country", label: "Target Country", name: "country", type: "select", options: ["USA", "United Kingdom", "Canada", "Australia", "Germany", "Ireland", "India"], required: true, colSpan: "half" },
    { id: "f_amount", label: "Loan Amount Required", name: "amount", type: "select", options: ["₹10L - ₹25L", "₹25L - ₹50L", "₹50L - ₹75L", "₹75 Lakhs+"], required: true, colSpan: "half" },
];

interface SplitConfig {
    layoutType: "image_text" | "text_text" | "text_image" | "content_form" | "form_content";
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
    // Registration Form Parameters
    formTitle?: string;
    formSubtitle?: string;
    formButtonText?: string;
    formFields?: FormFieldConfig[];
}

interface Block {
    id: string;
    type: BlockType;
    content: string;
    level?: 1 | 2 | 3 | 4 | 5 | 6;
    // List specific
    listType?: "unordered" | "ordered";
    // Button specific (Dynamic Button)
    buttonText?: string;
    buttonUrl?: string;
    buttonNewTab?: boolean;
    buttonVariant?: "gradient" | "emerald" | "dark" | "outline" | "amber" | "rose";
    buttonSize?: "sm" | "md" | "lg";
    buttonAlign?: "left" | "center" | "right" | "full";
    buttonIcon?: string;
    splitConfig?: SplitConfig;
    formConfig?: FormConfig;
    // Media specific (Image / Video)
    mediaMode?: "url" | "upload";
    fileName?: string;
    fileSize?: string;
    caption?: string;
    style?: {
        fontSize?: string;
        fontFamily?: string;
        fontWeight?: string;
        lineHeight?: string;
        color?: string;
        backgroundColor?: string;
        textAlign?: "left" | "center" | "right" | "justify";
        padding?: string;
        borderRadius?: string;
        border?: string;
        borderLeft?: string;
        aspectRatio?: string;
        maxHeight?: string;
        objectFit?: "cover" | "contain" | "fill";
        objectPosition?: "center" | "top" | "bottom";
    };
}

export const isDirectVideoSource = (src?: string): boolean => {
    if (!src) return false;
    if (src.startsWith("data:video") || src.startsWith("blob:")) return true;
    return /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(src);
};

export const formatVideoEmbedUrl = (raw: string): string => {
    if (!raw) return "";
    const trimmed = raw.trim();
    const ytMatch = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (ytMatch && ytMatch[1]) {
        return `https://www.youtube.com/embed/${ytMatch[1]}`;
    }
    const vimeoMatch = trimmed.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^\/]*)\/videos\/|album\/(?:\d+)\/video\/|)(\d+)/);
    if (vimeoMatch && vimeoMatch[1]) {
        return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }
    return trimmed;
};

export const formatMediaFileSize = (bytes?: number): string => {
    if (!bytes || bytes === 0) return "";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

export interface HeadingLevelInfo {
    level: 1 | 2 | 3 | 4 | 5 | 6;
    tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
    name: string;
    sublabel: string;
    desc: string;
    sizeLabel: string;
    sampleClass: string;
    badgeBg: string;
}

export const HEADING_LEVELS: HeadingLevelInfo[] = [
    { level: 1, tag: "h1", name: "Heading 1 (H1)", sublabel: "Page & Main Title", desc: "Top-level headline for main article subject", sizeLabel: "36px", sampleClass: "text-base font-black text-slate-900", badgeBg: "bg-blue-600 text-white" },
    { level: 2, tag: "h2", name: "Heading 2 (H2)", sublabel: "Major Section Heading", desc: "Key section breakdown and topics", sizeLabel: "30px", sampleClass: "text-sm font-extrabold text-slate-900", badgeBg: "bg-indigo-600 text-white" },
    { level: 3, tag: "h3", name: "Heading 3 (H3)", sublabel: "Subsection Heading", desc: "Sub-points inside an H2 topic", sizeLabel: "24px", sampleClass: "text-xs font-bold text-slate-800", badgeBg: "bg-violet-600 text-white" },
    { level: 4, tag: "h4", name: "Heading 4 (H4)", sublabel: "Minor Subheading", desc: "Specific sub-topics and feature titles", sizeLabel: "20px", sampleClass: "text-xs font-bold text-slate-700", badgeBg: "bg-purple-600 text-white" },
    { level: 5, tag: "h5", name: "Heading 5 (H5)", sublabel: "Small Section Title", desc: "Component or list group headlines", sizeLabel: "16px", sampleClass: "text-[11px] font-semibold text-slate-700", badgeBg: "bg-pink-600 text-white" },
    { level: 6, tag: "h6", name: "Heading 6 (H6)", sublabel: "Micro / Label Headline", desc: "Small uppercase category tag / headline", sizeLabel: "14px", sampleClass: "text-[10px] font-bold text-slate-600 uppercase tracking-wider", badgeBg: "bg-slate-700 text-white" },
];

const ELEMENT_TYPES: { type: BlockType; label: string; icon: string; color: string; desc: string; defaultLayout?: SplitConfig["layoutType"]; defaultListType?: "unordered" | "ordered" }[] = [
    { type: "heading", label: "Heading (H1 - H6)", icon: "title", color: "blue", desc: "Add H1, H2, H3, H4, H5, or H6" },
    { type: "registration_form", label: "Separate Register Form", icon: "how_to_reg", color: "emerald", desc: "Standalone customizable student inquiry/lead form" },
    { type: "split_content", label: "Split 2-Column", icon: "view_column", color: "indigo", desc: "Left/right matter or image & text" },
    { type: "split_content", label: "Content + Register Form", icon: "contact_mail", color: "purple", desc: "One side content, one side form", defaultLayout: "content_form" },
    { type: "container", label: "Container", icon: "view_agenda", color: "purple", desc: "Drag to add container" },
    { type: "text", label: "Text & Live Editor", icon: "text_fields", color: "green", desc: "Drag to add rich text" },
    { type: "image", label: "Image (Crop & Fit)", icon: "crop", color: "orange", desc: "Crop, aspect ratio & sizing" },
    { type: "video", label: "Video", icon: "videocam", color: "red", desc: "Drag to add video" },
    { type: "button", label: "Dynamic Button / CTA", icon: "smart_button", color: "indigo", desc: "Custom URL, colors, alignment & size" },
    { type: "list", label: "Bullet List (Unordered)", icon: "format_list_bulleted", color: "teal", desc: "Bullet point list (•)", defaultListType: "unordered" },
    { type: "list", label: "Numbered List (Ordered)", icon: "format_list_numbered", color: "cyan", desc: "Numbered sequence (1, 2, 3)", defaultListType: "ordered" },
    { type: "quote", label: "Quote", icon: "format_quote", color: "yellow", desc: "Drag to add quote" },
    { type: "code", label: "Code Block", icon: "code", color: "gray", desc: "Drag to add code" },
    { type: "divider", label: "Divider", icon: "horizontal_rule", color: "pink", desc: "Drag to add divider" },
    { type: "spacer", label: "Spacer", icon: "unfold_more", color: "cyan", desc: "Drag to add spacing" },
    { type: "tags", label: "Tags Cloud", icon: "label", color: "purple", desc: "Drag to add tags" },
];

const COLOR_MAP: Record<string, string> = {
    blue: "bg-blue-100 text-blue-600",
    emerald: "bg-emerald-100 text-emerald-600",
    purple: "bg-purple-100 text-purple-600",
    green: "bg-green-100 text-green-600",
    orange: "bg-orange-100 text-orange-600",
    red: "bg-red-100 text-red-600",
    indigo: "bg-indigo-100 text-indigo-600",
    teal: "bg-teal-100 text-teal-600",
    yellow: "bg-yellow-100 text-yellow-600",
    gray: "bg-gray-100 text-gray-600",
    pink: "bg-pink-100 text-pink-600",
    cyan: "bg-cyan-100 text-cyan-600",
};

const TEMPLATES = [
    { id: "basic", name: "Basic Article", desc: "Title + Image + Text" },
    { id: "multimedia", name: "Multimedia", desc: "Images + Videos + CTA" },
    { id: "tutorial", name: "Tutorial", desc: "Steps + Screenshots" },
];

interface AdminBlogBuilderProps {
    onBack?: () => void;
    onPublished?: () => void;
    backHref?: string;
    initialBlog?: any;
}

export default function AdminBlogBuilder({ onBack, onPublished, backHref = "/it/blogs", initialBlog }: AdminBlogBuilderProps) {
    const { user } = useAuth();
    const router = useRouter();

    // Blog settings
    const [title, setTitle] = useState(initialBlog?.title || "");
    const [slug, setSlug] = useState(initialBlog?.slug || "");
    const [category, setCategory] = useState(initialBlog?.category || "Education");
    const [author, setAuthor] = useState(initialBlog?.authorName || (user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : ""));
    const [tags, setTags] = useState(
        Array.isArray(initialBlog?.tags)
            ? initialBlog.tags.map((t: any) => (typeof t === "string" ? t : t?.name || "")).filter(Boolean).join(", ")
            : (initialBlog?.tags || "")
    );
    const [excerpt, setExcerpt] = useState(initialBlog?.excerpt || "");
    const [isFeatured, setIsFeatured] = useState(initialBlog?.isFeatured ?? false);
    const [isPublished, setIsPublished] = useState(initialBlog?.isPublished ?? true);
    const [enableComments, setEnableComments] = useState(true);

    // SEO & SERP optimization states
    const [metaTitle, setMetaTitle] = useState(initialBlog?.metaTitle || "");
    const [metaDescription, setMetaDescription] = useState(initialBlog?.metaDescription || "");
    const [focusKeyword, setFocusKeyword] = useState(initialBlog?.focusKeyword || "");
    const [canonicalUrl, setCanonicalUrl] = useState(initialBlog?.canonicalUrl || "");
    const [noIndex, setNoIndex] = useState(Boolean(initialBlog?.noIndex));
    const [faqSchema, setFaqSchema] = useState<Array<{ id: string; question: string; answer: string }>>([]);
    const [sidebarTab, setSidebarTab] = useState<"content" | "seo">("content");
    const [serpDevice, setSerpDevice] = useState<"desktop" | "mobile">("desktop");
    const [seoTabMode, setSeoTabMode] = useState<"serp" | "social" | "checklist" | "faq">("serp");

    // Editor state
    const [blocks, setBlocks] = useState<Block[]>([]);
    const [draggedType, setDraggedType] = useState<BlockType | null>(null);
    const [draggedLayout, setDraggedLayout] = useState<SplitConfig["layoutType"] | undefined>(undefined);
    const [draggedLevel, setDraggedLevel] = useState<1 | 2 | 3 | 4 | 5 | 6 | undefined>(undefined);
    const [draggedListType, setDraggedListType] = useState<"unordered" | "ordered" | undefined>(undefined);
    const [isHeadingsExpanded, setIsHeadingsExpanded] = useState<boolean>(true);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
    const [saveStatus, setSaveStatus] = useState("Saved");
    const [activeHighlightPicker, setActiveHighlightPicker] = useState<string | null>(null);
    const [activeColorPicker, setActiveColorPicker] = useState<string | null>(null);
    const [activeFontSizePicker, setActiveFontSizePicker] = useState<string | null>(null);
    const [activeFontFamilyPicker, setActiveFontFamilyPicker] = useState<string | null>(null);
    const savedRangeRef = useRef<Range | null>(null);
    const [loading, setLoading] = useState(false);

    // Interactive Lead Testing states for Registration Forms
    const [testFormValues, setTestFormValues] = useState<Record<string, Record<string, string>>>({});
    const [testFormSubmitting, setTestFormSubmitting] = useState<Record<string, boolean>>({});
    const [testFormSuccess, setTestFormSuccess] = useState<Record<string, { name: string; phone: string } | null>>({});
    const [testFormError, setTestFormError] = useState<Record<string, string | null>>({});

    const handleTestLeadSubmit = async (blockId: string, fields: FormFieldConfig[], fConfig: any) => {
        const values = testFormValues[blockId] || {};
        const nameField = fields.find((f) => f.name === "name" || f.type === "text")?.name || "name";
        const phoneField = fields.find((f) => f.name === "phone" || f.type === "tel")?.name || "phone";
        const emailField = fields.find((f) => f.name === "email" || f.type === "email")?.name || "email";
        const countryField = fields.find((f) => f.name === "country")?.name || "country";
        const amountField = fields.find((f) => f.name === "amount")?.name || "amount";

        const nameVal = values[nameField] || values["name"] || "";
        const phoneVal = values[phoneField] || values["phone"] || values["mobile"] || "";
        const emailVal = values[emailField] || values["email"] || "";
        const countryVal = values[countryField] || values["country"] || "USA";
        const amountVal = values[amountField] || values["amount"] || "₹25L - ₹50L";

        if (!nameVal.trim()) {
            setTestFormError((prev) => ({ ...prev, [blockId]: "Please enter student name to test submit." }));
            return;
        }
        if (!phoneVal.trim() || phoneVal.replace(/\D/g, "").length < 8) {
            setTestFormError((prev) => ({ ...prev, [blockId]: "Please enter a valid mobile number (min 8 digits)." }));
            return;
        }

        setTestFormSubmitting((prev) => ({ ...prev, [blockId]: true }));
        setTestFormError((prev) => ({ ...prev, [blockId]: null }));

        try {
            const payload = {
                name: nameVal.trim(),
                phone: phoneVal.trim(),
                mobile: phoneVal.trim(),
                email: emailVal.trim() || undefined,
                country: countryVal,
                amount: amountVal,
                blogTitle: title || "Blog Lead Registration",
                blogSlug: slug || "blog-inquiry",
                source: "blog_register_standalone",
                details: values,
            };

            const res = await fetch("/api/blogs/inquiry", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const json = await res.json().catch(() => null);
            if (!res.ok && !json?.success) {
                throw new Error(json?.message || "Failed to submit lead");
            }

            setTestFormSuccess((prev) => ({ ...prev, [blockId]: { name: nameVal.trim(), phone: phoneVal.trim() } }));
        } catch (err: any) {
            setTestFormError((prev) => ({ ...prev, [blockId]: err.message || "Failed to record inquiry in DB." }));
        } finally {
            setTestFormSubmitting((prev) => ({ ...prev, [blockId]: false }));
        }
    };

    // Modal state
    const [editingBlock, setEditingBlock] = useState<Block | null>(null);
    const [showModal, setShowModal] = useState(false);
    const editorRefs = useRef<Record<string, HTMLDivElement | null>>({});

    // Populate from initialBlog when it changes
    useEffect(() => {
        if (!initialBlog) return;
        if (initialBlog.title) setTitle(initialBlog.title);
        if (initialBlog.slug) setSlug(initialBlog.slug);
        if (initialBlog.category) setCategory(initialBlog.category);
        if (initialBlog.authorName) setAuthor(initialBlog.authorName);
        if (initialBlog.excerpt) setExcerpt(initialBlog.excerpt);
        if (initialBlog.isFeatured !== undefined) setIsFeatured(initialBlog.isFeatured);
        if (initialBlog.isPublished !== undefined) setIsPublished(initialBlog.isPublished);
        if (initialBlog.tags) {
            setTags(
                Array.isArray(initialBlog.tags)
                    ? initialBlog.tags.map((t: any) => (typeof t === "string" ? t : t?.name || "")).filter(Boolean).join(", ")
                    : initialBlog.tags
            );
        }
        if (initialBlog.metaTitle) setMetaTitle(initialBlog.metaTitle);
        if (initialBlog.metaDescription) setMetaDescription(initialBlog.metaDescription);
        if (initialBlog.focusKeyword) setFocusKeyword(initialBlog.focusKeyword);
        if (initialBlog.canonicalUrl) setCanonicalUrl(initialBlog.canonicalUrl);
        if (typeof initialBlog.noIndex === "boolean") setNoIndex(initialBlog.noIndex);
        if (Array.isArray(initialBlog.faqSchema)) setFaqSchema(initialBlog.faqSchema);

        if (initialBlog.content) {
            // Check if SEO JSON is embedded
            const seoMatch = initialBlog.content.match(/<!--SEO_JSON_START-->([\s\S]*?)<!--SEO_JSON_END-->/);
            if (seoMatch && seoMatch[1]) {
                try {
                    const parsedSeo = JSON.parse(seoMatch[1]);
                    if (parsedSeo.metaTitle) setMetaTitle(parsedSeo.metaTitle);
                    if (parsedSeo.metaDescription) setMetaDescription(parsedSeo.metaDescription);
                    if (parsedSeo.focusKeyword) setFocusKeyword(parsedSeo.focusKeyword);
                    if (parsedSeo.canonicalUrl) setCanonicalUrl(parsedSeo.canonicalUrl);
                    if (typeof parsedSeo.noIndex === "boolean") setNoIndex(parsedSeo.noIndex);
                    if (Array.isArray(parsedSeo.faqSchema)) setFaqSchema(parsedSeo.faqSchema);
                } catch (_) {}
            }
        }

        if (initialBlog.content && blocks.length === 0) {
            // First check if structured blocks JSON was embedded
            const jsonMatch = initialBlog.content.match(/<!--BLOCKS_JSON_START-->([\s\S]*?)<!--BLOCKS_JSON_END-->/);
            if (jsonMatch) {
                try {
                    const parsed = JSON.parse(jsonMatch[1]);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setBlocks(parsed);
                        return;
                    }
                } catch (e) {}
            }

            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(initialBlog.content, "text/html");
                const parsedBlocks: Block[] = [];
                Array.from(doc.body.children).forEach((el, idx) => {
                    const tag = el.tagName.toLowerCase();
                    const bId = `blk_${Date.now()}_${idx}`;
                    if (tag.startsWith("h") && /^h[1-6]$/.test(tag)) {
                        const lvl = parseInt(tag.charAt(1), 10) as 1 | 2 | 3 | 4 | 5 | 6;
                        parsedBlocks.push({ id: bId, type: "heading", level: lvl, content: el.textContent || "" });
                    } else if (tag === "img") {
                        parsedBlocks.push({ id: bId, type: "image", content: el.getAttribute("src") || "" });
                    } else if (el.querySelector("img")) {
                        const img = el.querySelector("img");
                        parsedBlocks.push({ id: bId, type: "image", content: img?.getAttribute("src") || "" });
                    } else if (tag === "hr") {
                        parsedBlocks.push({ id: bId, type: "divider", content: "" });
                    } else if (tag === "ul" || tag === "ol") {
                        const listType = tag === "ol" ? "ordered" : "unordered";
                        const items = Array.from(el.querySelectorAll("li")).map((li) => li.textContent?.trim() || "").filter(Boolean);
                        parsedBlocks.push({
                            id: bId,
                            type: "list",
                            listType,
                            content: items.map((it, i) => listType === "ordered" ? `${i + 1}. ${it}` : `• ${it}`).join("\n"),
                        });
                    } else if (tag === "a" || el.querySelector("a.blog-btn") || el.classList.contains("blog-button-wrapper")) {
                        const a = tag === "a" ? (el as HTMLAnchorElement) : (el.querySelector("a") as HTMLAnchorElement);
                        const btnText = a?.textContent?.replace(/→|&rarr;/, "").trim() || "Click Here";
                        parsedBlocks.push({
                            id: bId,
                            type: "button",
                            content: btnText,
                            buttonText: btnText,
                            buttonUrl: a?.getAttribute("href") || "#",
                            buttonNewTab: a?.getAttribute("target") === "_blank",
                            buttonVariant: "gradient",
                            buttonSize: "md",
                            buttonAlign: "center",
                        });
                    } else if (tag === "iframe" || el.querySelector("iframe")) {
                        const ifr = tag === "iframe" ? (el as HTMLIFrameElement) : (el.querySelector("iframe") as HTMLIFrameElement);
                        parsedBlocks.push({ id: bId, type: "video", content: ifr?.getAttribute("src") || "" });
                    } else if (tag === "video" || el.querySelector("video")) {
                        const vid = tag === "video" ? (el as HTMLVideoElement) : (el.querySelector("video") as HTMLVideoElement);
                        parsedBlocks.push({ id: bId, type: "video", content: vid?.getAttribute("src") || "" });
                    } else {
                        parsedBlocks.push({ id: bId, type: "text", content: el.innerHTML || el.textContent || "" });
                    }
                });
                if (parsedBlocks.length > 0) {
                    setBlocks(parsedBlocks);
                }
            } catch (e) {
                setBlocks([{ id: "init_1", type: "text", content: initialBlog.content }]);
            }
        }
    }, [initialBlog]);

    // Generate slug from title
    useEffect(() => {
        if (!initialBlog?.slug) {
            const generated = title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/(^-|-$)/g, "");
            setSlug(generated);
        }
    }, [title, initialBlog?.slug]);

    // Real-Time SEO Analyzer Engine
    const seoAnalysis = useMemo(() => {
        const effectiveTitle = (metaTitle.trim() || title.trim());
        const effectiveDesc = (metaDescription.trim() || excerpt.trim());
        const kw = focusKeyword.trim().toLowerCase();
        const effectiveSlug = (slug.trim() || title.toLowerCase().replace(/[^a-z0-9]+/g, "-")).toLowerCase();

        // Extract full plain text from blocks
        let bodyText = "";
        let hasH2 = false;
        let imageCount = 0;

        blocks.forEach((b) => {
            if (b.type === "heading") {
                hasH2 = true;
                bodyText += " " + (b.content || "");
            } else if (b.type === "image") {
                imageCount++;
            } else if (b.type === "split_content" && b.splitConfig) {
                bodyText += ` ${b.splitConfig.leftTitle || ""} ${b.splitConfig.leftContent || ""} ${b.splitConfig.rightTitle || ""} ${b.splitConfig.rightContent || ""}`;
                if (b.splitConfig.leftImageUrl) imageCount++;
                if (b.splitConfig.rightImageUrl) imageCount++;
            } else {
                bodyText += " " + (b.content || "").replace(/<[^>]*>/g, " ");
            }
        });

        const words = bodyText.trim().split(/\s+/).filter(Boolean);
        const wordCount = words.length;
        const readingTime = Math.max(1, Math.ceil(wordCount / 200));

        const bodyLower = bodyText.toLowerCase();
        const kwCount = kw ? (bodyLower.match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")) || []).length : 0;
        const kwDensity = wordCount > 0 && kwCount > 0 ? ((kwCount / wordCount) * 100).toFixed(1) : "0";

        const checks: Array<{
            id: string;
            label: string;
            status: "pass" | "warn" | "fail";
            message: string;
            weight: number;
        }> = [];

        // 1. Meta Title Length
        if (effectiveTitle.length >= 40 && effectiveTitle.length <= 65) {
            checks.push({
                id: "title-length",
                label: "Meta Title Length",
                status: "pass",
                message: `Optimal length (${effectiveTitle.length}/65 chars). Shows cleanly in Google SERP.`,
                weight: 15,
            });
        } else if (effectiveTitle.length > 65) {
            checks.push({
                id: "title-length",
                label: "Meta Title Length",
                status: "warn",
                message: `Too long (${effectiveTitle.length} chars). Google truncates titles over 65 chars.`,
                weight: 8,
            });
        } else if (effectiveTitle.length > 0) {
            checks.push({
                id: "title-length",
                label: "Meta Title Length",
                status: "warn",
                message: `Too short (${effectiveTitle.length} chars). Aim for 40-65 chars for higher CTR.`,
                weight: 7,
            });
        } else {
            checks.push({
                id: "title-length",
                label: "Meta Title Length",
                status: "fail",
                message: "No title or meta title specified.",
                weight: 0,
            });
        }

        // 2. Meta Description Length
        if (effectiveDesc.length >= 120 && effectiveDesc.length <= 160) {
            checks.push({
                id: "desc-length",
                label: "Meta Description",
                status: "pass",
                message: `Optimal length (${effectiveDesc.length}/160 chars). Great snippet display.`,
                weight: 15,
            });
        } else if (effectiveDesc.length > 160) {
            checks.push({
                id: "desc-length",
                label: "Meta Description",
                status: "warn",
                message: `Too long (${effectiveDesc.length} chars). Truncated on search results.`,
                weight: 8,
            });
        } else if (effectiveDesc.length > 0) {
            checks.push({
                id: "desc-length",
                label: "Meta Description",
                status: "warn",
                message: `Too short (${effectiveDesc.length} chars). Aim for 120-160 chars.`,
                weight: 7,
            });
        } else {
            checks.push({
                id: "desc-length",
                label: "Meta Description",
                status: "fail",
                message: "No meta description provided.",
                weight: 0,
            });
        }

        // 3. Focus Keyword Defined
        if (kw) {
            checks.push({
                id: "kw-defined",
                label: "Focus Keyword",
                status: "pass",
                message: `Focus keyword: "${focusKeyword}"`,
                weight: 10,
            });

            // 4. Keyword in Title
            if (effectiveTitle.toLowerCase().includes(kw)) {
                checks.push({
                    id: "kw-title",
                    label: "Keyword in Title",
                    status: "pass",
                    message: "Focus keyword appears in title.",
                    weight: 10,
                });
            } else {
                checks.push({
                    id: "kw-title",
                    label: "Keyword in Title",
                    status: "warn",
                    message: "Focus keyword is missing from the title.",
                    weight: 0,
                });
            }

            // 5. Keyword in Meta Description
            if (effectiveDesc.toLowerCase().includes(kw)) {
                checks.push({
                    id: "kw-desc",
                    label: "Keyword in Description",
                    status: "pass",
                    message: "Focus keyword is in the meta description snippet.",
                    weight: 10,
                });
            } else {
                checks.push({
                    id: "kw-desc",
                    label: "Keyword in Description",
                    status: "warn",
                    message: "Focus keyword is missing from meta description.",
                    weight: 0,
                });
            }

            // 6. Keyword in Slug
            const kwSlug = kw.replace(/[^a-z0-9]+/g, "-");
            if (effectiveSlug.includes(kwSlug)) {
                checks.push({
                    id: "kw-slug",
                    label: "Keyword in URL Slug",
                    status: "pass",
                    message: "URL slug contains target keyword.",
                    weight: 10,
                });
            } else {
                checks.push({
                    id: "kw-slug",
                    label: "Keyword in URL Slug",
                    status: "warn",
                    message: "URL slug does not include the keyword.",
                    weight: 0,
                });
            }

            // 7. Keyword in Content & Density
            if (kwCount >= 2) {
                checks.push({
                    id: "kw-density",
                    label: "Keyword Density",
                    status: "pass",
                    message: `Found ${kwCount} times (${kwDensity}% density). Good relevance.`,
                    weight: 10,
                });
            } else if (kwCount === 1) {
                checks.push({
                    id: "kw-density",
                    label: "Keyword Density",
                    status: "warn",
                    message: `Found only 1 time in body text. Aim for 2-4 mentions.`,
                    weight: 5,
                });
            } else {
                checks.push({
                    id: "kw-density",
                    label: "Keyword Density",
                    status: "fail",
                    message: "Target keyword was not found in the body text.",
                    weight: 0,
                });
            }
        } else {
            checks.push({
                id: "kw-defined",
                label: "Focus Keyword",
                status: "warn",
                message: "No focus keyword set. Add one to target specific search terms.",
                weight: 0,
            });
        }

        // 8. Headings (H2)
        if (hasH2) {
            checks.push({
                id: "heading-h2",
                label: "Subheadings Structure",
                status: "pass",
                message: "Has section headings to break up content.",
                weight: 10,
            });
        } else {
            checks.push({
                id: "heading-h2",
                label: "Subheadings Structure",
                status: "warn",
                message: "Add at least one Heading element for scannability.",
                weight: 0,
            });
        }

        // 9. Article Content Length
        if (wordCount >= 300) {
            checks.push({
                id: "word-count",
                label: "Content Length",
                status: "pass",
                message: `Solid depth: ${wordCount} words (~${readingTime} min read).`,
                weight: 10,
            });
        } else if (wordCount >= 100) {
            checks.push({
                id: "word-count",
                label: "Content Length",
                status: "warn",
                message: `Short article (${wordCount} words). Aim for 300+ words for better rankings.`,
                weight: 5,
            });
        } else {
            checks.push({
                id: "word-count",
                label: "Content Length",
                status: "fail",
                message: `Thin content (${wordCount} words). Add more informative paragraphs.`,
                weight: 0,
            });
        }

        // 10. Featured Visual
        const hasCover = Boolean(blocks.some((b) => b.type === "image") || initialBlog?.coverImage || initialBlog?.featuredImage);
        if (hasCover) {
            checks.push({
                id: "visual-asset",
                label: "Visual Assets / Image",
                status: "pass",
                message: "Post contains visual images for OpenGraph & search previews.",
                weight: 10,
            });
        } else {
            checks.push({
                id: "visual-asset",
                label: "Visual Assets / Image",
                status: "warn",
                message: "No image found. Add an Image block for better social share appearance.",
                weight: 0,
            });
        }

        const totalWeight = checks.reduce((acc, c) => acc + (c.weight > 0 ? c.weight : 0), 0);
        const maxScore = 110;
        const normalizedScore = Math.min(100, Math.round((totalWeight / maxScore) * 100));

        const passes = checks.filter((c) => c.status === "pass").length;
        const warns = checks.filter((c) => c.status === "warn").length;
        const fails = checks.filter((c) => c.status === "fail").length;

        return {
            score: normalizedScore,
            effectiveTitle,
            effectiveDesc,
            wordCount,
            readingTime,
            kwCount,
            kwDensity,
            checks,
            passes,
            warns,
            fails,
        };
    }, [metaTitle, title, metaDescription, excerpt, focusKeyword, slug, blocks, initialBlog]);

    // SEO Helper Actions
    const addFaqItem = () => {
        setFaqSchema((prev) => [
            ...prev,
            { id: "faq_" + Date.now(), question: "", answer: "" },
        ]);
        setSaveStatus("Unsaved");
    };

    const updateFaqItem = (id: string, updates: Partial<{ question: string; answer: string }>) => {
        setFaqSchema((prev) =>
            prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
        );
        setSaveStatus("Unsaved");
    };

    const removeFaqItem = (id: string) => {
        setFaqSchema((prev) => prev.filter((item) => item.id !== id));
        setSaveStatus("Unsaved");
    };

    const autoFillMetaTitle = () => {
        if (title.trim()) {
            setMetaTitle(title.trim().slice(0, 60));
            setSaveStatus("Unsaved");
        }
    };

    const autoFillMetaDesc = () => {
        if (excerpt.trim()) {
            setMetaDescription(excerpt.trim().slice(0, 155));
            setSaveStatus("Unsaved");
            return;
        }
        const textBlock = blocks.find((b) => b.type === "text" && b.content);
        if (textBlock) {
            const clean = textBlock.content.replace(/<[^>]*>/g, " ").trim();
            setMetaDescription(clean.slice(0, 155));
            setSaveStatus("Unsaved");
        }
    };

    const autoGenerateCleanSlug = () => {
        const sourceText = focusKeyword.trim() || title.trim();
        if (sourceText) {
            const clean = sourceText
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/(^-|-$)/g, "");
            setSlug(clean);
            setSaveStatus("Unsaved");
        }
    };

    // Set current date
    const currentDate = new Date().toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
    });

    const HIGHLIGHT_SWATCHES = [
        { name: "Yellow", bg: "#fef08a", text: "#854d0e", border: "#fde047" },
        { name: "Mint", bg: "#bbf7d0", text: "#14532d", border: "#86efac" },
        { name: "Sky", bg: "#bae6fd", text: "#0369a1", border: "#7dd3fc" },
        { name: "Pink", bg: "#fbcfe8", text: "#9d174d", border: "#f472b6" },
        { name: "Purple", bg: "#e9d5ff", text: "#6b21a8", border: "#d8b4fe" },
        { name: "Orange", bg: "#fed7aa", text: "#9a3412", border: "#fdba74" },
    ];

    // Selection helpers for inline formatting & text controls
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
            updateBlock(blockId, newHtml);
        }
        saveSelection();
    };

    // Real-time Font size helper
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
            updateBlock(blockId, el.innerHTML);
        } else {
            updateBlockStyle(blockId, { fontSize: sizePx });
        }
        saveSelection();
        setActiveFontSizePicker(null);
    };

    // Real-time Font family helper
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
            updateBlock(blockId, el.innerHTML);
        } else {
            updateBlockStyle(blockId, { fontFamily });
        }
        saveSelection();
        setActiveFontFamilyPicker(null);
    };

    // Real-time Text color helper
    const applyTextColor = (blockId: string, colorHex: string) => {
        const el = editorRefs.current[blockId];
        if (!el) return;
        el.focus();
        restoreSelection(blockId);
        try {
            document.execCommand("foreColor", false, colorHex);
        } catch (_) { }
        updateBlock(blockId, el.innerHTML);
        saveSelection();
        setActiveColorPicker(null);
    };

    // Real-time Reliable Highlight with preserved selection
    const applyHighlight = (blockId: string, bg: string = "#fef08a", textColor: string = "#854d0e") => {
        const el = editorRefs.current[blockId] || document.getElementById(`editor-${blockId}`);
        if (!el) return;
        el.focus();
        restoreSelection(blockId);
        let sel = window.getSelection();

        if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
            if (savedRangeRef.current && !savedRangeRef.current.collapsed) {
                restoreSelection(blockId);
                sel = window.getSelection();
            }
        }

        if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            const containerEl = el || (range.commonAncestorContainer as HTMLElement)?.closest?.('[contenteditable="true"]') as HTMLElement | null;

            if (containerEl && !containerEl.contains(range.commonAncestorContainer)) {
                setActiveHighlightPicker(null);
                return;
            }

            // 1. Remove background from any existing highlight elements intersecting or inside range
            if (containerEl) {
                const innerHighlights = Array.from(
                    containerEl.querySelectorAll('mark, [data-highlight="true"], span[style*="background"], font[style*="background"]')
                ) as HTMLElement[];
                innerHighlights.forEach((hl) => {
                    if (hl !== containerEl && (sel.containsNode(hl, true) || range.intersectsNode(hl))) {
                        hl.style.backgroundColor = "";
                        hl.style.background = "";
                        hl.removeAttribute("data-highlight");
                        if (hl.tagName === "MARK") {
                            const p = hl.parentNode;
                            if (p) {
                                while (hl.firstChild) p.insertBefore(hl.firstChild, hl);
                                p.removeChild(hl);
                            }
                        }
                    }
                });
            }

            // 2. Check if selection is inside an existing highlight container
            let container: Node | null = range.commonAncestorContainer;
            if (container.nodeType === Node.TEXT_NODE) {
                container = container.parentNode;
            }
            const existing = (container as HTMLElement)?.closest?.('[data-highlight="true"], mark') as HTMLElement | null;
            if (existing && containerEl?.contains(existing) && existing.textContent?.trim() === range.toString().trim()) {
                existing.style.backgroundColor = bg;
                existing.style.background = bg;
                existing.style.color = textColor;
                existing.setAttribute("data-highlight", "true");
            } else {
                const span = document.createElement("span");
                span.setAttribute("data-highlight", "true");
                span.style.backgroundColor = bg;
                span.style.color = textColor;
                span.style.padding = "2px 5px";
                span.style.borderRadius = "4px";
                span.style.fontWeight = "600";

                try {
                    range.surroundContents(span);
                } catch {
                    try {
                        const frag = range.extractContents();
                        span.appendChild(frag);
                        range.insertNode(span);
                    } catch (_) { }
                }
            }

            if (containerEl) {
                updateBlock(blockId, containerEl.innerHTML);
            }
            saveSelection();
        }
        setActiveHighlightPicker(null);
    };

    // Real-time Unhighlight: removes highlights from selection, caret word, or entire block
    const removeHighlight = (blockId: string) => {
        const el = editorRefs.current[blockId] || document.getElementById(`editor-${blockId}`);
        if (!el) return;
        el.focus();
        restoreSelection(blockId);
        let sel = window.getSelection();

        const cleanHighlightNode = (node: HTMLElement) => {
            node.style.backgroundColor = "";
            node.style.background = "";
            node.style.color = "";
            node.style.padding = "";
            node.style.borderRadius = "";
            node.style.fontWeight = "";
            node.removeAttribute("data-highlight");
            node.removeAttribute("data-color");

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

            if (node.tagName === "SPAN") {
                const remainingStyle = node.getAttribute("style")?.trim();
                if (!remainingStyle || remainingStyle === "" || remainingStyle === ";") {
                    node.removeAttribute("style");
                    if (!node.getAttribute("class") && !node.getAttribute("id")) {
                        const parent = node.parentNode;
                        if (parent) {
                            while (node.firstChild) {
                                parent.insertBefore(node.firstChild, node);
                            }
                            parent.removeChild(node);
                        }
                    }
                }
            }
        };

        try {
            document.execCommand("hiliteColor", false, "transparent");
        } catch (_) { }

        if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            const containerEl = el || (range.commonAncestorContainer as HTMLElement)?.closest?.('[contenteditable="true"]') as HTMLElement | null;

            if (containerEl) {
                // 1. If cursor/range is inside an ancestor highlight element, clean it
                let curr: Node | null = range.commonAncestorContainer;
                if (curr.nodeType === Node.TEXT_NODE) {
                    curr = curr.parentNode;
                }
                while (curr && curr !== containerEl && containerEl.contains(curr)) {
                    const parentEl = curr as HTMLElement;
                    if (
                        parentEl.tagName === "MARK" ||
                        parentEl.getAttribute("data-highlight") === "true" ||
                        parentEl.style.backgroundColor ||
                        parentEl.style.background
                    ) {
                        const fullText = parentEl.textContent || "";
                        const selText = range.toString();
                        if (!selText || selText.trim() === fullText.trim() || selText.length >= fullText.length) {
                            cleanHighlightNode(parentEl);
                        } else if (selText.length > 0 && fullText.includes(selText)) {
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

                // 2. Clean intersecting highlights
                const allHighlights = Array.from(
                    containerEl.querySelectorAll('mark, [data-highlight="true"], span[style*="background"], font[style*="background"]')
                ) as HTMLElement[];

                allHighlights.forEach((candidate) => {
                    if (candidate !== containerEl) {
                        if (
                            sel.isCollapsed
                                ? candidate.contains(range.commonAncestorContainer)
                                : sel.containsNode(candidate, true) || (range.intersectsNode && range.intersectsNode(candidate))
                        ) {
                            cleanHighlightNode(candidate);
                        }
                    }
                });

                // 3. Clean any remaining marks
                const anyMarks = Array.from(containerEl.querySelectorAll("mark"));
                anyMarks.forEach((m) => {
                    const parent = m.parentNode;
                    if (parent) {
                        while (m.firstChild) {
                            parent.insertBefore(m.firstChild, m);
                        }
                        parent.removeChild(m);
                    }
                });

                containerEl.normalize();
                updateBlock(blockId, containerEl.innerHTML);
                saveSelection();
            }
        } else {
            const allHighlights = Array.from(
                el.querySelectorAll('mark, [data-highlight="true"], span[style*="background"], font[style*="background"]')
            ) as HTMLElement[];
            allHighlights.forEach(cleanHighlightNode);
            updateBlock(blockId, el.innerHTML);
        }
        setActiveHighlightPicker(null);
    };

    const applyTextPreset = (
        blockId: string,
        preset: "body" | "lead" | "editorial" | "tip" | "alert" | "card"
    ) => {
        const presets: Record<string, Partial<Block["style"]>> = {
            body: {
                fontSize: "16px",
                textAlign: "left",
                color: "#374151",
                backgroundColor: "transparent",
                padding: "0",
                borderRadius: "0",
                border: "none",
                borderLeft: "none",
                lineHeight: "1.65",
            },
            lead: {
                fontSize: "20px",
                textAlign: "left",
                color: "#111827",
                fontWeight: "600",
                backgroundColor: "transparent",
                padding: "0",
                borderRadius: "0",
                border: "none",
                borderLeft: "none",
                lineHeight: "1.75",
            },
            editorial: {
                fontSize: "17px",
                textAlign: "left",
                color: "#1f2937",
                fontFamily: "'Merriweather', 'Georgia', serif",
                backgroundColor: "transparent",
                padding: "0",
                borderRadius: "0",
                border: "none",
                borderLeft: "none",
                lineHeight: "1.8",
            },
            tip: {
                fontSize: "15px",
                textAlign: "left",
                color: "#064e3b",
                backgroundColor: "#f0fdf4",
                padding: "14px 18px",
                borderRadius: "0 10px 10px 0",
                borderLeft: "4px solid #10b981",
                border: "none",
                lineHeight: "1.65",
            },
            alert: {
                fontSize: "15px",
                textAlign: "left",
                color: "#78350f",
                backgroundColor: "#fffbeb",
                padding: "14px 18px",
                borderRadius: "0 10px 10px 0",
                borderLeft: "4px solid #f59e0b",
                border: "none",
                lineHeight: "1.65",
            },
            card: {
                fontSize: "15px",
                textAlign: "left",
                color: "#374151",
                backgroundColor: "#f9fafb",
                padding: "16px 20px",
                borderRadius: "12px",
                border: "1px solid #e5e7eb",
                borderLeft: "none",
                lineHeight: "1.65",
            },
        };
        const newStyle = presets[preset] || presets.body;
        setBlocks((prev) =>
            prev.map((b) => (b.id === blockId ? { ...b, style: { ...b.style, ...newStyle } } : b))
        );
    };

    // Create new block
    const createBlock = (
        type: BlockType,
        defaultLayout?: SplitConfig["layoutType"],
        level?: 1 | 2 | 3 | 4 | 5 | 6,
        defaultListType?: "unordered" | "ordered"
    ): Block => {
        const headingLevel = level || 2;
        const listType = defaultListType || "unordered";
        const headingDefaults: Record<number, string> = {
            1: "H1 Main Headline",
            2: "H2 Section Heading",
            3: "H3 Subsection Heading",
            4: "H4 Minor Heading",
            5: "H5 Small Heading",
            6: "H6 Micro Heading",
        };
        const defaults: Record<BlockType, string> = {
            heading: headingDefaults[headingLevel] || "New Heading",
            container: "",
            split_content: "",
            registration_form: "",
            text: "Enter your text here...",
            image: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1200",
            video: "https://www.youtube.com/embed/dQw4w9WgXcQ",
            button: "Explore Loan Options",
            list: listType === "ordered"
                ? "1. Calculate required study loan amount\n2. Compare 15+ partner bank interest rates\n3. Get instant pre-visa sanction in 48 hours"
                : "• 100% Comprehensive funding for tuition & living costs\n• Collateral-free education loans up to ₹75 Lakhs\n• Pre-visa approval with door-step specialist support",
            quote: "Enter an inspiring quote here...",
            code: "// Your code here\nconsole.log('Hello World');",
            divider: "",
            spacer: "",
            tags: "EducationLoan, StudyAbroad, FastApproval",
        };

        const defaultSplitConfig: SplitConfig = {
            layoutType: defaultLayout || "image_text",
            ratio: "50_50",
            verticalAlign: "center",
            cardStyle: "clean",
            leftTitle: "Study Abroad Education Loans",
            leftContent: "Calculate your eligibility and compare offers from 15+ premier lending partners with collateral-free funding up to ₹75 Lakhs.",
            leftImageUrl: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=800",
            leftImageCaption: "Campus academic excellence & global careers",
            leftImageAlt: "University students on campus",
            leftItems: [
                "100% Comprehensive funding for tuition & living",
                "Lowest interest rates starting at 8.5% p.a.",
                "Pre-visa sanction letter in 48 hours",
                "Dedicated loan specialist & door-step support",
            ],
            rightTitle: "Collateral-Free Education Loans",
            rightContent: "Secure up to ₹75 Lakhs without submitting physical property collateral. Fast approval in 48 hours with low rates.",
            rightItems: [
                "Up to ₹75 Lakhs collateral-free limit",
                "Interest rate from 8.5% p.a. with 80E tax deduction",
                "Moratorium: Course duration + 6-12 months",
            ],
            buttonText: "Explore Loan Options",
            buttonUrl: "/apply-loan",
            buttonNewTab: true,
            formTitle: "Instant Loan Inquiry & Registration",
            formSubtitle: "Enter your details to check eligibility and get a callback from our loan expert.",
            formButtonText: "Register & Check Eligibility",
            formFields: DEFAULT_FORM_FIELDS.map((f) => ({ ...f, id: "f_" + Math.random().toString(36).substr(2, 6) })),
        };

        const defaultFormConfig: FormConfig = {
            formTitle: "Instant Loan Inquiry & Registration",
            formSubtitle: "Fill details for instant loan eligibility assessment & expert callback within 15 minutes.",
            formButtonText: "Register & Check Eligibility",
            targetUrl: "/registration",
            badgeText: "Instant Assessment",
            footerNote: "🔒 100% Free Service • No CIBIL Impact • Doorstep Support",
            fields: DEFAULT_FORM_FIELDS.map((f) => ({ ...f, id: "f_" + Math.random().toString(36).substr(2, 6) })),
        };

        return {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            type,
            level: type === "heading" ? headingLevel : undefined,
            listType: type === "list" ? listType : undefined,
            buttonText: type === "button" ? "Explore Loan Options" : undefined,
            buttonUrl: type === "button" ? "/apply-loan" : undefined,
            buttonNewTab: type === "button" ? true : undefined,
            buttonVariant: type === "button" ? "gradient" : undefined,
            buttonSize: type === "button" ? "md" : undefined,
            buttonAlign: type === "button" ? "center" : undefined,
            content: defaults[type],
            splitConfig: (type === "split_content" || type === "container") ? defaultSplitConfig : undefined,
            formConfig: type === "registration_form" ? defaultFormConfig : undefined,
            style: type === "image" ? {
                aspectRatio: "16/9",
                maxHeight: "380px",
                objectFit: "cover",
                objectPosition: "center",
                borderRadius: "16px",
            } : undefined,
        };
    };

    const updateBlockStyle = (blockId: string, styleUpdates: Partial<NonNullable<Block["style"]>>) => {
        setBlocks((prev) =>
            prev.map((b) => (b.id === blockId ? { ...b, style: { ...b.style, ...styleUpdates } } : b))
        );
        setSaveStatus("Unsaved");
    };

    const handleAddElement = (
        type: BlockType,
        defaultLayout?: SplitConfig["layoutType"],
        level?: 1 | 2 | 3 | 4 | 5 | 6,
        defaultListType?: "unordered" | "ordered"
    ) => {
        const newBlock = createBlock(type, defaultLayout, level, defaultListType);
        setBlocks((prev) => [...prev, newBlock]);
        setSaveStatus("Unsaved");
    };

    const updateBlockLevel = (blockId: string, level: 1 | 2 | 3 | 4 | 5 | 6) => {
        setBlocks((prev) =>
            prev.map((b) => (b.id === blockId ? { ...b, level } : b))
        );
        setSaveStatus("Unsaved");
    };

    const updateBlockListType = (blockId: string, listType: "unordered" | "ordered") => {
        setBlocks((prev) =>
            prev.map((b) => {
                if (b.id !== blockId) return b;
                const rawLines = (b.content || "").split("\n").map((l) => l.replace(/^(\s*•|\s*-|\s*\d+[\.\)])\s*/, "").trim());
                const formatted = listType === "ordered"
                    ? rawLines.map((l, i) => `${i + 1}. ${l}`).join("\n")
                    : rawLines.map((l) => `• ${l}`).join("\n");
                return { ...b, listType, content: formatted };
            })
        );
        setSaveStatus("Unsaved");
    };

    const updateBlockButton = (blockId: string, updates: Partial<Block>) => {
        setBlocks((prev) =>
            prev.map((b) => (b.id === blockId ? { ...b, ...updates } : b))
        );
        setSaveStatus("Unsaved");
    };

    const updateSplitConfig = (blockId: string, updates: Partial<SplitConfig>) => {
        setBlocks((prev) =>
            prev.map((b) => {
                if (b.id !== blockId) return b;
                return {
                    ...b,
                    splitConfig: {
                        ...(b.splitConfig || {
                            layoutType: "image_text",
                            ratio: "50_50",
                            verticalAlign: "center",
                            cardStyle: "clean",
                        }),
                        ...updates,
                    },
                };
            })
        );
        setSaveStatus("Unsaved");
    };

    const updateFormConfig = (blockId: string, updates: Partial<FormConfig>) => {
        setBlocks((prev) =>
            prev.map((b) => {
                if (b.id !== blockId) return b;
                return {
                    ...b,
                    formConfig: {
                        ...(b.formConfig || {
                            formTitle: "Instant Loan Inquiry & Registration",
                            formSubtitle: "Fill details for instant loan eligibility assessment & expert callback.",
                            formButtonText: "Register & Check Eligibility",
                            targetUrl: "/apply-loan",
                            badgeText: "Instant Assessment",
                            footerNote: "🔒 100% Free Service • No CIBIL Impact • Doorstep Support",
                            fields: [...DEFAULT_FORM_FIELDS],
                        }),
                        ...updates,
                    },
                };
            })
        );
        setSaveStatus("Unsaved");
    };

    const addFormField = (blockId: string, preset?: Partial<FormFieldConfig>, isSplit = false) => {
        const newField: FormFieldConfig = {
            id: "f_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
            label: preset?.label || "New Field",
            name: preset?.name || "field_" + Date.now().toString(36),
            type: preset?.type || "text",
            placeholder: preset?.placeholder || "Enter details...",
            required: preset?.required ?? false,
            colSpan: preset?.colSpan || "half",
            options: preset?.options,
        };

        if (isSplit) {
            setBlocks((prev) =>
                prev.map((b) => {
                    if (b.id !== blockId) return b;
                    const existing = b.splitConfig?.formFields || DEFAULT_FORM_FIELDS;
                    return {
                        ...b,
                        splitConfig: {
                            ...(b.splitConfig || { layoutType: "content_form" }),
                            formFields: [...existing, newField],
                        },
                    };
                })
            );
        } else {
            setBlocks((prev) =>
                prev.map((b) => {
                    if (b.id !== blockId) return b;
                    const existing = b.formConfig?.fields || DEFAULT_FORM_FIELDS;
                    return {
                        ...b,
                        formConfig: {
                            ...(b.formConfig || {
                                formTitle: "Instant Loan Inquiry & Registration",
                                formSubtitle: "Fill details for instant loan eligibility assessment & expert callback.",
                                formButtonText: "Register & Check Eligibility",
                                targetUrl: "/apply-loan",
                                badgeText: "Instant Assessment",
                                footerNote: "🔒 100% Free Service • No CIBIL Impact • Doorstep Support",
                                fields: DEFAULT_FORM_FIELDS,
                            }),
                            fields: [...existing, newField],
                        },
                    };
                })
            );
        }
        setSaveStatus("Unsaved");
    };

    const updateFormField = (blockId: string, fieldId: string, updates: Partial<FormFieldConfig>, isSplit = false) => {
        if (isSplit) {
            setBlocks((prev) =>
                prev.map((b) => {
                    if (b.id !== blockId) return b;
                    const fields = (b.splitConfig?.formFields || DEFAULT_FORM_FIELDS).map((f) =>
                        f.id === fieldId ? { ...f, ...updates } : f
                    );
                    return {
                        ...b,
                        splitConfig: {
                            ...(b.splitConfig || { layoutType: "content_form" }),
                            formFields: fields,
                        },
                    };
                })
            );
        } else {
            setBlocks((prev) =>
                prev.map((b) => {
                    if (b.id !== blockId) return b;
                    const fields = (b.formConfig?.fields || DEFAULT_FORM_FIELDS).map((f) =>
                        f.id === fieldId ? { ...f, ...updates } : f
                    );
                    return {
                        ...b,
                        formConfig: {
                            ...(b.formConfig || {
                                formTitle: "Instant Loan Inquiry & Registration",
                                formSubtitle: "Fill details for instant loan eligibility assessment & expert callback.",
                                formButtonText: "Register & Check Eligibility",
                                targetUrl: "/apply-loan",
                                badgeText: "Instant Assessment",
                                footerNote: "🔒 100% Free Service • No CIBIL Impact • Doorstep Support",
                                fields: DEFAULT_FORM_FIELDS,
                            }),
                            fields,
                        },
                    };
                })
            );
        }
        setSaveStatus("Unsaved");
    };

    const removeFormField = (blockId: string, fieldId: string, isSplit = false) => {
        if (isSplit) {
            setBlocks((prev) =>
                prev.map((b) => {
                    if (b.id !== blockId) return b;
                    const fields = (b.splitConfig?.formFields || DEFAULT_FORM_FIELDS).filter((f) => f.id !== fieldId);
                    return {
                        ...b,
                        splitConfig: {
                            ...(b.splitConfig || { layoutType: "content_form" }),
                            formFields: fields,
                        },
                    };
                })
            );
        } else {
            setBlocks((prev) =>
                prev.map((b) => {
                    if (b.id !== blockId) return b;
                    const fields = (b.formConfig?.fields || DEFAULT_FORM_FIELDS).filter((f) => f.id !== fieldId);
                    return {
                        ...b,
                        formConfig: {
                            ...(b.formConfig || {
                                formTitle: "Instant Loan Inquiry & Registration",
                                formSubtitle: "Fill details for instant loan eligibility assessment & expert callback.",
                                formButtonText: "Register & Check Eligibility",
                                targetUrl: "/apply-loan",
                                badgeText: "Instant Assessment",
                                footerNote: "🔒 100% Free Service • No CIBIL Impact • Doorstep Support",
                                fields: DEFAULT_FORM_FIELDS,
                            }),
                            fields,
                        },
                    };
                })
            );
        }
        setSaveStatus("Unsaved");
    };

    const renderFormFieldsManager = (
        blockId: string,
        fields: FormFieldConfig[],
        isSplit = false,
        onFieldsChange?: (newFields: FormFieldConfig[]) => void
    ) => {
        const handleAdd = (preset?: Partial<FormFieldConfig>) => {
            const newField: FormFieldConfig = {
                id: "f_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
                label: preset?.label || "New Field",
                name: preset?.name || "field_" + Date.now().toString(36),
                type: preset?.type || "text",
                placeholder: preset?.placeholder || "Enter details...",
                required: preset?.required ?? false,
                colSpan: preset?.colSpan || "half",
                options: preset?.options,
            };
            if (onFieldsChange) {
                onFieldsChange([...fields, newField]);
            } else {
                addFormField(blockId, preset, isSplit);
            }
        };

        const handleUpdate = (fieldId: string, updates: Partial<FormFieldConfig>) => {
            if (onFieldsChange) {
                onFieldsChange(fields.map((f) => (f.id === fieldId ? { ...f, ...updates } : f)));
            } else {
                updateFormField(blockId, fieldId, updates, isSplit);
            }
        };

        const handleRemove = (fieldId: string) => {
            if (onFieldsChange) {
                onFieldsChange(fields.filter((f) => f.id !== fieldId));
            } else {
                removeFormField(blockId, fieldId, isSplit);
            }
        };

        const handleMove = (index: number, direction: "up" | "down") => {
            const targetIdx = direction === "up" ? index - 1 : index + 1;
            if (targetIdx < 0 || targetIdx >= fields.length) return;
            const newFields = [...fields];
            const [moved] = newFields.splice(index, 1);
            newFields.splice(targetIdx, 0, moved);
            if (onFieldsChange) {
                onFieldsChange(newFields);
            } else if (isSplit) {
                updateSplitConfig(blockId, { formFields: newFields });
            } else {
                updateFormConfig(blockId, { fields: newFields });
            }
        };

        return (
            <div className="mt-4 p-4 bg-slate-50/90 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                        <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px] text-indigo-600">view_column</span>
                            Form Columns / Fields ({fields.length})
                        </h5>
                        <p className="text-[11px] text-slate-500">Add, edit, reorder columns & configure grid width (1 or 2 per row)</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => handleAdd({ label: "New Column", name: `field_${Date.now().toString(36)}`, type: "text", colSpan: "half", placeholder: "Enter details..." })}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-[14px]">add</span>
                        + Add Column
                    </button>
                </div>

                {/* Quick Preset Buttons */}
                <div className="pt-2 border-t border-slate-200/70">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Quick Presets (+ 1-Click Column):</div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                            type="button"
                            onClick={() => handleAdd({ label: "Full Name", name: "name", type: "text", placeholder: "Student Full Name", required: true, colSpan: "full" })}
                            className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold transition cursor-pointer shadow-2xs"
                        >
                            + Full Name
                        </button>
                        <button
                            type="button"
                            onClick={() => handleAdd({ label: "Mobile / WhatsApp", name: "phone", type: "tel", placeholder: "+91 98765 43210", required: true, colSpan: "half" })}
                            className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold transition cursor-pointer shadow-2xs"
                        >
                            + Phone / WA
                        </button>
                        <button
                            type="button"
                            onClick={() => handleAdd({ label: "Email Address", name: "email", type: "email", placeholder: "student@example.com", required: false, colSpan: "half" })}
                            className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold transition cursor-pointer shadow-2xs"
                        >
                            + Email
                        </button>
                        <button
                            type="button"
                            onClick={() => handleAdd({ label: "Target Country", name: "country", type: "select", options: ["USA", "United Kingdom", "Canada", "Australia", "Germany", "Ireland", "India"], required: true, colSpan: "half" })}
                            className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold transition cursor-pointer shadow-2xs"
                        >
                            + Target Country
                        </button>
                        <button
                            type="button"
                            onClick={() => handleAdd({ label: "Loan Amount Required", name: "amount", type: "select", options: ["₹10L - ₹25L", "₹25L - ₹50L", "₹50L - ₹75L", "₹75 Lakhs+"], required: true, colSpan: "half" })}
                            className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold transition cursor-pointer shadow-2xs"
                        >
                            + Loan Amount
                        </button>
                        <button
                            type="button"
                            onClick={() => handleAdd({ label: "Degree / Course Target", name: "course", type: "select", options: ["MS in Computer Science", "MBA / Management", "Data Science & AI", "Engineering", "Health & Medicine", "Other PG"], colSpan: "half", required: false })}
                            className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold transition cursor-pointer shadow-2xs"
                        >
                            + Degree / Course
                        </button>
                        <button
                            type="button"
                            onClick={() => handleAdd({ label: "Current City / State", name: "city", type: "text", placeholder: "e.g. Hyderabad, Telangana", colSpan: "half", required: false })}
                            className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold transition cursor-pointer shadow-2xs"
                        >
                            + City
                        </button>
                        <button
                            type="button"
                            onClick={() => handleAdd({ label: "Target Intake", name: "intake", type: "select", options: ["Fall 2026", "Spring 2027", "Fall 2027", "Immediate"], colSpan: "half", required: false })}
                            className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold transition cursor-pointer shadow-2xs"
                        >
                            + Intake Season
                        </button>
                        <button
                            type="button"
                            onClick={() => handleAdd({ label: "Standardized Exam Score", name: "exam_score", type: "text", placeholder: "e.g. IELTS 7.5 / GRE 320", colSpan: "half", required: false })}
                            className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold transition cursor-pointer shadow-2xs"
                        >
                            + Test Score
                        </button>
                    </div>
                </div>

                {/* List of Form Columns */}
                <div className="space-y-2.5 mt-2">
                    {fields.map((field, idx) => (
                        <div key={field.id || idx} className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2 transition-all hover:border-slate-300">
                            <div className="flex items-center gap-2 justify-between flex-wrap">
                                <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                                    <div className="flex items-center gap-0.5">
                                        <button
                                            type="button"
                                            disabled={idx === 0}
                                            onClick={() => handleMove(idx, "up")}
                                            className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                            title="Move Up"
                                        >
                                            <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
                                        </button>
                                        <button
                                            type="button"
                                            disabled={idx === fields.length - 1}
                                            onClick={() => handleMove(idx, "down")}
                                            className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                            title="Move Down"
                                        >
                                            <span className="material-symbols-outlined text-[14px]">arrow_downward</span>
                                        </button>
                                    </div>
                                    <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black flex items-center justify-center shrink-0">
                                        {idx + 1}
                                    </span>
                                    <input
                                        type="text"
                                        value={field.label}
                                        onChange={(e) => handleUpdate(field.id, { label: e.target.value })}
                                        placeholder="Column Label (e.g. Full Name)"
                                        className="font-bold text-xs text-slate-800 border-b border-dashed border-slate-300 hover:border-indigo-400 focus:border-indigo-600 focus:outline-none px-1 py-0.5 flex-1"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="flex items-center gap-1 text-[11px] text-slate-600 font-bold cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={field.required ?? false}
                                            onChange={(e) => handleUpdate(field.id, { required: e.target.checked })}
                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 text-xs"
                                        />
                                        Required
                                    </label>
                                    {fields.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemove(field.id)}
                                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                                            title="Delete Column"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">delete</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Column Configuration Properties */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1.5 border-t border-slate-100">
                                <div>
                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Input Type</label>
                                    <select
                                        value={field.type}
                                        onChange={(e) => handleUpdate(field.id, { type: e.target.value as any })}
                                        className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value="text">Text Input</option>
                                        <option value="tel">Phone / WhatsApp</option>
                                        <option value="email">Email Address</option>
                                        <option value="number">Numeric</option>
                                        <option value="select">Dropdown Menu</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Width / Column Span</label>
                                    <select
                                        value={field.colSpan || "half"}
                                        onChange={(e) => handleUpdate(field.id, { colSpan: e.target.value as any })}
                                        className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value="half">Half (50% / 2-Columns Row)</option>
                                        <option value="full">Full (100% / 1-Column Row)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Placeholder</label>
                                    <input
                                        type="text"
                                        value={field.placeholder || ""}
                                        onChange={(e) => handleUpdate(field.id, { placeholder: e.target.value })}
                                        placeholder="e.g. Enter details..."
                                        className="w-full text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            {/* Options if select */}
                            {field.type === "select" && (
                                <div className="pt-1.5 border-t border-slate-100">
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
                                        Dropdown Options (comma separated)
                                    </label>
                                    <input
                                        type="text"
                                        value={(field.options || []).join(", ")}
                                        onChange={(e) => {
                                            const opts = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                                            handleUpdate(field.id, { options: opts });
                                        }}
                                        placeholder="Option 1, Option 2, Option 3..."
                                        className="w-full text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // Drag handlers for sidebar elements
    const handleDragStart = (
        e: DragEvent,
        type: BlockType,
        defaultLayout?: SplitConfig["layoutType"],
        level?: 1 | 2 | 3 | 4 | 5 | 6,
        defaultListType?: "unordered" | "ordered"
    ) => {
        setDraggedType(type);
        setDraggedLayout(defaultLayout);
        setDraggedLevel(level);
        setDraggedListType(defaultListType);
        e.dataTransfer.effectAllowed = "copy";
    };

    const handleDragEnd = () => {
        setDraggedType(null);
        setDraggedLayout(undefined);
        setDraggedLevel(undefined);
        setDraggedListType(undefined);
        setDragOverIndex(null);
    };

    // Drag handlers for reordering blocks
    const handleBlockDragStart = (e: DragEvent, blockId: string) => {
        setDraggingBlockId(blockId);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleBlockDragEnd = () => {
        setDraggingBlockId(null);
        setDragOverIndex(null);
    };

    // Canvas drop zone handlers
    const handleCanvasDragOver = (e: DragEvent, index?: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = draggedType ? "copy" : "move";
        setDragOverIndex(index ?? blocks.length);
    };

    const handleCanvasDrop = (e: DragEvent, index?: number) => {
        e.preventDefault();
        const dropIndex = index ?? blocks.length;

        if (draggedType) {
            // Adding new element from sidebar
            const newBlock = createBlock(draggedType, draggedLayout, draggedLevel, draggedListType);
            const newBlocks = [...blocks];
            newBlocks.splice(dropIndex, 0, newBlock);
            setBlocks(newBlocks);
            setSaveStatus("Unsaved");
        } else if (draggingBlockId) {
            // Reordering existing block
            const fromIndex = blocks.findIndex((b) => b.id === draggingBlockId);
            if (fromIndex !== -1 && fromIndex !== dropIndex) {
                const newBlocks = [...blocks];
                const [removed] = newBlocks.splice(fromIndex, 1);
                const adjustedIndex = dropIndex > fromIndex ? dropIndex - 1 : dropIndex;
                newBlocks.splice(adjustedIndex, 0, removed);
                setBlocks(newBlocks);
                setSaveStatus("Unsaved");
            }
        }

        setDraggedType(null);
        setDraggedLayout(undefined);
        setDraggedLevel(undefined);
        setDraggedListType(undefined);
        setDraggingBlockId(null);
        setDragOverIndex(null);
    };

    // Block operations
    const updateBlock = (id: string, content: string) => {
        setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, content } : b)));
        setSaveStatus("Unsaved");
    };

    const updateBlockProperties = (id: string, updates: Partial<Block>) => {
        setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
        setSaveStatus("Unsaved");
    };

    const handleImageFileUpload = (blockId: string, file?: File | null) => {
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            alert("Please select a valid image file (PNG, JPG, WEBP, GIF, SVG).");
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            setBlocks((prev) =>
                prev.map((b) =>
                    b.id === blockId
                        ? {
                              ...b,
                              content: dataUrl,
                              fileName: file.name,
                              fileSize: formatMediaFileSize(file.size),
                              mediaMode: "upload",
                          }
                        : b
                )
            );
            setSaveStatus("Unsaved");
        };
        reader.readAsDataURL(file);
    };

    const handleVideoFileUpload = (blockId: string, file?: File | null) => {
        if (!file) return;
        if (!file.type.startsWith("video/") && !/\.(mp4|webm|ogg|mov|m4v)$/i.test(file.name)) {
            alert("Please select a valid video file (.mp4, .webm, .ogg, .mov).");
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            setBlocks((prev) =>
                prev.map((b) =>
                    b.id === blockId
                        ? {
                              ...b,
                              content: dataUrl,
                              fileName: file.name,
                              fileSize: formatMediaFileSize(file.size),
                              mediaMode: "upload",
                          }
                        : b
                )
            );
            setSaveStatus("Unsaved");
        };
        reader.readAsDataURL(file);
    };

    const handleModalImageFileUpload = (file?: File | null) => {
        if (!file || !editingBlock) return;
        if (!file.type.startsWith("image/")) {
            alert("Please select a valid image file (PNG, JPG, WEBP, GIF, SVG).");
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            setEditingBlock({
                ...editingBlock,
                content: dataUrl,
                fileName: file.name,
                fileSize: formatMediaFileSize(file.size),
                mediaMode: "upload",
            });
        };
        reader.readAsDataURL(file);
    };

    const handleModalVideoFileUpload = (file?: File | null) => {
        if (!file || !editingBlock) return;
        if (!file.type.startsWith("video/") && !/\.(mp4|webm|ogg|mov|m4v)$/i.test(file.name)) {
            alert("Please select a valid video file (.mp4, .webm, .ogg, .mov).");
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            setEditingBlock({
                ...editingBlock,
                content: dataUrl,
                fileName: file.name,
                fileSize: formatMediaFileSize(file.size),
                mediaMode: "upload",
            });
        };
        reader.readAsDataURL(file);
    };

    const removeBlock = (id: string) => {
        setBlocks((prev) => prev.filter((b) => b.id !== id));
        setSaveStatus("Unsaved");
    };

    const duplicateBlock = (id: string) => {
        setBlocks((prev) => {
            const index = prev.findIndex((b) => b.id === id);
            if (index !== -1) {
                const newBlock = { ...prev[index], id: Date.now().toString() };
                const newBlocks = [...prev];
                newBlocks.splice(index + 1, 0, newBlock);
                return newBlocks;
            }
            return prev;
        });
        setSaveStatus("Unsaved");
    };

    const openEditModal = (block: Block) => {
        setEditingBlock({ ...block });
        setShowModal(true);
    };

    const saveEditModal = () => {
        if (editingBlock) {
            setBlocks(blocks.map((b) => (b.id === editingBlock.id ? editingBlock : b)));
            setSaveStatus("Unsaved");
        }
        setShowModal(false);
        setEditingBlock(null);
    };

    // Load template
    const loadTemplate = (templateId: string) => {
        let templateBlocks: Block[] = [];
        if (templateId === "basic") {
            templateBlocks = [
                createBlock("heading"),
                createBlock("image"),
                createBlock("text"),
                createBlock("text"),
            ];
        } else if (templateId === "multimedia") {
            templateBlocks = [
                createBlock("heading"),
                createBlock("image"),
                createBlock("text"),
                createBlock("video"),
                createBlock("button"),
            ];
        } else if (templateId === "tutorial") {
            templateBlocks = [
                createBlock("heading"),
                createBlock("text"),
                createBlock("image"),
                createBlock("list"),
                createBlock("code"),
                createBlock("divider"),
                createBlock("text"),
            ];
        }
        setBlocks(templateBlocks);
        setSaveStatus("Unsaved");
    };

    // Auto-save simulation
    const autoSave = () => {
        setSaveStatus("Saving...");
        setTimeout(() => setSaveStatus("Saved"), 1000);
    };

    // Preview blog
    const previewBlog = () => {
        alert("Preview functionality - blog preview generated");
    };

    // Publish blog
    const handlePublish = async () => {
        if (!title.trim()) {
            alert("Please enter a blog title.");
            return;
        }
        if (blocks.length === 0) {
            alert("Please add some content to your blog.");
            return;
        }

        setLoading(true);
        try {
            const generateFormHtml = (formCfg: {
                formTitle?: string;
                formSubtitle?: string;
                formButtonText?: string;
                targetUrl?: string;
                badgeText?: string;
                footerNote?: string;
                fields?: FormFieldConfig[];
            }, isStandalone = false) => {
                const fields = formCfg.fields && formCfg.fields.length > 0 ? formCfg.fields : DEFAULT_FORM_FIELDS;
                const formTitle = formCfg.formTitle || "Instant Loan Inquiry & Registration";
                const formSubtitle = formCfg.formSubtitle || "Fill details for instant loan eligibility assessment & expert callback within 15 minutes.";
                const formBtn = formCfg.formButtonText || "Register & Check Eligibility";
                const badge = formCfg.badgeText || "Instant Assessment";
                const footer = formCfg.footerNote || "🔒 100% Free Service • No CIBIL Impact • Doorstep Support";

                const fieldsHtml = fields.map((f) => {
                    const colClass = f.colSpan === "full" ? "md:col-span-2" : "md:col-span-1";
                    const reqAttr = f.required ? "required" : "";
                    const reqStar = f.required ? '<span class="text-rose-500 ml-0.5">*</span>' : "";
                    const fieldName = f.name || f.label.toLowerCase().replace(/[^a-z0-9]/g, "_");

                    if (f.type === "select") {
                        const opts = (f.options && f.options.length > 0 ? f.options : ["Option 1", "Option 2"])
                            .map((opt) => `<option value="${opt}">${opt}</option>`)
                            .join("");
                        return `
                        <div class="${colClass}">
                            <label class="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">${f.label}${reqStar}</label>
                            <select name="${fieldName}" ${reqAttr} class="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all">
                                ${opts}
                            </select>
                        </div>`;
                    }

                    return `
                    <div class="${colClass}">
                        <label class="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">${f.label}${reqStar}</label>
                        <input type="${f.type}" name="${fieldName}" ${reqAttr} placeholder="${f.placeholder || ''}" class="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all" />
                    </div>`;
                }).join("");

                return `
                <div class="blog-inquiry-widget not-prose bg-white p-6 md:p-8 rounded-3xl border border-indigo-100 shadow-xl shadow-indigo-100/50 relative overflow-hidden transition-all ${isStandalone ? 'max-w-2xl mx-auto my-10' : ''}">
                    <div class="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600"></div>
                    <div class="mb-5">
                        <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-wider rounded-full mb-2.5 border border-indigo-100">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            ${badge}
                        </span>
                        <h3 class="text-xl md:text-2xl font-extrabold text-slate-900 mb-1.5 tracking-tight">${formTitle}</h3>
                        <p class="text-slate-500 text-xs leading-relaxed">${formSubtitle}</p>
                    </div>

                    <div class="blog-form-error hidden mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold"></div>

                    <form action="/api/blogs/inquiry" method="POST" class="blog-inquiry-form space-y-3.5" onsubmit="return window.handleBlogLeadSubmit ? window.handleBlogLeadSubmit(this, event) : true;">
                        <input type="hidden" name="source" value="${isStandalone ? 'blog_register_standalone' : 'blog_register_split'}" />
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                            ${fieldsHtml}
                        </div>
                        <button type="submit" class="btn-submit-inquiry w-full mt-3 py-3.5 px-5 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 hover:from-emerald-700 hover:to-indigo-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer">
                            <span class="btn-text font-bold">${formBtn}</span>
                            <span class="btn-arrow font-bold">&rarr;</span>
                        </button>
                        <div class="mt-2.5 text-center">
                            <a href="/registration?source=blog" class="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline">
                                <span>Prefer step-by-step form? Open full registration page</span>
                                <span>&rarr;</span>
                            </a>
                        </div>
                        <p class="text-[11px] text-center text-slate-400 mt-2 flex items-center justify-center gap-1.5">${footer}</p>
                    </form>

                    <div class="blog-form-success hidden text-center py-8 px-6 bg-gradient-to-br from-emerald-50/90 to-teal-50/90 rounded-2xl border border-emerald-200/90 shadow-sm animate-fade-in">
                        <div class="w-14 h-14 bg-gradient-to-tr from-emerald-500 to-teal-500 text-white rounded-full flex items-center justify-center mx-auto mb-3.5 shadow-lg shadow-emerald-500/25 text-xl font-black">
                            ✓
                        </div>
                        <span class="inline-block px-3 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider rounded-full mb-2">Registration Confirmed</span>
                        <h4 class="text-xl font-extrabold text-slate-900 mb-1.5">Inquiry Registered Successfully!</h4>
                        <p class="text-slate-600 text-xs leading-relaxed max-w-md mx-auto mb-4">
                            Thank you, <span class="lead-submitted-name font-bold text-slate-900">Student</span>! Your loan consultation request has been stored in our system. A certified VidyaLoans advisor will contact you within <strong class="text-emerald-700 font-bold">15 minutes</strong>.
                        </p>
                        <div class="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white/90 rounded-lg border border-emerald-200 text-[11px] font-semibold text-emerald-700 shadow-2xs mb-4">
                            <span>🔒 100% Free Service • No CIBIL Impact • Doorstep Support</span>
                        </div>
                        <div>
                            <button type="button" class="btn-reset-inquiry px-4 py-2 text-xs font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-100 hover:bg-emerald-200/80 rounded-xl transition-all cursor-pointer">
                                + Submit Another Inquiry
                            </button>
                        </div>
                    </div>
                </div>`;
            };

            const htmlContent = blocks
                .map((b) => {
                    switch (b.type) {
                        case "heading": {
                            const lvl = (b.level || 2) as 1 | 2 | 3 | 4 | 5 | 6;
                            const levelStyles: Record<number, string> = {
                                1: "text-4xl font-black mt-8 mb-4 tracking-tight text-slate-900",
                                2: "text-3xl font-extrabold mt-8 mb-4 tracking-tight text-slate-900",
                                3: "text-2xl font-bold mt-6 mb-3 tracking-tight text-slate-800",
                                4: "text-xl font-bold mt-5 mb-2 text-slate-800",
                                5: "text-lg font-semibold mt-4 mb-2 text-slate-700",
                                6: "text-base font-semibold mt-4 mb-2 uppercase tracking-wider text-slate-600",
                            };
                            const cls = levelStyles[lvl] || levelStyles[2];
                            return `<h${lvl} class="${cls}">${b.content}</h${lvl}>`;
                        }
                        case "text":
                            return `<p class="text-lg leading-relaxed text-gray-700 mb-4">${b.content}</p>`;
                        case "image": {
                            const st = b.style || {};
                            const aspect = st.aspectRatio && st.aspectRatio !== "auto" ? `aspect-ratio: ${st.aspectRatio};` : "";
                            const maxH = st.maxHeight ? `max-height: ${st.maxHeight};` : "max-height: 480px;";
                            const fit = st.objectFit || "cover";
                            const pos = st.objectPosition || "center";
                            const rad = st.borderRadius || "16px";
                            const captionHtml = b.caption ? `<figcaption class="text-xs text-center text-slate-500 font-medium mt-2">${b.caption}</figcaption>` : "";
                            return `<figure class="my-8"><div class="overflow-hidden shadow-lg border border-slate-200/80" style="border-radius: ${rad};"><img src="${b.content}" class="w-full block" style="object-fit: ${fit}; object-position: ${pos}; ${maxH} ${aspect}" alt="${b.fileName || 'Blog Image'}" /></div>${captionHtml}</figure>`;
                        }
                        case "video": {
                            const isDirect = isDirectVideoSource(b.content);
                            const captionHtml = b.caption ? `<figcaption class="text-xs text-center text-slate-500 font-medium mt-2">${b.caption}</figcaption>` : "";
                            if (isDirect) {
                                return `<figure class="my-8"><div class="aspect-video rounded-2xl overflow-hidden shadow-lg border border-slate-200 bg-black"><video controls playsinline class="w-full h-full object-contain" src="${b.content}">Your browser does not support the video tag.</video></div>${captionHtml}</figure>`;
                            }
                            const formattedUrl = formatVideoEmbedUrl(b.content || "");
                            return `<figure class="my-8"><div class="aspect-video rounded-2xl overflow-hidden shadow-lg border border-slate-200 bg-black"><iframe src="${formattedUrl}" class="w-full h-full" frameborder="0" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe></div>${captionHtml}</figure>`;
                        }
                        case "button": {
                            const text = b.buttonText || b.content || "Explore Loan Options";
                            const url = b.buttonUrl || "/apply-loan";
                            const isNewTab = b.buttonNewTab !== false;
                            const align = b.buttonAlign || "center";
                            const variant = b.buttonVariant || "gradient";
                            const size = b.buttonSize || "md";

                            const variantStyles: Record<string, string> = {
                                gradient: "background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.4);",
                                emerald: "background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff; box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.4);",
                                dark: "background: #0f172a; color: #ffffff; box-shadow: 0 10px 20px -5px rgba(15, 23, 42, 0.3);",
                                outline: "background: transparent; color: #4f46e5; border: 2px solid #4f46e5;",
                                amber: "background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%); color: #ffffff; box-shadow: 0 10px 25px -5px rgba(245, 158, 11, 0.4);",
                                rose: "background: linear-gradient(135deg, #e11d48 0%, #f43f5e 100%); color: #ffffff; box-shadow: 0 10px 25px -5px rgba(244, 63, 94, 0.4);",
                            };

                            const sizeStyles: Record<string, string> = {
                                sm: "padding: 8px 20px; font-size: 13px; border-radius: 10px;",
                                md: "padding: 12px 28px; font-size: 15px; border-radius: 14px;",
                                lg: "padding: 16px 36px; font-size: 17px; border-radius: 16px;",
                            };

                            const alignClass = align === "left" ? "text-left" : align === "right" ? "text-right" : align === "full" ? "text-center w-full" : "text-center";
                            const btnDisplay = align === "full" ? "display: flex; width: 100%; justify-content: center;" : "display: inline-flex;";

                            return `<div class="my-6 not-prose blog-button-wrapper ${alignClass}"><a href="${url}" target="${isNewTab ? "_blank" : "_self"}" ${isNewTab ? 'rel="noopener noreferrer"' : ""} class="blog-btn" style="${btnDisplay} align-items: center; gap: 8px; font-weight: 700; text-decoration: none; transition: all 0.2s ease; ${variantStyles[variant] || variantStyles.gradient} ${sizeStyles[size] || sizeStyles.md}">${text} &rarr;</a></div>`;
                        }
                        case "list": {
                            const isOrdered = b.listType === "ordered";
                            const tag = isOrdered ? "ol" : "ul";
                            const listClass = isOrdered
                                ? "list-decimal list-outside ml-6 space-y-2 text-slate-700"
                                : "list-disc list-outside ml-6 space-y-2 text-slate-700";
                            const items = (b.content || "")
                                .split("\n")
                                .map((item) => item.replace(/^(\s*•|\s*-|\s*\d+[\.\)])\s*/, "").trim())
                                .filter(Boolean)
                                .map((item) => `<li class="py-0.5 leading-relaxed">${item}</li>`)
                                .join("");
                            return `<${tag} class="${listClass} my-4">${items}</${tag}>`;
                        }
                        case "quote":
                            return `<blockquote class="border-l-4 border-purple-500 pl-6 py-4 text-xl text-gray-600 my-8 bg-purple-50 rounded-r-xl">"${b.content}"</blockquote>`;
                        case "code":
                            return `<pre class="bg-gray-900 text-green-400 p-6 rounded-xl my-6 overflow-x-auto"><code>${b.content}</code></pre>`;
                        case "divider":
                            return `<hr class="my-10 border-gray-200" />`;
                        case "spacer":
                            return `<div class="h-12"></div>`;
                        case "split_content":
                        case "container": {
                            const config: Partial<SplitConfig> = b.splitConfig || {};
                            const layout = config.layoutType || "image_text";
                            const ratio = config.ratio || "50_50";
                            let leftSpan = "md:col-span-6";
                            let rightSpan = "md:col-span-6";
                            if (ratio === "40_60") { leftSpan = "md:col-span-5"; rightSpan = "md:col-span-7"; }
                            else if (ratio === "60_40") { leftSpan = "md:col-span-7"; rightSpan = "md:col-span-5"; }
                            else if (ratio === "33_67") { leftSpan = "md:col-span-4"; rightSpan = "md:col-span-8"; }

                            const renderImg = (url?: string, caption?: string) => `
                                <div class="rounded-2xl overflow-hidden shadow-md border border-slate-200 bg-slate-100">
                                    <img src="${url || 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=800'}" class="w-full h-full object-cover max-h-[420px]" alt="Blog visual" />
                                    ${caption ? `<div class="p-2 bg-slate-900/70 text-white text-[11px] text-center">${caption}</div>` : ''}
                                </div>`;

                            const renderTxt = (title?: string, content?: string, items?: string[], btnText?: string, btnUrl?: string) => `
                                <div class="flex flex-col justify-center">
                                    ${title ? `<h3 class="text-2xl font-bold text-slate-900 mb-2">${title}</h3>` : ''}
                                    ${content ? `<p class="text-slate-600 text-sm leading-relaxed mb-4">${content}</p>` : ''}
                                    ${(items && items.length > 0) ? `<ul class="space-y-1.5 mb-4 pl-0 list-none">${items.map(it => `<li class="flex items-center gap-2 text-xs text-slate-700 font-medium"><span class="text-emerald-500 font-bold">✓</span><span>${it}</span></li>`).join('')}</ul>` : ''}
                                    ${btnText ? `<div class="pt-1"><a href="${btnUrl || '/apply-loan'}" class="inline-block px-5 py-2.5 !bg-indigo-600 hover:!bg-indigo-700 !text-white rounded-xl text-xs font-bold shadow-md transition-colors" style="background-color: #4f46e5 !important; color: #ffffff !important; display: inline-block;">${btnText} &rarr;</a></div>` : ''}
                                </div>`;

                            let leftHtml = "";
                            let rightHtml = "";
                            if (layout === "image_text") {
                                leftHtml = renderImg(config.leftImageUrl, config.leftImageCaption);
                                rightHtml = renderTxt(config.rightTitle, config.rightContent, config.rightItems, config.buttonText, config.buttonUrl);
                            } else if (layout === "text_image") {
                                leftHtml = renderTxt(config.leftTitle, config.leftContent, config.leftItems, config.buttonText, config.buttonUrl);
                                rightHtml = renderImg(config.rightImageUrl, config.rightImageCaption);
                            } else if (layout === "content_form") {
                                leftHtml = renderTxt(config.leftTitle, config.leftContent, config.leftItems, config.buttonText, config.buttonUrl);
                                rightHtml = generateFormHtml({
                                    formTitle: config.formTitle,
                                    formSubtitle: config.formSubtitle,
                                    formButtonText: config.formButtonText,
                                    targetUrl: config.buttonUrl || "/apply-loan",
                                    badgeText: "Instant Assessment",
                                    footerNote: "🔒 100% Free Service • No CIBIL Impact • Doorstep Support",
                                    fields: config.formFields && config.formFields.length > 0 ? config.formFields : DEFAULT_FORM_FIELDS,
                                }, false);
                            } else if (layout === "form_content") {
                                leftHtml = generateFormHtml({
                                    formTitle: config.formTitle,
                                    formSubtitle: config.formSubtitle,
                                    formButtonText: config.formButtonText,
                                    targetUrl: config.buttonUrl || "/apply-loan",
                                    badgeText: "Instant Assessment",
                                    footerNote: "🔒 100% Free Service • No CIBIL Impact • Doorstep Support",
                                    fields: config.formFields && config.formFields.length > 0 ? config.formFields : DEFAULT_FORM_FIELDS,
                                }, false);
                                rightHtml = renderTxt(config.rightTitle, config.rightContent, config.rightItems, config.buttonText, config.buttonUrl);
                            } else {
                                leftHtml = renderTxt(config.leftTitle, config.leftContent, config.leftItems);
                                rightHtml = renderTxt(config.rightTitle, config.rightContent, config.rightItems, config.buttonText, config.buttonUrl);
                            }

                            return `<div class="blog-split-container not-prose my-8 p-6 md:p-8 bg-slate-50/70 rounded-3xl border border-slate-200/80"><div class="grid grid-cols-1 md:grid-cols-12 gap-8 items-center"><div class="${leftSpan}">${leftHtml}</div><div class="${rightSpan}">${rightHtml}</div></div></div>`;
                        }
                        case "registration_form": {
                            const fConfig = b.formConfig || {
                                formTitle: "Instant Loan Inquiry & Registration",
                                formSubtitle: "Fill details for instant loan eligibility assessment & expert callback within 15 minutes.",
                                formButtonText: "Register & Check Eligibility",
                                targetUrl: "/apply-loan",
                                badgeText: "Instant Assessment",
                                footerNote: "🔒 100% Free Service • No CIBIL Impact • Doorstep Support",
                                fields: DEFAULT_FORM_FIELDS,
                            };
                            return generateFormHtml(fConfig, true);
                        }
                        case "tags": {
                            const tagList = (b.content || "").split(",").map((t) => t.trim()).filter(Boolean);
                            const pills = tagList.map((t) => `<span class="inline-block px-3 py-1 bg-purple-50 text-purple-700 text-xs font-bold rounded-full mr-2 mb-2 border border-purple-200">#${t.replace(/^#/, "")}</span>`).join("");
                            return `<div class="my-6 pt-4 border-t border-gray-100"><p class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Topics & Tags</p><div class="flex flex-wrap gap-1">${pills}</div></div>`;
                        }
                        default:
                            return "";
                    }
                })
                .join("");

            const seoData = {
                metaTitle: metaTitle.trim() || title.trim(),
                metaDescription: metaDescription.trim() || excerpt.trim(),
                focusKeyword: focusKeyword.trim(),
                canonicalUrl: canonicalUrl.trim(),
                noIndex,
                faqSchema: faqSchema.filter((f) => f.question?.trim() && f.answer?.trim()),
            };

            const blogData = {
                title,
                slug: slug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                category,
                authorName: author,
                content: `${htmlContent}\n<!--BLOCKS_JSON_START-->${JSON.stringify(blocks)}<!--BLOCKS_JSON_END-->\n<!--SEO_JSON_START-->${JSON.stringify(seoData)}<!--SEO_JSON_END-->`,
                isPublished,
                isFeatured,
                featuredImage: blocks.find((b) => b.type === "image")?.content || initialBlog?.coverImage || initialBlog?.featuredImage || "",
                excerpt: excerpt || metaDescription || blocks.find((b) => b.type === "text")?.content?.substring(0, 150) + "...",
                tags: typeof tags === "string" ? tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
                metaTitle: metaTitle.trim() || title.trim(),
                metaDescription: metaDescription.trim() || excerpt.trim(),
                focusKeyword: focusKeyword.trim() || undefined,
                canonicalUrl: canonicalUrl.trim() || undefined,
                noIndex,
                faqSchema: seoData.faqSchema,
            };

            const isEditing = Boolean(initialBlog && (initialBlog.id || initialBlog._id));
            const editId = initialBlog?.id || initialBlog?._id;
            let res: any;
            if (isEditing) {
                res = await blogApi.update(editId, blogData).catch(async () => {
                    return await adminApi.createBlog(blogData);
                });
            } else {
                res = await blogApi.create(blogData).catch(async () => {
                    return await adminApi.createBlog(blogData);
                });
            }

            if (res?.success || res?.data || res?._id || res?.id) {
                alert(isEditing ? "Blog updated successfully!" : "Blog published successfully!");
                if (onPublished) {
                    onPublished();
                } else {
                    router.push(backHref);
                }
            } else {
                alert(res?.message || "Failed to publish blog");
            }
        } catch (e) {
            console.error(e);
            alert("An error occurred while publishing.");
        } finally {
            setLoading(false);
        }
    };

    // Render block content for canvas
    const renderBlockContent = (block: Block) => {
        switch (block.type) {
            case "heading": {
                const lvl = (block.level || 2) as 1 | 2 | 3 | 4 | 5 | 6;
                const Tag = `h${lvl}` as any;
                const headingStyles: Record<number, string> = {
                    1: "text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight",
                    2: "text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight leading-snug",
                    3: "text-xl md:text-2xl font-bold text-slate-800 leading-snug",
                    4: "text-lg md:text-xl font-bold text-slate-800",
                    5: "text-base md:text-lg font-semibold text-slate-700",
                    6: "text-sm font-bold text-slate-600 uppercase tracking-wider",
                };
                const headingLevelNames: Record<number, string> = {
                    1: "H1 Main Headline",
                    2: "H2 Section Heading",
                    3: "H3 Subsection",
                    4: "H4 Minor Heading",
                    5: "H5 Small Heading",
                    6: "H6 Micro Heading",
                };

                return (
                    <div className="space-y-2 group/heading">
                        {/* Heading Level Selector Toolbar */}
                        <div className="flex items-center justify-between gap-2 flex-wrap pb-1.5 border-b border-slate-200 text-xs">
                            <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold text-[11px] border border-blue-200/80 shadow-2xs">
                                    <span className="material-symbols-outlined text-[13px]">title</span>
                                    {headingLevelNames[lvl]}
                                </span>
                                <span className="text-[10px] text-slate-400 font-semibold hidden sm:inline">| Switch Level:</span>
                                <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                    {([1, 2, 3, 4, 5, 6] as const).map((l) => (
                                        <button
                                            key={l}
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                updateBlockLevel(block.id, l);
                                            }}
                                            title={`Switch to H${l} Heading`}
                                            className={`px-2 py-0.5 rounded text-[11px] font-black cursor-pointer transition-all ${
                                                lvl === l
                                                    ? "bg-indigo-600 text-white shadow-xs scale-105"
                                                    : "text-slate-600 hover:text-slate-900 hover:bg-white"
                                            }`}
                                        >
                                            H{l}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400">&lt;h{lvl}&gt; tag</span>
                        </div>

                        <Tag
                            contentEditable
                            suppressContentEditableWarning
                            onPaste={(e: any) => {
                                e.preventDefault();
                                const text = e.clipboardData.getData("text/plain");
                                document.execCommand("insertText", false, text);
                                updateBlock(block.id, e.currentTarget.textContent || "");
                            }}
                            onBlur={(e: any) => updateBlock(block.id, e.currentTarget.textContent || "")}
                            className={`${headingStyles[lvl] || headingStyles[2]} outline-none focus:ring-2 focus:ring-indigo-200 rounded px-1 transition-all`}
                        >
                            {block.content}
                        </Tag>
                    </div>
                );
            }
            case "text": {
                const rawText = (block.content || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
                const blockWordCount = rawText ? rawText.split(/\s+/).length : 0;
                const blockCharCount = rawText.length;
                const blockReadTime = Math.max(1, Math.ceil(blockWordCount / 200));

                return (
                    <div className="space-y-2 group/textblock">
                        {/* Real-Time Live Text Editor Header & WYSIWYG Toolbar */}
                        <div className="bg-slate-100/90 p-2 rounded-xl border border-slate-200 space-y-2 shadow-2xs">
                            {/* Top Row: Real-time Block Metrics & Style Presets */}
                            <div className="flex items-center justify-between gap-2 flex-wrap pb-1.5 border-b border-slate-200 text-xs">
                                <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold text-[11px] border border-indigo-200/80 shadow-2xs">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <span>📝 {blockWordCount} words</span>
                                        <span className="text-indigo-300">•</span>
                                        <span>{blockCharCount} chars</span>
                                        <span className="text-indigo-300">•</span>
                                        <span>~{blockReadTime} min read</span>
                                    </span>
                                </div>
                                <div className="flex items-center gap-1 text-[11px]">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Preset:</span>
                                    <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => applyTextPreset(block.id, "body")}
                                        className="px-2 py-0.5 rounded font-medium bg-white text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 cursor-pointer transition-colors shadow-2xs"
                                    >
                                        Body
                                    </button>
                                    <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => applyTextPreset(block.id, "lead")}
                                        className="px-2 py-0.5 rounded font-bold bg-white text-indigo-700 hover:bg-indigo-50 border border-indigo-200 cursor-pointer transition-colors shadow-2xs"
                                    >
                                        Lead
                                    </button>
                                    <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => applyTextPreset(block.id, "editorial")}
                                        className="px-2 py-0.5 rounded font-serif italic bg-white text-slate-800 hover:bg-amber-50 border border-slate-200 cursor-pointer transition-colors shadow-2xs"
                                    >
                                        Editorial
                                    </button>
                                    <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => applyTextPreset(block.id, "tip")}
                                        className="px-2 py-0.5 rounded font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 cursor-pointer transition-colors shadow-2xs"
                                    >
                                        Deal Tip
                                    </button>
                                    <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => applyTextPreset(block.id, "card")}
                                        className="px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-700 hover:bg-white border border-slate-300 cursor-pointer transition-colors shadow-2xs"
                                    >
                                        Card
                                    </button>
                                </div>
                            </div>

                            {/* Bottom Row: Full Formatting Controls */}
                            <div className="flex items-center gap-1.5 flex-wrap text-xs">
                                {/* Font Family Selector */}
                                <div className="relative inline-flex items-center">
                                    <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                            saveSelection();
                                            setActiveFontFamilyPicker(activeFontFamilyPicker === block.id ? null : block.id);
                                            setActiveFontSizePicker(null);
                                            setActiveHighlightPicker(null);
                                            setActiveColorPicker(null);
                                        }}
                                        className="px-2 py-1 rounded-lg bg-white border border-slate-200 hover:border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1 cursor-pointer shadow-2xs"
                                        title="Font Family"
                                    >
                                        <span>Font</span>
                                        <span className="text-[10px] text-slate-400">▾</span>
                                    </button>
                                    {activeFontFamilyPicker === block.id && (
                                        <div
                                            onMouseDown={(e) => e.preventDefault()}
                                            className="absolute left-0 top-full mt-1 bg-white p-1.5 rounded-xl shadow-xl border border-slate-200 flex flex-col gap-1 z-30 min-w-[160px]"
                                        >
                                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider px-2 py-0.5">Font Family</div>
                                            {FONT_FAMILIES.map((f) => (
                                                <button
                                                    key={f.value}
                                                    type="button"
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    onClick={() => applyFontFamily(block.id, f.value)}
                                                    className="px-2.5 py-1 text-left text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg cursor-pointer transition-colors"
                                                    style={{ fontFamily: f.value }}
                                                >
                                                    {f.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Font Size Selector */}
                                <div className="relative inline-flex items-center">
                                    <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                            saveSelection();
                                            setActiveFontSizePicker(activeFontSizePicker === block.id ? null : block.id);
                                            setActiveFontFamilyPicker(null);
                                            setActiveHighlightPicker(null);
                                            setActiveColorPicker(null);
                                        }}
                                        className="px-2 py-1 rounded-lg bg-white border border-slate-200 hover:border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1 cursor-pointer shadow-2xs"
                                        title="Font Size"
                                    >
                                        <span>Size</span>
                                        <span className="text-[10px] text-slate-400">▾</span>
                                    </button>
                                    {activeFontSizePicker === block.id && (
                                        <div
                                            onMouseDown={(e) => e.preventDefault()}
                                            className="absolute left-0 top-full mt-1 bg-white p-1.5 rounded-xl shadow-xl border border-slate-200 flex flex-col gap-1 z-30 min-w-[140px]"
                                        >
                                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider px-2 py-0.5">Font Size</div>
                                            {FONT_SIZES.map((s) => (
                                                <button
                                                    key={s.value}
                                                    type="button"
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    onClick={() => applyFontSize(block.id, s.value)}
                                                    className="px-2.5 py-1 text-left text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg cursor-pointer transition-colors"
                                                >
                                                    {s.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="w-[1px] h-5 bg-slate-200 mx-0.5" />

                                {/* Inline Text Styling: Bold, Italic, Underline, Strikethrough */}
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
                                    className="w-7 h-7 rounded-lg hover:bg-white text-slate-700 underline text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer border border-transparent hover:border-slate-200 shadow-2xs"
                                    title="Underline (Ctrl+U)"
                                >
                                    U
                                </button>
                                <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => applyInlineFormat("strikeThrough", "", block.id)}
                                    className="w-7 h-7 rounded-lg hover:bg-white text-slate-700 line-through text-xs font-medium flex items-center justify-center transition-colors cursor-pointer border border-transparent hover:border-slate-200 shadow-2xs"
                                    title="Strikethrough"
                                >
                                    S
                                </button>

                                <div className="w-[1px] h-5 bg-slate-200 mx-0.5" />

                                {/* Highlight Dropdown + Quick Highlight Button */}
                                <div className="relative inline-flex items-center">
                                    <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => applyHighlight(block.id, "#fef08a", "#854d0e")}
                                        className="px-2.5 py-1 text-xs font-black text-amber-900 bg-amber-200 hover:bg-amber-300 rounded-l-lg cursor-pointer shadow-2xs border-r border-amber-300/80 flex items-center gap-1 transition-colors"
                                        title="Quick Yellow Highlight (select text first)"
                                    >
                                        <span>Highlight</span>
                                    </button>
                                    <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                            saveSelection();
                                            setActiveHighlightPicker(activeHighlightPicker === block.id ? null : block.id);
                                            setActiveColorPicker(null);
                                            setActiveFontSizePicker(null);
                                            setActiveFontFamilyPicker(null);
                                        }}
                                        className="px-1.5 py-1 text-xs text-amber-900 bg-amber-200 hover:bg-amber-300 rounded-r-lg cursor-pointer transition-colors"
                                        title="Choose Highlight Color"
                                    >
                                        ▾
                                    </button>
                                    {activeHighlightPicker === block.id && (
                                        <div
                                            onMouseDown={(e) => e.preventDefault()}
                                            className="absolute top-full left-0 mt-1 z-30 bg-white p-2.5 rounded-xl shadow-xl border border-slate-200 flex flex-col gap-2 min-w-[210px]"
                                        >
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 flex items-center justify-between">
                                                <span>Highlight Palette</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveHighlightPicker(null)}
                                                    className="text-slate-400 hover:text-slate-700 cursor-pointer font-bold"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-3 gap-1.5">
                                                {HIGHLIGHT_SWATCHES.map((swatch) => (
                                                    <button
                                                        key={swatch.name}
                                                        type="button"
                                                        onMouseDown={(e) => e.preventDefault()}
                                                        onClick={() => applyHighlight(block.id, swatch.bg, swatch.text)}
                                                        className="px-2 py-1.5 text-[11px] font-bold rounded-lg cursor-pointer text-center hover:scale-105 transition-transform"
                                                        style={{
                                                            backgroundColor: swatch.bg,
                                                            color: swatch.text,
                                                            border: `1px solid ${swatch.border}`,
                                                        }}
                                                    >
                                                        {swatch.name}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="border-t border-slate-100 pt-1.5">
                                                <button
                                                    type="button"
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    onClick={() => removeHighlight(block.id)}
                                                    className="w-full px-2.5 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg cursor-pointer flex items-center justify-center gap-1.5 transition-colors border border-rose-200/80"
                                                >
                                                    <span>✕ Remove Highlight</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Dedicated Instant Unhighlight Button */}
                                <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => removeHighlight(block.id)}
                                    className="px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg cursor-pointer border border-rose-200 hover:border-rose-300 shadow-2xs flex items-center gap-1 transition-colors"
                                    title="Unhighlight: Remove highlight from selected text or cursor position"
                                >
                                    <span>✕ Unhighlight</span>
                                </button>

                                <div className="w-[1px] h-5 bg-slate-200 mx-0.5" />

                                {/* Text Color Picker */}
                                <div className="relative inline-flex items-center">
                                    <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                            saveSelection();
                                            setActiveColorPicker(activeColorPicker === block.id ? null : block.id);
                                            setActiveHighlightPicker(null);
                                            setActiveFontSizePicker(null);
                                            setActiveFontFamilyPicker(null);
                                        }}
                                        className="px-2 py-1 rounded-lg bg-white border border-slate-200 hover:border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                        title="Text Color"
                                    >
                                        <span>Color</span>
                                        <span
                                            className="w-3 h-3 rounded-full border border-slate-300 inline-block shadow-2xs"
                                            style={{ backgroundColor: block.style?.color || "#1e293b" }}
                                        />
                                        <span className="text-[10px] text-slate-400">▾</span>
                                    </button>
                                    {activeColorPicker === block.id && (
                                        <div
                                            onMouseDown={(e) => e.preventDefault()}
                                            className="absolute left-0 top-full mt-1 bg-white p-2.5 rounded-xl shadow-xl border border-slate-200 flex flex-col gap-2 z-30 min-w-[170px]"
                                        >
                                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider px-1">Text Color</div>
                                            <div className="grid grid-cols-4 gap-1.5">
                                                {TEXT_COLORS.map((c) => (
                                                    <button
                                                        key={c.name}
                                                        type="button"
                                                        onMouseDown={(e) => e.preventDefault()}
                                                        onClick={() => applyTextColor(block.id, c.color)}
                                                        style={{ backgroundColor: c.bg }}
                                                        className="w-7 h-7 rounded-lg border border-slate-300/80 hover:scale-110 transition-transform cursor-pointer shadow-2xs flex items-center justify-center"
                                                        title={c.name}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="w-[1px] h-5 bg-slate-200 mx-0.5" />

                                {/* Alignment Controls */}
                                <div className="flex items-center bg-white rounded-lg border border-slate-200 p-0.5 shadow-2xs">
                                    <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                            applyInlineFormat("justifyLeft", "", block.id);
                                            updateBlockStyle(block.id, { textAlign: "left" });
                                        }}
                                        className="px-2 py-0.5 text-xs text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded cursor-pointer transition-colors font-bold"
                                        title="Align Left"
                                    >
                                        Left
                                    </button>
                                    <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                            applyInlineFormat("justifyCenter", "", block.id);
                                            updateBlockStyle(block.id, { textAlign: "center" });
                                        }}
                                        className="px-2 py-0.5 text-xs text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded cursor-pointer transition-colors font-bold"
                                        title="Align Center"
                                    >
                                        Center
                                    </button>
                                    <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                            applyInlineFormat("justifyRight", "", block.id);
                                            updateBlockStyle(block.id, { textAlign: "right" });
                                        }}
                                        className="px-2 py-0.5 text-xs text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded cursor-pointer transition-colors font-bold"
                                        title="Align Right"
                                    >
                                        Right
                                    </button>
                                    <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                            applyInlineFormat("justifyFull", "", block.id);
                                            updateBlockStyle(block.id, { textAlign: "justify" });
                                        }}
                                        className="px-2 py-0.5 text-xs text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded cursor-pointer transition-colors font-bold"
                                        title="Justify Text"
                                    >
                                        Justify
                                    </button>
                                </div>

                                <div className="w-[1px] h-5 bg-slate-200 mx-0.5" />

                                {/* Bullet and Number Lists */}
                                <div className="flex items-center bg-white rounded-lg border border-slate-200 p-0.5 shadow-2xs">
                                    <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => applyInlineFormat("insertUnorderedList", "", block.id)}
                                        className="px-2 py-0.5 text-xs text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 rounded cursor-pointer transition-colors font-medium"
                                        title="Bullet List"
                                    >
                                        • Bullets
                                    </button>
                                    <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => applyInlineFormat("insertOrderedList", "", block.id)}
                                        className="px-2 py-0.5 text-xs text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 rounded cursor-pointer transition-colors font-medium"
                                        title="Numbered List"
                                    >
                                        1. Numbers
                                    </button>
                                </div>

                                <div className="w-[1px] h-5 bg-slate-200 mx-0.5" />

                                {/* Hyperlink Inserter */}
                                <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                        saveSelection();
                                        const url = prompt("Enter hyperlink URL:", "https://");
                                        if (url) {
                                            restoreSelection(block.id);
                                            document.execCommand("createLink", false, url);
                                            if (editorRefs.current[block.id]) {
                                                updateBlock(block.id, editorRefs.current[block.id]?.innerHTML || "");
                                            }
                                        }
                                    }}
                                    className="px-2.5 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg cursor-pointer border border-indigo-200 shadow-2xs transition-colors flex items-center gap-1"
                                    title="Add Hyperlink"
                                >
                                    <span>🔗 Link</span>
                                </button>

                                {/* Clean Formatting Button */}
                                <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                        try {
                                            document.execCommand("removeFormat", false, undefined);
                                        } catch (_) { }
                                        updateBlock(block.id, cleanHtmlContent(block.content || ""));
                                    }}
                                    className="px-2.5 py-1 text-xs font-bold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg cursor-pointer shadow-2xs transition-colors flex items-center gap-1"
                                    title="Clean formatting and remove dark backgrounds"
                                >
                                    <span>🧹 Clean</span>
                                </button>
                            </div>
                        </div>

                        {/* ContentEditable Live Dynamic Editor with Cursor Jump Protection & Live Range Sync */}
                        <RichTextBlock
                            block={block as any}
                            onUpdateContent={(content) => updateBlock(block.id, content)}
                            onPaste={(e) => {
                                e.preventDefault();
                                const html = e.clipboardData.getData("text/html");
                                const text = e.clipboardData.getData("text/plain");
                                if (html) {
                                    const cleaned = cleanHtmlContent(html);
                                    if (cleaned) {
                                        try {
                                            document.execCommand("insertHTML", false, cleaned);
                                        } catch (_) {
                                            document.execCommand("insertText", false, text);
                                        }
                                    } else {
                                        document.execCommand("insertText", false, text);
                                    }
                                } else if (text) {
                                    document.execCommand("insertText", false, text);
                                }
                                const target = e.currentTarget;
                                setTimeout(() => {
                                    updateBlock(block.id, target.innerHTML || "");
                                }, 0);
                            }}
                            registerRef={(el) => { editorRefs.current[block.id] = el; }}
                            onSaveSelection={saveSelection}
                        />
                    </div>
                );
            }
            case "image": {
                const st = block.style || {};
                const currentAspect = st.aspectRatio || "16/9";
                const currentFit = st.objectFit || "cover";
                const currentMaxH = st.maxHeight || "380px";
                const currentPos = st.objectPosition || "center";
                const currentRad = st.borderRadius || "16px";

                return (
                    <div className="space-y-3 group/imgcard">
                        {/* Image Crop & Sizing Adjustment Toolbar */}
                        <div className="flex items-center justify-between gap-2 flex-wrap bg-slate-100 p-2 rounded-xl border border-slate-200 text-xs">
                            {/* Upload from files button */}
                            <label className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-all shrink-0">
                                <span className="material-symbols-outlined text-[15px]">upload_file</span>
                                <span>Upload Image File</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => handleImageFileUpload(block.id, e.target.files?.[0])}
                                />
                            </label>

                            {/* Aspect Ratio / Crop Box */}
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] font-black uppercase text-slate-500 mr-1 flex items-center gap-0.5">
                                    <span className="material-symbols-outlined text-[13px]">aspect_ratio</span>
                                    Ratio:
                                </span>
                                {[
                                    { label: "16:9", val: "16/9" },
                                    { label: "4:3", val: "4/3" },
                                    { label: "1:1", val: "1/1" },
                                    { label: "21:9", val: "21/9" },
                                    { label: "Auto", val: "auto" },
                                ].map((r) => (
                                    <button
                                        key={r.val}
                                        type="button"
                                        onClick={() => updateBlockStyle(block.id, { aspectRatio: r.val })}
                                        className={`px-2 py-0.5 rounded font-bold transition-colors cursor-pointer ${currentAspect === r.val ? "bg-indigo-600 text-white shadow-2xs" : "bg-white text-slate-700 hover:bg-slate-200"
                                            }`}
                                    >
                                        {r.label}
                                    </button>
                                ))}
                            </div>

                            {/* Fit Mode: Cover (Crop Fill) vs Contain (Fit) */}
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] font-black uppercase text-slate-500 mr-1 flex items-center gap-0.5">
                                    <span className="material-symbols-outlined text-[13px]">crop</span>
                                    Fit:
                                </span>
                                {[
                                    { label: "Crop Fill", val: "cover" as const, title: "Cover container & crop excess" },
                                    { label: "Fit Whole", val: "contain" as const, title: "Contain entire photo without cropping" },
                                    { label: "Stretch", val: "fill" as const, title: "Stretch to fill" },
                                ].map((f) => (
                                    <button
                                        key={f.val}
                                        type="button"
                                        title={f.title}
                                        onClick={() => updateBlockStyle(block.id, { objectFit: f.val })}
                                        className={`px-2 py-0.5 rounded font-bold transition-colors cursor-pointer ${currentFit === f.val ? "bg-indigo-600 text-white shadow-2xs" : "bg-white text-slate-700 hover:bg-slate-200"
                                            }`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>

                            {/* Height Presets */}
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] font-black uppercase text-slate-500 mr-1 flex items-center gap-0.5">
                                    <span className="material-symbols-outlined text-[13px]">height</span>
                                    Height:
                                </span>
                                {[
                                    { label: "240px", val: "240px" },
                                    { label: "380px", val: "380px" },
                                    { label: "500px", val: "500px" },
                                ].map((h) => (
                                    <button
                                        key={h.val}
                                        type="button"
                                        onClick={() => updateBlockStyle(block.id, { maxHeight: h.val })}
                                        className={`px-2 py-0.5 rounded font-bold transition-colors cursor-pointer ${currentMaxH === h.val ? "bg-indigo-600 text-white shadow-2xs" : "bg-white text-slate-700 hover:bg-slate-200"
                                            }`}
                                    >
                                        {h.label}
                                    </button>
                                ))}
                            </div>

                            {/* Focus Position Alignment */}
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] font-black uppercase text-slate-500 mr-1">Focus:</span>
                                {([ "top", "center", "bottom"] as const).map((pos) => (
                                    <button
                                        key={pos}
                                        type="button"
                                        onClick={() => updateBlockStyle(block.id, { objectPosition: pos })}
                                        className={`px-1.5 py-0.5 rounded uppercase font-bold text-[10px] transition-colors cursor-pointer ${currentPos === pos ? "bg-indigo-600 text-white shadow-2xs" : "bg-white text-slate-700 hover:bg-slate-200"
                                            }`}
                                    >
                                        {pos}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Cropped & Adjusted Image Container with Drag & Drop */}
                        <div
                            onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                            }}
                            onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const file = e.dataTransfer.files?.[0];
                                if (file) handleImageFileUpload(block.id, file);
                            }}
                            className="relative overflow-hidden border-2 border-dashed border-slate-300 hover:border-indigo-400 shadow-md bg-slate-900 group/preview transition-all"
                            style={{
                                borderRadius: currentRad,
                                maxHeight: currentMaxH,
                            }}
                        >
                            <img
                                src={block.content}
                                alt={block.fileName || "Blog illustration"}
                                className="w-full transition-all"
                                style={{
                                    aspectRatio: currentAspect,
                                    objectFit: currentFit,
                                    objectPosition: currentPos,
                                    maxHeight: currentMaxH,
                                }}
                            />

                            {/* Uploaded File Badge */}
                            {block.fileName && (
                                <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/75 backdrop-blur-md rounded-lg text-white text-[11px] font-mono flex items-center gap-1.5 border border-white/20">
                                    <span className="material-symbols-outlined text-[13px] text-emerald-400">check_circle</span>
                                    <span className="font-bold truncate max-w-[160px]">{block.fileName}</span>
                                    {block.fileSize && <span className="text-slate-300 text-[10px]">({block.fileSize})</span>}
                                </div>
                            )}

                            {/* Quick URL change & Upload trigger on hover */}
                            <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center gap-2 flex-wrap">
                                <label className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1 shrink-0 transition-colors">
                                    <span className="material-symbols-outlined text-[14px]">upload</span>
                                    <span>Upload from File</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => handleImageFileUpload(block.id, e.target.files?.[0])}
                                    />
                                </label>
                                <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider shrink-0">OR URL:</span>
                                <input
                                    type="text"
                                    value={block.content.startsWith("data:image") ? "(Uploaded Image File)" : block.content}
                                    onChange={(e) => updateBlock(block.id, e.target.value)}
                                    className="flex-1 min-w-[200px] px-3 py-1 bg-white/20 backdrop-blur rounded-lg text-white text-xs border border-white/30 outline-none placeholder-white/60 font-mono"
                                    placeholder="Paste image URL (https://...)"
                                />
                            </div>
                        </div>

                        {/* Image Caption */}
                        <div className="flex items-center gap-2 px-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[13px]">subtitles</span> Caption:
                            </span>
                            <input
                                type="text"
                                value={block.caption || ""}
                                onChange={(e) => updateBlockProperties(block.id, { caption: e.target.value })}
                                placeholder="Add image caption or credit attribution..."
                                className="flex-1 px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 placeholder-slate-400 focus:bg-white focus:ring-1 focus:ring-indigo-300 outline-none"
                            />
                        </div>
                    </div>
                );
            }
            case "video": {
                const isDirect = isDirectVideoSource(block.content);
                const formattedEmbed = formatVideoEmbedUrl(block.content || "");

                return (
                    <div className="space-y-3 group/videocard">
                        {/* Video Element Toolbar */}
                        <div className="flex items-center justify-between gap-2 flex-wrap bg-slate-100 p-2 rounded-xl border border-slate-200 text-xs">
                            <div className="flex items-center gap-2">
                                <label className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-all shrink-0">
                                    <span className="material-symbols-outlined text-[15px]">video_file</span>
                                    <span>Upload Video File</span>
                                    <input
                                        type="file"
                                        accept="video/mp4,video/webm,video/ogg,video/quicktime,video/*"
                                        className="hidden"
                                        onChange={(e) => handleVideoFileUpload(block.id, e.target.files?.[0])}
                                    />
                                </label>

                                <span className={`px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1 ${
                                    isDirect ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-blue-100 text-blue-800 border border-blue-300"
                                }`}>
                                    <span className="material-symbols-outlined text-[13px]">{isDirect ? "play_circle" : "smart_display"}</span>
                                    {isDirect ? "Direct Video File (HTML5)" : "Embed Video (YouTube / Vimeo)"}
                                </span>
                            </div>

                            {/* Quick URL Presets */}
                            <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                <span className="text-[10px] font-black uppercase text-slate-400 mr-1">Formats:</span>
                                <span className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono text-[10px]">.MP4</span>
                                <span className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono text-[10px]">.WebM</span>
                                <span className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono text-[10px]">YouTube</span>
                                <span className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono text-[10px]">Vimeo</span>
                            </div>
                        </div>

                        {/* Video Player Display Container with Drag & Drop */}
                        <div
                            onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                            }}
                            onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const file = e.dataTransfer.files?.[0];
                                if (file) handleVideoFileUpload(block.id, file);
                            }}
                            className="relative aspect-video rounded-2xl overflow-hidden bg-slate-950 border-2 border-dashed border-slate-300 hover:border-rose-400 shadow-md group/vpreview transition-all"
                        >
                            {isDirect ? (
                                <video
                                    controls
                                    playsInline
                                    className="w-full h-full object-contain bg-black"
                                    src={block.content}
                                    key={block.content}
                                >
                                    Your browser does not support the video tag.
                                </video>
                            ) : (
                                <iframe
                                    src={formattedEmbed}
                                    className="w-full h-full"
                                    allowFullScreen
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                />
                            )}

                            {/* Uploaded File Badge */}
                            {block.fileName && (
                                <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/80 backdrop-blur-md rounded-lg text-white text-[11px] font-mono flex items-center gap-1.5 border border-white/20">
                                    <span className="material-symbols-outlined text-[13px] text-emerald-400">check_circle</span>
                                    <span className="font-bold truncate max-w-[180px]">{block.fileName}</span>
                                    {block.fileSize && <span className="text-slate-300 text-[10px]">({block.fileSize})</span>}
                                </div>
                            )}

                            {/* Quick URL change & Upload trigger on hover */}
                            <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent opacity-0 group-hover/vpreview:opacity-100 transition-opacity flex items-center gap-2 flex-wrap">
                                <label className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1 shrink-0 transition-colors">
                                    <span className="material-symbols-outlined text-[14px]">upload</span>
                                    <span>Upload Video File</span>
                                    <input
                                        type="file"
                                        accept="video/mp4,video/webm,video/ogg,video/quicktime,video/*"
                                        className="hidden"
                                        onChange={(e) => handleVideoFileUpload(block.id, e.target.files?.[0])}
                                    />
                                </label>
                                <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider shrink-0">OR URL:</span>
                                <input
                                    type="text"
                                    value={block.content.startsWith("data:video") ? "(Uploaded Video File)" : block.content}
                                    onChange={(e) => updateBlock(block.id, e.target.value)}
                                    className="flex-1 min-w-[200px] px-3 py-1 bg-white/20 backdrop-blur rounded-lg text-white text-xs border border-white/30 outline-none placeholder-white/60 font-mono"
                                    placeholder="Paste YouTube, Vimeo or MP4 URL..."
                                />
                            </div>
                        </div>

                        {/* Video Caption */}
                        <div className="flex items-center gap-2 px-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[13px]">subtitles</span> Caption:
                            </span>
                            <input
                                type="text"
                                value={block.caption || ""}
                                onChange={(e) => updateBlockProperties(block.id, { caption: e.target.value })}
                                placeholder="Add video caption or description (e.g. Video guide to student visa funding)..."
                                className="flex-1 px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 placeholder-slate-400 focus:bg-white focus:ring-1 focus:ring-indigo-300 outline-none"
                            />
                        </div>
                    </div>
                );
            }
            case "button": {
                const text = block.buttonText || block.content || "Explore Loan Options";
                const url = block.buttonUrl || "/apply-loan";
                const isNewTab = block.buttonNewTab !== false;
                const align = block.buttonAlign || "center";
                const variant = block.buttonVariant || "gradient";
                const size = block.buttonSize || "md";

                const variantClasses: Record<string, string> = {
                    gradient: "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-indigo-600/30 hover:from-purple-700 hover:to-indigo-700",
                    emerald: "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30 hover:from-emerald-700 hover:to-teal-700",
                    dark: "bg-slate-900 text-white shadow-md hover:bg-slate-800",
                    outline: "bg-transparent text-indigo-600 border-2 border-indigo-600 hover:bg-indigo-50",
                    amber: "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/30 hover:from-amber-600 hover:to-orange-600",
                    rose: "bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-md shadow-rose-600/30 hover:from-rose-700 hover:to-pink-700",
                };

                const sizeClasses: Record<string, string> = {
                    sm: "px-4 py-2 text-xs font-bold rounded-lg",
                    md: "px-6 py-2.5 text-xs font-bold rounded-xl",
                    lg: "px-8 py-3.5 text-sm font-extrabold rounded-2xl",
                };

                const alignClasses: Record<string, string> = {
                    left: "justify-start text-left",
                    center: "justify-center text-center",
                    right: "justify-end text-right",
                    full: "w-full justify-center",
                };

                return (
                    <div className="space-y-2.5 group/button my-2 p-3 bg-slate-50/90 rounded-2xl border border-slate-200">
                        {/* Interactive Toolbar for Button */}
                        <div className="flex items-center justify-between gap-2 flex-wrap pb-1.5 border-b border-slate-200 text-xs">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold text-[11px] border border-indigo-200 shadow-2xs">
                                    <span className="material-symbols-outlined text-[13px]">smart_button</span>
                                    Dynamic Button
                                </span>

                                {/* Alignment */}
                                <div className="inline-flex items-center bg-white p-0.5 rounded-lg border border-slate-200 shadow-2xs">
                                    {(["left", "center", "right", "full"] as const).map((al) => (
                                        <button
                                            key={al}
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                updateBlockButton(block.id, { buttonAlign: al });
                                            }}
                                            title={`Align ${al}`}
                                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer capitalize transition-all ${
                                                align === al
                                                    ? "bg-indigo-600 text-white shadow-xs"
                                                    : "text-slate-500 hover:text-slate-900"
                                            }`}
                                        >
                                            {al === "full" ? "Full" : al}
                                        </button>
                                    ))}
                                </div>

                                {/* Style Colors */}
                                <div className="inline-flex items-center gap-1 bg-white p-0.5 px-1.5 rounded-lg border border-slate-200 shadow-2xs">
                                    <span className="text-[10px] text-slate-400 font-semibold">Style:</span>
                                    {(["gradient", "emerald", "dark", "outline", "amber", "rose"] as const).map((v) => (
                                        <button
                                            key={v}
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                updateBlockButton(block.id, { buttonVariant: v });
                                            }}
                                            title={`Style: ${v}`}
                                            className={`w-3.5 h-3.5 rounded-full border cursor-pointer transition-transform ${
                                                v === "gradient" ? "bg-gradient-to-r from-purple-600 to-indigo-600" :
                                                v === "emerald" ? "bg-emerald-600" :
                                                v === "dark" ? "bg-slate-900" :
                                                v === "outline" ? "bg-white border-indigo-600" :
                                                v === "amber" ? "bg-amber-500" :
                                                "bg-rose-600"
                                            } ${variant === v ? "scale-125 ring-2 ring-indigo-400 border-white" : "border-slate-300"}`}
                                        />
                                    ))}
                                </div>

                                {/* Size */}
                                <div className="inline-flex items-center bg-white p-0.5 rounded-lg border border-slate-200 shadow-2xs">
                                    {(["sm", "md", "lg"] as const).map((sz) => (
                                        <button
                                            key={sz}
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                updateBlockButton(block.id, { buttonSize: sz });
                                            }}
                                            title={`Size: ${sz}`}
                                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer uppercase transition-all ${
                                                size === sz
                                                    ? "bg-indigo-600 text-white shadow-xs"
                                                    : "text-slate-500 hover:text-slate-900"
                                            }`}
                                        >
                                            {sz}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <label className="flex items-center gap-1 text-[11px] text-slate-600 font-medium cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isNewTab}
                                    onChange={(e) => updateBlockButton(block.id, { buttonNewTab: e.target.checked })}
                                    className="rounded text-indigo-600 focus:ring-indigo-400"
                                />
                                New Tab
                            </label>
                        </div>

                        {/* Quick In-Canvas Inputs: Label & URL */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">Button Label</label>
                                <input
                                    type="text"
                                    value={text}
                                    onChange={(e) => updateBlockButton(block.id, { content: e.target.value, buttonText: e.target.value })}
                                    placeholder="Enter label..."
                                    className="w-full font-bold px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">Target Link (URL)</label>
                                <input
                                    type="text"
                                    value={url}
                                    onChange={(e) => updateBlockButton(block.id, { buttonUrl: e.target.value })}
                                    placeholder="e.g. /apply-loan or https://..."
                                    className="w-full font-mono text-[11px] px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-indigo-500"
                                />
                            </div>
                        </div>

                        {/* Rendered Live Preview Button */}
                        <div className={`flex ${alignClasses[align]} pt-1`}>
                            <a
                                href={url}
                                target={isNewTab ? "_blank" : "_self"}
                                rel={isNewTab ? "noopener noreferrer" : undefined}
                                onClick={(e) => e.preventDefault()}
                                className={`inline-flex items-center justify-center gap-2 transition-all transform active:scale-95 cursor-pointer ${variantClasses[variant] || variantClasses.gradient} ${sizeClasses[size] || sizeClasses.md} ${align === "full" ? "w-full" : ""}`}
                            >
                                <span>{text || "Click Here"}</span>
                                <span className="material-symbols-outlined text-sm font-bold">arrow_forward</span>
                            </a>
                        </div>
                    </div>
                );
            }
            case "list": {
                const isOrdered = block.listType === "ordered";
                return (
                    <div className="space-y-2 group/list">
                        {/* List Type Switcher Toolbar */}
                        <div className="flex items-center justify-between gap-2 flex-wrap pb-1.5 border-b border-slate-200 text-xs">
                            <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 font-bold text-[11px] border border-teal-200 shadow-2xs">
                                    <span className="material-symbols-outlined text-[13px]">{isOrdered ? "format_list_numbered" : "format_list_bulleted"}</span>
                                    {isOrdered ? "Ordered List (Numbered)" : "Unordered List (Bullets)"}
                                </span>
                                <span className="text-[10px] text-slate-400 font-semibold hidden sm:inline">| Switch Type:</span>
                                <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            updateBlockListType(block.id, "unordered");
                                        }}
                                        className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-all flex items-center gap-1 ${
                                            !isOrdered
                                                ? "bg-teal-600 text-white shadow-xs"
                                                : "text-slate-600 hover:text-slate-900 hover:bg-white"
                                        }`}
                                    >
                                        <span className="material-symbols-outlined text-[12px]">format_list_bulleted</span>
                                        Bullets (&bull;)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            updateBlockListType(block.id, "ordered");
                                        }}
                                        className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-all flex items-center gap-1 ${
                                            isOrdered
                                                ? "bg-teal-600 text-white shadow-xs"
                                                : "text-slate-600 hover:text-slate-900 hover:bg-white"
                                        }`}
                                    >
                                        <span className="material-symbols-outlined text-[12px]">format_list_numbered</span>
                                        Numbered (1, 2, 3)
                                    </button>
                                </div>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400">&lt;{isOrdered ? "ol" : "ul"}&gt;</span>
                        </div>

                        {/* List Items Textarea */}
                        <div className="relative">
                            <textarea
                                value={block.content}
                                onChange={(e) => updateBlock(block.id, e.target.value)}
                                className="w-full text-slate-800 text-sm leading-relaxed outline-none resize-y min-h-[90px] p-3 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 font-sans transition-all bg-white"
                                placeholder={isOrdered ? "1. Item 1\n2. Item 2\n3. Item 3" : "• Item 1\n• Item 2\n• Item 3"}
                            />
                        </div>
                    </div>
                );
            }
            case "quote":
                return (
                    <blockquote className="border-l-4 border-purple-500 pl-6 py-2 bg-purple-50/50 rounded-r-xl">
                        <p
                            contentEditable
                            suppressContentEditableWarning
                            onPaste={(e) => {
                                e.preventDefault();
                                const text = e.clipboardData.getData("text/plain");
                                document.execCommand("insertText", false, text);
                                updateBlock(block.id, e.currentTarget.textContent || "");
                            }}
                            onBlur={(e) => updateBlock(block.id, e.currentTarget.textContent || "")}
                            className="text-xl text-gray-600 outline-none"
                        >
                            "{block.content}"
                        </p>
                    </blockquote>
                );
            case "code":
                return (
                    <pre className="bg-gray-900 text-green-400 p-4 rounded-xl overflow-x-auto">
                        <code
                            contentEditable
                            suppressContentEditableWarning
                            onPaste={(e) => {
                                e.preventDefault();
                                const text = e.clipboardData.getData("text/plain");
                                document.execCommand("insertText", false, text);
                                updateBlock(block.id, e.currentTarget.textContent || "");
                            }}
                            onBlur={(e) => updateBlock(block.id, e.currentTarget.textContent || "")}
                            className="outline-none block"
                        >
                            {block.content}
                        </code>
                    </pre>
                );
            case "divider":
                return <hr className="border-gray-300 my-4" />;
            case "spacer":
                return <div className="h-12 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-sm">Spacer</div>;
            case "container":
            case "split_content": {
                const config = block.splitConfig || {
                    layoutType: "image_text",
                    ratio: "50_50",
                    leftTitle: "Study Abroad Education Loans",
                    leftContent: "Calculate your eligibility and compare offers from 15+ premier lending partners with collateral-free funding up to ₹75 Lakhs.",
                    leftImageUrl: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=800",
                    leftItems: ["100% Comprehensive funding", "Verified bank partners"],
                    rightTitle: "Collateral-Free Education Loans",
                    rightContent: "Secure up to ₹75 Lakhs without submitting physical property collateral. Fast approval in 48 hours with low rates.",
                    rightItems: ["Up to ₹75 Lakhs collateral-free limit", "Interest rate from 8.5% p.a."],
                    buttonText: "Explore Loan Options",
                    buttonUrl: "/apply-loan",
                    formTitle: "Instant Loan Inquiry & Registration",
                    formSubtitle: "Enter your contact details to check eligibility & receive a callback within 15 minutes.",
                    formButtonText: "Register & Check Eligibility",
                };
                const layout = config.layoutType || "image_text";
                const ratio = config.ratio || "50_50";

                let leftColSpan = "w-full md:w-1/2";
                let rightColSpan = "w-full md:w-1/2";
                if (ratio === "40_60") { leftColSpan = "w-full md:w-5/12"; rightColSpan = "w-full md:w-7/12"; }
                else if (ratio === "60_40") { leftColSpan = "w-full md:w-7/12"; rightColSpan = "w-full md:w-5/12"; }
                else if (ratio === "33_67") { leftColSpan = "w-full md:w-4/12"; rightColSpan = "w-full md:w-8/12"; }

                const renderEditableForm = () => {
                    const splitFormFields = config.formFields && config.formFields.length > 0 ? config.formFields : DEFAULT_FORM_FIELDS;
                    return (
                        <div className="bg-white p-5 rounded-2xl border-2 border-indigo-200 shadow-md space-y-3.5">
                            <div className="flex items-center justify-between border-b border-indigo-50 pb-2 flex-wrap gap-2">
                                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-wider rounded">
                                    📋 Registration Form Card (Split Layout)
                                </span>
                                <div className="flex items-center gap-2">
                                    <Link
                                        href="/registration"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 underline"
                                        title="Preview separate standalone registration page"
                                    >
                                        <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                                        Separate Page
                                    </Link>
                                    <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        Lead Capture ({splitFormFields.length} cols)
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-slate-500">Form Title</label>
                                    <input
                                        type="text"
                                        value={config.formTitle || "Instant Loan Inquiry & Registration"}
                                        onChange={(e) => updateSplitConfig(block.id, { formTitle: e.target.value })}
                                        className="w-full font-extrabold text-sm text-slate-900 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:border-indigo-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-slate-500">Form Subtitle</label>
                                    <input
                                        type="text"
                                        value={config.formSubtitle || "Enter contact details to check eligibility & receive callback within 15 minutes."}
                                        onChange={(e) => updateSplitConfig(block.id, { formSubtitle: e.target.value })}
                                        className="w-full text-xs text-slate-600 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:border-indigo-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* Simulated Live Form Fields arranged in columns */}
                            <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                                    <span>Form Preview (Reader View)</span>
                                    <span>{splitFormFields.length} Fields Configured</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {splitFormFields.map((f) => (
                                        <div
                                            key={f.id}
                                            className={f.colSpan === "full" ? "col-span-1 md:col-span-2" : "col-span-1"}
                                        >
                                            <label className="text-[10px] font-bold uppercase text-slate-600 flex items-center gap-1 mb-0.5">
                                                <span>{f.label}</span>
                                                {f.required && <span className="text-rose-500">*</span>}
                                            </label>
                                            {f.type === "select" ? (
                                                <select
                                                    disabled
                                                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-400 cursor-not-allowed"
                                                >
                                                    {(f.options && f.options.length > 0 ? f.options : ["Select Option"]).map((opt, i) => (
                                                        <option key={i}>{opt}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input
                                                    type={f.type}
                                                    disabled
                                                    placeholder={f.placeholder || `Enter ${f.label}`}
                                                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-400 cursor-not-allowed"
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold uppercase text-slate-500">CTA Button Label</label>
                                <input
                                    type="text"
                                    value={config.formButtonText || "Register & Check Eligibility"}
                                    onChange={(e) => updateSplitConfig(block.id, { formButtonText: e.target.value })}
                                    className="w-full text-xs font-bold text-indigo-700 bg-indigo-50/50 border border-indigo-200 rounded-lg px-2.5 py-1.5 focus:border-indigo-500 focus:outline-none"
                                />
                            </div>

                            <div className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5">
                                <span>{config.formButtonText || "Register & Check Eligibility"}</span>
                                <span>&rarr;</span>
                            </div>

                            {/* Column Configuration Manager */}
                            {renderFormFieldsManager(block.id, splitFormFields, true)}
                        </div>
                    );
                };

                const renderEditableContent = (side: "left" | "right") => {
                    const isLeft = side === "left";
                    const titleVal = isLeft ? config.leftTitle : config.rightTitle;
                    const contentVal = isLeft ? config.leftContent : config.rightContent;
                    const itemsVal = isLeft ? (config.leftItems || []) : (config.rightItems || []);

                    return (
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 block">
                                {isLeft ? "Left Column Content" : "Right Column Content"}
                            </span>
                            <input
                                type="text"
                                value={titleVal || ""}
                                onChange={(e) => updateSplitConfig(block.id, isLeft ? { leftTitle: e.target.value } : { rightTitle: e.target.value })}
                                placeholder="Section Headline..."
                                className="w-full font-bold text-base text-slate-900 border-b border-slate-200 pb-1 focus:outline-none focus:border-indigo-500"
                            />
                            <textarea
                                value={contentVal || ""}
                                onChange={(e) => updateSplitConfig(block.id, isLeft ? { leftContent: e.target.value } : { rightContent: e.target.value })}
                                placeholder="Describe key benefits, loan details or context..."
                                rows={3}
                                className="w-full text-xs text-slate-700 leading-relaxed border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-indigo-500"
                            />

                            {/* Checklist items */}
                            <div className="space-y-1.5 pt-1">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-bold uppercase text-slate-500">Key Highlights / Bullets</label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const next = [...itemsVal, "New benefit highlight"];
                                            updateSplitConfig(block.id, isLeft ? { leftItems: next } : { rightItems: next });
                                        }}
                                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                                    >
                                        + Add Bullet
                                    </button>
                                </div>
                                {itemsVal.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-1.5">
                                        <span className="text-emerald-500 font-black text-xs">✓</span>
                                        <input
                                            type="text"
                                            value={item}
                                            onChange={(e) => {
                                                const next = [...itemsVal];
                                                next[idx] = e.target.value;
                                                updateSplitConfig(block.id, isLeft ? { leftItems: next } : { rightItems: next });
                                            }}
                                            className="flex-1 text-xs border border-slate-200 rounded px-2 py-1 text-slate-700 focus:outline-none focus:border-indigo-500"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const next = itemsVal.filter((_, i) => i !== idx);
                                                updateSplitConfig(block.id, isLeft ? { leftItems: next } : { rightItems: next });
                                            }}
                                            className="text-slate-400 hover:text-rose-500 text-xs px-1"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Optional Button */}
                            <div className="space-y-2 pt-2 border-t border-slate-100">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={config.buttonText || ""}
                                        onChange={(e) => updateSplitConfig(block.id, { buttonText: e.target.value })}
                                        placeholder="Button label (optional)..."
                                        className="w-1/2 px-2.5 py-1 text-xs border border-slate-200 rounded-lg text-slate-800"
                                    />
                                    <input
                                        type="text"
                                        value={config.buttonUrl || ""}
                                        onChange={(e) => updateSplitConfig(block.id, { buttonUrl: e.target.value })}
                                        placeholder="Button URL (/apply-loan)..."
                                        className="w-1/2 px-2.5 py-1 text-xs border border-slate-200 rounded-lg text-slate-800 font-mono"
                                    />
                                </div>
                                {config.buttonText && (
                                    <div className="pt-1">
                                        <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl text-xs shadow-md">
                                            <span>{config.buttonText}</span>
                                            <span>&rarr;</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                };

                const renderEditableImage = (side: "left" | "right") => {
                    const isLeft = side === "left";
                    const urlVal = isLeft ? config.leftImageUrl : config.rightImageUrl;
                    const capVal = isLeft ? config.leftImageCaption : config.rightImageCaption;

                    return (
                        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                            <div className="relative rounded-lg overflow-hidden border border-slate-200 group bg-slate-900 h-48">
                                <img
                                    src={urlVal || "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=800"}
                                    alt="Side visual"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-slate-500">Image URL</label>
                                <input
                                    type="text"
                                    value={urlVal || ""}
                                    onChange={(e) => updateSplitConfig(block.id, isLeft ? { leftImageUrl: e.target.value } : { rightImageUrl: e.target.value })}
                                    placeholder="https://images.unsplash.com/..."
                                    className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-lg text-slate-800 font-mono"
                                />
                            </div>
                            <input
                                type="text"
                                value={capVal || ""}
                                onChange={(e) => updateSplitConfig(block.id, isLeft ? { leftImageCaption: e.target.value } : { rightImageCaption: e.target.value })}
                                placeholder="Caption under image (optional)..."
                                className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-lg text-slate-600 italic"
                            />
                        </div>
                    );
                };

                return (
                    <div className="p-5 bg-gradient-to-br from-slate-50 to-indigo-50/30 rounded-2xl border-2 border-indigo-200/80 shadow-xs space-y-4">
                        {/* Control Bar: Mode, Ratio, Swap */}
                        <div className="flex items-center justify-between gap-2 flex-wrap border-b border-indigo-100 pb-3">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-2.5 py-1 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider rounded-md flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[13px]">view_column</span>
                                    2-Column Split
                                </span>
                                <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-200 text-xs font-bold flex-wrap gap-0.5">
                                    <button
                                        type="button"
                                        onClick={() => updateSplitConfig(block.id, { layoutType: "content_form" })}
                                        className={`px-2 py-1 rounded transition-colors ${layout === "content_form" ? "bg-indigo-600 text-white font-black" : "text-slate-600 hover:text-slate-900"}`}
                                        title="One side content matter, one side student registration card"
                                    >
                                        📝 Content + 📋 Register Form
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => updateSplitConfig(block.id, { layoutType: "form_content" })}
                                        className={`px-2 py-1 rounded transition-colors ${layout === "form_content" ? "bg-indigo-600 text-white font-black" : "text-slate-600 hover:text-slate-900"}`}
                                        title="One side student registration card, one side content matter"
                                    >
                                        📋 Register Form + 📝 Content
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => updateSplitConfig(block.id, { layoutType: "image_text" })}
                                        className={`px-2 py-1 rounded transition-colors ${layout === "image_text" ? "bg-indigo-600 text-white font-black" : "text-slate-600 hover:text-slate-900"}`}
                                    >
                                        🖼️ Image + 📝 Content
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => updateSplitConfig(block.id, { layoutType: "text_image" })}
                                        className={`px-2 py-1 rounded transition-colors ${layout === "text_image" ? "bg-indigo-600 text-white font-black" : "text-slate-600 hover:text-slate-900"}`}
                                    >
                                        📝 Content + 🖼️ Image
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => updateSplitConfig(block.id, { layoutType: "text_text" })}
                                        className={`px-2 py-1 rounded transition-colors ${layout === "text_text" ? "bg-indigo-600 text-white font-black" : "text-slate-600 hover:text-slate-900"}`}
                                    >
                                        📝 2-Col Text
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {/* Ratio Selector */}
                                <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-200 text-[10px] font-bold">
                                    {(["50_50", "40_60", "60_40", "33_67"] as const).map((r) => (
                                        <button
                                            key={r}
                                            type="button"
                                            onClick={() => updateSplitConfig(block.id, { ratio: r })}
                                            className={`px-1.5 py-0.5 rounded ${ratio === r ? "bg-indigo-100 text-indigo-700 font-black" : "text-slate-500"}`}
                                        >
                                            {r.replace("_", ":")}
                                        </button>
                                    ))}
                                </div>

                                {/* Swap Button */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (layout === "image_text") {
                                            updateSplitConfig(block.id, { layoutType: "text_image" });
                                        } else if (layout === "text_image") {
                                            updateSplitConfig(block.id, { layoutType: "image_text" });
                                        } else if (layout === "content_form") {
                                            updateSplitConfig(block.id, { layoutType: "form_content" });
                                        } else if (layout === "form_content") {
                                            updateSplitConfig(block.id, { layoutType: "content_form" });
                                        } else {
                                            // swap contents
                                            updateSplitConfig(block.id, {
                                                leftTitle: config.rightTitle,
                                                leftContent: config.rightContent,
                                                rightTitle: config.leftTitle,
                                                rightContent: config.leftContent,
                                            });
                                        }
                                    }}
                                    className="px-2.5 py-1 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                                    title="Swap Left and Right Columns"
                                >
                                    <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
                                    Swap Sides
                                </button>
                            </div>
                        </div>

                        {/* Interactive Columns Preview */}
                        <div className="flex flex-col md:flex-row gap-6 items-center">
                            {/* LEFT COLUMN */}
                            <div className={`${leftColSpan} space-y-3`}>
                                {layout === "image_text" && renderEditableImage("left")}
                                {layout === "form_content" && renderEditableForm()}
                                {(layout === "text_image" || layout === "content_form" || layout === "text_text") && renderEditableContent("left")}
                            </div>

                            {/* RIGHT COLUMN */}
                            <div className={`${rightColSpan} space-y-3`}>
                                {layout === "text_image" && renderEditableImage("right")}
                                {layout === "content_form" && renderEditableForm()}
                                {(layout === "image_text" || layout === "form_content" || layout === "text_text") && renderEditableContent("right")}
                            </div>
                        </div>
                    </div>
                );
            }
            case "registration_form": {
                const fConfig = block.formConfig || {
                    formTitle: "Instant Loan Inquiry & Registration",
                    formSubtitle: "Fill details for instant loan eligibility assessment & expert callback.",
                    formButtonText: "Register & Check Eligibility",
                    targetUrl: "/registration",
                    badgeText: "Instant Assessment",
                    footerNote: "🔒 100% Free Service • No CIBIL Impact • Doorstep Support",
                    fields: DEFAULT_FORM_FIELDS,
                };
                const fields = fConfig.fields && fConfig.fields.length > 0 ? fConfig.fields : DEFAULT_FORM_FIELDS;

                return (
                    <div className="w-full max-w-2xl mx-auto bg-white rounded-2xl border-2 border-emerald-400 shadow-md overflow-hidden transition-all">
                        {/* Header Banner */}
                        <div className="p-5 sm:p-6 bg-gradient-to-br from-emerald-600 via-teal-600 to-indigo-700 text-white relative">
                            <div className="flex items-center justify-between mb-2">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-xs text-white text-[11px] font-black uppercase tracking-wider rounded-full border border-white/20">
                                    <span className="material-symbols-outlined text-[13px]">how_to_reg</span>
                                    <input
                                        type="text"
                                        value={fConfig.badgeText || "Instant Assessment"}
                                        onChange={(e) => updateFormConfig(block.id, { badgeText: e.target.value })}
                                        className="bg-transparent text-white font-black text-[11px] focus:outline-none w-32 border-b border-transparent hover:border-white/40"
                                        placeholder="Badge label"
                                    />
                                </span>
                                <span className="text-[11px] text-emerald-100 font-bold flex items-center gap-1.5 bg-black/20 px-2.5 py-0.5 rounded-full">
                                    <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                                    Standalone Form ({fields.length} columns)
                                </span>
                            </div>

                            <div className="space-y-1.5">
                                <input
                                    type="text"
                                    value={fConfig.formTitle || "Instant Loan Inquiry & Registration"}
                                    onChange={(e) => updateFormConfig(block.id, { formTitle: e.target.value })}
                                    placeholder="Registration Form Title..."
                                    className="w-full font-black text-xl sm:text-2xl text-white bg-transparent border-b border-white/20 pb-1 focus:border-white focus:outline-none placeholder:text-white/60"
                                />
                                <input
                                    type="text"
                                    value={fConfig.formSubtitle || "Enter your contact details to check eligibility & receive a callback within 15 minutes."}
                                    onChange={(e) => updateFormConfig(block.id, { formSubtitle: e.target.value })}
                                    placeholder="Subtitle or guidance note..."
                                    className="w-full text-xs sm:text-sm text-emerald-50 bg-transparent border-b border-white/10 pb-1 focus:border-white focus:outline-none placeholder:text-white/50"
                                />
                            </div>
                        </div>

                        {/* Live Form Preview & Test Mode */}
                        <div className="p-5 sm:p-6 space-y-4">
                            {/* DB Lead Mode Status Callout */}
                            <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
                                <div className="flex items-center gap-2.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                                    <div>
                                        <p className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                                            <span>Direct In-Page Database Capture</span>
                                            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase rounded">No Redirect</span>
                                        </p>
                                        <p className="text-[11px] text-emerald-700">Submissions are saved directly to UniversityInquiry & CRM. Readers stay on this blog page.</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <Link
                                        href="/registration"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                                        title="Open separate full-page registration form in a new tab"
                                    >
                                        <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                                        View Page
                                    </Link>
                                    <span className="text-[11px] font-bold text-slate-500 bg-white px-2 py-1 rounded-lg border border-slate-200">
                                        {fields.length} Cols
                                    </span>
                                </div>
                            </div>

                            {/* Success Card when Test Submit is triggered */}
                            {testFormSuccess[block.id] ? (
                                <div className="text-center py-7 px-6 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border-2 border-emerald-300 shadow-sm animate-fade-in space-y-3">
                                    <div className="w-12 h-12 bg-gradient-to-tr from-emerald-500 to-teal-500 text-white rounded-full flex items-center justify-center mx-auto shadow-md text-xl font-black">
                                        ✓
                                    </div>
                                    <span className="inline-block px-3 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider rounded-full">
                                        Direct DB Write Verified
                                    </span>
                                    <h4 className="text-lg font-extrabold text-slate-900">
                                        Inquiry Stored in Database!
                                    </h4>
                                    <p className="text-slate-600 text-xs leading-relaxed max-w-md mx-auto">
                                        Test submission for <strong className="text-slate-900">{testFormSuccess[block.id]?.name}</strong> ({testFormSuccess[block.id]?.phone}) was saved directly to the database without redirecting to another page.
                                    </p>
                                    <div className="pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setTestFormSuccess((prev) => ({ ...prev, [block.id]: null }))}
                                            className="px-4 py-2 text-xs font-bold text-emerald-800 bg-white border border-emerald-300 hover:bg-emerald-100 rounded-xl transition-all cursor-pointer shadow-2xs"
                                        >
                                            ← Reset & Test Again
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Error Banner */}
                                    {testFormError[block.id] && (
                                        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center justify-between">
                                            <span>{testFormError[block.id]}</span>
                                            <button
                                                type="button"
                                                onClick={() => setTestFormError((prev) => ({ ...prev, [block.id]: null }))}
                                                className="text-rose-400 hover:text-rose-700 font-bold ml-2"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    )}

                                    {/* Live Columns Form Inputs */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                        {fields.map((f) => {
                                            const fieldKey = f.name || f.id;
                                            const val = testFormValues[block.id]?.[fieldKey] || "";
                                            return (
                                                <div
                                                    key={f.id}
                                                    className={f.colSpan === "full" ? "col-span-1 md:col-span-2" : "col-span-1"}
                                                >
                                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1 mb-1">
                                                        <span>{f.label}</span>
                                                        {f.required && <span className="text-rose-500">*</span>}
                                                    </label>
                                                    {f.type === "select" ? (
                                                        <select
                                                            value={val || (f.options?.[0] || "")}
                                                            onChange={(e) =>
                                                                setTestFormValues((prev) => ({
                                                                    ...prev,
                                                                    [block.id]: {
                                                                        ...(prev[block.id] || {}),
                                                                        [fieldKey]: e.target.value,
                                                                    },
                                                                }))
                                                            }
                                                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer"
                                                        >
                                                            {(f.options && f.options.length > 0 ? f.options : ["Select Option"]).map((opt, i) => (
                                                                <option key={i} value={opt}>
                                                                    {opt}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <input
                                                            type={f.type}
                                                            value={val}
                                                            onChange={(e) =>
                                                                setTestFormValues((prev) => ({
                                                                    ...prev,
                                                                    [block.id]: {
                                                                        ...(prev[block.id] || {}),
                                                                        [fieldKey]: e.target.value,
                                                                    },
                                                                }))
                                                            }
                                                            placeholder={f.placeholder || `Enter ${f.label}`}
                                                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all"
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* CTA Button Settings & Test Submission Button */}
                                    <div className="space-y-3 pt-2 border-t border-slate-100">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] font-bold uppercase text-slate-500">CTA Button Text</label>
                                                <input
                                                    type="text"
                                                    value={fConfig.formButtonText || "Register & Check Eligibility"}
                                                    onChange={(e) => updateFormConfig(block.id, { formButtonText: e.target.value })}
                                                    className="w-full text-xs font-bold text-emerald-800 bg-emerald-50/60 border border-emerald-200 rounded-lg px-2.5 py-1.5 focus:border-emerald-500 focus:outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold uppercase text-slate-500">Submission Mode</label>
                                                <div className="w-full text-xs font-bold text-emerald-800 bg-emerald-50/60 border border-emerald-200 rounded-lg px-2.5 py-1.5 flex items-center justify-between">
                                                    <span>Direct DB Record (No Redirect)</span>
                                                    <span className="material-symbols-outlined text-[15px] text-emerald-600">check_circle</span>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            disabled={testFormSubmitting[block.id]}
                                            onClick={() => handleTestLeadSubmit(block.id, fields, fConfig)}
                                            className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 hover:from-emerald-700 hover:to-indigo-800 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md hover:shadow-lg active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
                                        >
                                            {testFormSubmitting[block.id] ? (
                                                <>
                                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                    <span>Submitting Lead to Database...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span>{fConfig.formButtonText || "Register & Check Eligibility"}</span>
                                                    <span>&rarr;</span>
                                                    <span className="text-[10px] font-normal opacity-80">(Click to Test DB Write)</span>
                                                </>
                                            )}
                                        </button>

                                        <div className="pt-1">
                                            <label className="text-[10px] font-bold uppercase text-slate-400">Footer Trust Note</label>
                                            <input
                                                type="text"
                                                value={fConfig.footerNote || "🔒 100% Free Service • No CIBIL Impact • Doorstep Support"}
                                                onChange={(e) => updateFormConfig(block.id, { footerNote: e.target.value })}
                                                className="w-full text-[11px] text-center text-slate-500 bg-transparent border-b border-slate-200 focus:outline-none focus:border-slate-400 py-0.5"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Form Columns Configuration Manager */}
                            {renderFormFieldsManager(block.id, fields, false)}
                        </div>
                    </div>
                );
            }
            case "tags": {
                const tagList = (block.content || "").split(",").map((t) => t.trim()).filter(Boolean);
                return (
                    <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-100 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-purple-900">
                            <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[16px]">label</span>
                                Tags Cloud Widget
                            </span>
                            <span className="text-[10px] text-purple-600 font-mono">{tagList.length} tags</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {tagList.map((tag, idx) => (
                                <span key={idx} className="inline-flex items-center gap-1 px-3 py-1 bg-white text-purple-700 font-bold text-xs rounded-full border border-purple-200 shadow-2xs">
                                    <span>#{tag}</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const next = tagList.filter((_, i) => i !== idx).join(", ");
                                            updateBlock(block.id, next);
                                        }}
                                        className="text-purple-400 hover:text-rose-600 cursor-pointer ml-1"
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                        </div>
                        <input
                            type="text"
                            placeholder="Add tags comma separated (e.g. iPhoneAir, PriceDrop, AmazonDeals)..."
                            value={block.content}
                            onChange={(e) => updateBlock(block.id, e.target.value)}
                            className="w-full text-xs px-3 py-1.5 bg-white border border-purple-200 rounded-lg text-slate-800 focus:outline-none"
                        />
                    </div>
                );
            }
            default:
                return null;
        }
    };

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-slate-100">
            {/* Top Toolbar */}
            <header className="h-16 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 text-white flex items-center justify-between px-6 shadow-lg flex-shrink-0">
                <div className="flex items-center gap-4">
                    {onBack ? (
                        <button
                            onClick={onBack}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-xs font-bold cursor-pointer"
                        >
                            <span className="material-symbols-outlined text-sm">arrow_back</span>
                            <span>Back to List</span>
                        </button>
                    ) : (
                        <Link
                            href={backHref}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-xs font-bold"
                        >
                            <span className="material-symbols-outlined text-sm">arrow_back</span>
                            <span>Back to Dashboard</span>
                        </Link>
                    )}
                    <h1 className="text-base font-bold hidden md:block">✨ Create Blog Post - Canva Studio</h1>
                </div>
                <div className="flex items-center gap-3">
                    {/* SEO Health Quick Badge */}
                    <button
                        type="button"
                        onClick={() => setSidebarTab("seo")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                            seoAnalysis.score >= 80
                                ? "bg-emerald-500/20 text-emerald-100 border-emerald-400/50 hover:bg-emerald-500/30"
                                : seoAnalysis.score >= 50
                                ? "bg-amber-500/20 text-amber-100 border-amber-400/50 hover:bg-amber-500/30"
                                : "bg-rose-500/20 text-rose-100 border-rose-400/50 hover:bg-rose-500/30"
                        }`}
                        title="Click to view SEO analysis & SERP preview"
                    >
                        <span className="material-symbols-outlined text-[15px]">manage_search</span>
                        <span>SEO: {seoAnalysis.score}/100</span>
                    </button>
                    <button
                        onClick={autoSave}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/20 transition-colors text-xs font-medium"
                        title="Auto-save enabled"
                    >
                        <span className="material-symbols-outlined text-sm">cloud_sync</span>
                        <span className="hidden sm:inline">{saveStatus}</span>
                    </button>
                    <button
                        onClick={previewBlog}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-xs font-semibold"
                    >
                        <span className="material-symbols-outlined text-sm">visibility</span>
                        <span className="hidden sm:inline">Preview</span>
                    </button>
                    <button
                        onClick={handlePublish}
                        disabled={loading}
                        className="flex items-center gap-2 px-5 py-1.5 bg-white text-purple-700 font-bold text-xs rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-sm">publish</span>
                        <span>{loading ? "Publishing..." : "Publish"}</span>
                    </button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar */}
                <aside className="w-[330px] md:w-[360px] bg-white border-r border-slate-200 overflow-y-auto flex-shrink-0 flex flex-col">
                    {/* Top Mode Tabs */}
                    <div className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-20 shadow-2xs">
                        <button
                            type="button"
                            onClick={() => setSidebarTab("content")}
                            className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                                sidebarTab === "content"
                                    ? "border-indigo-600 text-indigo-700 bg-white shadow-2xs"
                                    : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                            }`}
                        >
                            <span className="material-symbols-outlined text-[16px]">widgets</span>
                            <span>Content</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setSidebarTab("seo")}
                            className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                                sidebarTab === "seo"
                                    ? "border-indigo-600 text-indigo-700 bg-white shadow-2xs"
                                    : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                            }`}
                        >
                            <span className="material-symbols-outlined text-[16px]">manage_search</span>
                            <span>SEO & SERP</span>
                            <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                                    seoAnalysis.score >= 80
                                        ? "bg-emerald-100 text-emerald-800"
                                        : seoAnalysis.score >= 50
                                        ? "bg-amber-100 text-amber-800"
                                        : "bg-rose-100 text-rose-800"
                                }`}
                            >
                                {seoAnalysis.score}
                            </span>
                        </button>
                    </div>

                    {sidebarTab === "content" ? (
                        <div className="p-4">
                            {/* Templates Section */}
                            <div className="mb-6">
                                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">📐 Templates</h2>
                                <div className="space-y-2">
                                    {TEMPLATES.map((t) => (
                                        <div
                                            key={t.id}
                                            onClick={() => loadTemplate(t.id)}
                                            className="border border-slate-200 rounded-lg p-2.5 cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/40 transition-all"
                                        >
                                            <p className="font-bold text-xs text-slate-800">{t.name}</p>
                                            <p className="text-[10px] text-slate-500">{t.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <hr className="my-4 border-slate-200" />

                            {/* Elements Section */}
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">🎨 Elements</h2>
                                <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded">Click or Drag</span>
                            </div>
                            <div className="space-y-2">
                                {ELEMENT_TYPES.map((el) => {
                                    if (el.type === "heading") {
                                        return (
                                            <div key="headings-group" className="space-y-1.5">
                                                {/* Main Heading Card */}
                                                <div
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e, "heading", undefined, 2)}
                                                    onDragEnd={handleDragEnd}
                                                    className="p-2.5 rounded-xl border border-blue-200/90 bg-gradient-to-r from-blue-50/70 to-indigo-50/40 hover:border-blue-400 transition-all shadow-2xs group/headcard"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div
                                                            onClick={() => setIsHeadingsExpanded(!isHeadingsExpanded)}
                                                            className="flex items-center gap-2.5 cursor-pointer flex-1"
                                                            title="Click to toggle H1-H6 list"
                                                        >
                                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-blue-600 text-white shadow-xs">
                                                                <span className="material-symbols-outlined text-[18px]">title</span>
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-xs text-slate-800 flex items-center gap-1.5 group-hover/headcard:text-blue-700 transition-colors">
                                                                    Headings (H1 - H6)
                                                                    <span className="text-[9px] font-black bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full uppercase">All 6 Types</span>
                                                                </p>
                                                                <p className="text-[10px] text-slate-500">Pick any heading level (H1 to H6)</p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => setIsHeadingsExpanded(!isHeadingsExpanded)}
                                                            className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer transition-colors"
                                                            title={isHeadingsExpanded ? "Collapse levels" : "Expand all levels"}
                                                        >
                                                            <span className="material-symbols-outlined text-base font-bold">
                                                                {isHeadingsExpanded ? "expand_less" : "expand_more"}
                                                            </span>
                                                        </button>
                                                    </div>

                                                    {/* Quick 1-Click Pill Buttons for H1-H6 */}
                                                    <div className="mt-2 pt-2 border-t border-blue-100/90 flex items-center justify-between gap-1">
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Quick Add:</span>
                                                        <div className="flex items-center gap-1 flex-wrap">
                                                            {HEADING_LEVELS.map((hl) => (
                                                                <button
                                                                    key={hl.level}
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleAddElement("heading", undefined, hl.level);
                                                                    }}
                                                                    title={`Add ${hl.name} (${hl.sizeLabel})`}
                                                                    className="px-1.5 py-0.5 rounded text-[10px] font-black bg-white hover:bg-blue-600 hover:text-white border border-blue-200 text-blue-700 transition-all cursor-pointer shadow-2xs active:scale-95"
                                                                >
                                                                    H{hl.level}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Expanded List of all H1-H6 levels with drag & drop */}
                                                {isHeadingsExpanded && (
                                                    <div className="space-y-1 pl-2 border-l-2 border-blue-200/80 ml-3 py-1">
                                                        {HEADING_LEVELS.map((hl) => (
                                                            <div
                                                                key={hl.level}
                                                                draggable
                                                                onDragStart={(e) => handleDragStart(e, "heading", undefined, hl.level)}
                                                                onDragEnd={handleDragEnd}
                                                                onClick={() => handleAddElement("heading", undefined, hl.level)}
                                                                className="flex items-center justify-between p-2 rounded-lg border border-slate-200/80 bg-white hover:bg-blue-50/50 hover:border-blue-300 transition-all cursor-pointer group/hitem shadow-2xs"
                                                                title={`Click or drag to add ${hl.name}`}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`w-6 h-6 rounded flex items-center justify-center font-black text-[10px] shrink-0 ${hl.badgeBg}`}>
                                                                        H{hl.level}
                                                                    </span>
                                                                    <div>
                                                                        <p className="font-bold text-[11px] text-slate-800 group-hover/hitem:text-blue-700 transition-colors">
                                                                            {hl.name}
                                                                        </p>
                                                                        <p className="text-[9px] text-slate-400">
                                                                            {hl.sublabel} • <span className="font-mono text-slate-500 font-semibold">{hl.sizeLabel}</span>
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <span className="text-[10px] font-bold text-blue-600 opacity-0 group-hover/hitem:opacity-100 transition-opacity bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                                                                    + Add
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }

                                    return (
                                        <div
                                            key={el.label}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, el.type, el.defaultLayout, undefined, el.defaultListType)}
                                            onDragEnd={handleDragEnd}
                                            onClick={() => handleAddElement(el.type, el.defaultLayout, undefined, el.defaultListType)}
                                            className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200/80 cursor-pointer active:scale-[0.98] hover:bg-indigo-50/50 hover:border-indigo-300 transition-all group/item shadow-2xs bg-white"
                                            title="Click to add or drag into position"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${COLOR_MAP[el.color]}`}>
                                                    <span className="material-symbols-outlined text-[18px]">{el.icon}</span>
                                                </div>
                                                <div>
                                                    <p className="font-bold text-xs text-slate-800 group-hover/item:text-indigo-700 transition-colors">{el.label}</p>
                                                    <p className="text-[10px] text-slate-400">{el.desc}</p>
                                                </div>
                                            </div>
                                            <span className="text-slate-300 group-hover/item:text-indigo-600 transition-colors text-sm font-bold opacity-0 group-hover/item:opacity-100 mr-1 shrink-0">
                                                +
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            <hr className="my-4 border-slate-200" />

                            {/* Blog Settings */}
                            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">⚙️ Blog Settings</h2>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-700">Blog Title *</label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="Enter title..."
                                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs mt-1 focus:ring-2 focus:ring-indigo-200 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-700">Slug (Auto-generated) *</label>
                                    <input
                                        type="text"
                                        value={slug}
                                        readOnly
                                        placeholder="auto-generated-from-title"
                                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs mt-1 bg-slate-50 font-mono text-slate-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-700">Category *</label>
                                    <select
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs mt-1 focus:ring-2 focus:ring-indigo-200 outline-none"
                                    >
                                        <option value="Education">Education</option>
                                        <option value="Finance">Finance</option>
                                        <option value="Technology">Technology</option>
                                        <option value="News">News</option>
                                        <option value="Tips & Guides">Tips & Guides</option>
                                        <option value="Loan Guidance">Loan Guidance</option>
                                        <option value="Bank Reviews">Bank Reviews</option>
                                        <option value="Student Life">Student Life</option>
                                        <option value="Visa & Admissions">Visa & Admissions</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-700">Author *</label>
                                    <input
                                        type="text"
                                        value={author}
                                        onChange={(e) => setAuthor(e.target.value)}
                                        placeholder="Author name"
                                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs mt-1 focus:ring-2 focus:ring-indigo-200 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-700">Tags</label>
                                    <input
                                        type="text"
                                        value={tags}
                                        onChange={(e) => setTags(e.target.value)}
                                        placeholder="tag1, tag2, tag3"
                                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs mt-1 focus:ring-2 focus:ring-indigo-200 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-700">Excerpt</label>
                                    <textarea
                                        value={excerpt}
                                        onChange={(e) => setExcerpt(e.target.value)}
                                        placeholder="Short description..."
                                        rows={3}
                                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs mt-1 resize-none focus:ring-2 focus:ring-indigo-200 outline-none"
                                    />
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isFeatured}
                                        onChange={(e) => setIsFeatured(e.target.checked)}
                                        className="w-3.5 h-3.5 rounded accent-indigo-600"
                                    />
                                    <span className="text-xs font-semibold text-slate-700">Mark as featured</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isPublished}
                                        onChange={(e) => setIsPublished(e.target.checked)}
                                        className="w-3.5 h-3.5 rounded accent-indigo-600"
                                    />
                                    <span className="text-xs font-semibold text-slate-700">Publish immediately</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={enableComments}
                                        onChange={(e) => setEnableComments(e.target.checked)}
                                        className="w-3.5 h-3.5 rounded accent-indigo-600"
                                    />
                                    <span className="text-xs font-semibold text-slate-700">Enable comments</span>
                                </label>
                            </div>
                        </div>
                    ) : (
                        /* SEO SECTION */
                        <div className="p-4 space-y-4">
                            {/* SEO Score Banner */}
                            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-purple-900 text-white shadow-md relative overflow-hidden">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-indigo-300 text-[18px]">travel_explore</span>
                                        <span className="text-xs font-bold tracking-wide uppercase text-indigo-200">SEO Score</span>
                                    </div>
                                    <span
                                        className={`px-2.5 py-0.5 rounded-full text-xs font-black shadow-xs ${
                                            seoAnalysis.score >= 80
                                                ? "bg-emerald-500 text-white"
                                                : seoAnalysis.score >= 50
                                                ? "bg-amber-500 text-white"
                                                : "bg-rose-500 text-white"
                                        }`}
                                    >
                                        {seoAnalysis.score} / 100
                                    </span>
                                </div>
                                <div className="w-full bg-white/20 rounded-full h-2 mb-3 overflow-hidden">
                                    <div
                                        className={`h-2 rounded-full transition-all duration-500 ${
                                            seoAnalysis.score >= 80
                                                ? "bg-emerald-400"
                                                : seoAnalysis.score >= 50
                                                ? "bg-amber-400"
                                                : "bg-rose-400"
                                        }`}
                                        style={{ width: `${Math.max(5, seoAnalysis.score)}%` }}
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                                    <div className="bg-white/10 rounded-lg py-1 px-1.5">
                                        <span className="font-bold text-emerald-300 block text-xs">{seoAnalysis.passes}</span>
                                        <span className="text-indigo-200">Passes</span>
                                    </div>
                                    <div className="bg-white/10 rounded-lg py-1 px-1.5">
                                        <span className="font-bold text-amber-300 block text-xs">{seoAnalysis.warns}</span>
                                        <span className="text-indigo-200">Warnings</span>
                                    </div>
                                    <div className="bg-white/10 rounded-lg py-1 px-1.5">
                                        <span className="font-bold text-rose-300 block text-xs">{seoAnalysis.fails}</span>
                                        <span className="text-indigo-200">Issues</span>
                                    </div>
                                </div>
                            </div>

                            {/* SEO Sub-Tab Switcher */}
                            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl text-[10px] font-bold">
                                <button
                                    type="button"
                                    onClick={() => setSeoTabMode("serp")}
                                    className={`py-1.5 rounded-lg transition-all cursor-pointer text-center ${
                                        seoTabMode === "serp" ? "bg-white text-indigo-700 shadow-2xs font-extrabold" : "text-slate-500 hover:text-slate-800"
                                    }`}
                                >
                                    Google SERP
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSeoTabMode("social")}
                                    className={`py-1.5 rounded-lg transition-all cursor-pointer text-center ${
                                        seoTabMode === "social" ? "bg-white text-indigo-700 shadow-2xs font-extrabold" : "text-slate-500 hover:text-slate-800"
                                    }`}
                                >
                                    Social Card
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSeoTabMode("checklist")}
                                    className={`py-1.5 rounded-lg transition-all cursor-pointer text-center ${
                                        seoTabMode === "checklist" ? "bg-white text-indigo-700 shadow-2xs font-extrabold" : "text-slate-500 hover:text-slate-800"
                                    }`}
                                >
                                    Audit
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSeoTabMode("faq")}
                                    className={`py-1.5 rounded-lg transition-all cursor-pointer text-center ${
                                        seoTabMode === "faq" ? "bg-white text-indigo-700 shadow-2xs font-extrabold" : "text-slate-500 hover:text-slate-800"
                                    }`}
                                >
                                    FAQ ({faqSchema.length})
                                </button>
                            </div>

                            {/* SUB-VIEW 1: GOOGLE SERP SIMULATION & MAIN METADATA */}
                            {seoTabMode === "serp" && (
                                <div className="space-y-4">
                                    {/* Google SERP Card Preview */}
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[14px] text-indigo-600">preview</span>
                                                Google Search Snippet
                                            </span>
                                            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 text-[10px]">
                                                <button
                                                    type="button"
                                                    onClick={() => setSerpDevice("desktop")}
                                                    className={`px-2 py-0.5 rounded cursor-pointer ${serpDevice === "desktop" ? "bg-indigo-600 text-white font-bold" : "text-slate-500"}`}
                                                >
                                                    Desktop
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setSerpDevice("mobile")}
                                                    className={`px-2 py-0.5 rounded cursor-pointer ${serpDevice === "mobile" ? "bg-indigo-600 text-white font-bold" : "text-slate-500"}`}
                                                >
                                                    Mobile
                                                </button>
                                            </div>
                                        </div>

                                        <div className="p-3 bg-white rounded-lg border border-slate-200/90 shadow-2xs font-sans text-left">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <div className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[9px] font-black">
                                                    V
                                                </div>
                                                <div className="leading-none">
                                                    <span className="text-[11px] font-medium text-slate-900 block">VidyaLoans</span>
                                                    <span className="text-[9px] text-slate-400 font-mono truncate block max-w-[240px]">
                                                        https://www.vidyaloans.in/blog/{slug || "post-url"}
                                                    </span>
                                                </div>
                                            </div>
                                            <h4 className="text-sm font-medium text-[#1a0dab] hover:underline cursor-pointer leading-snug line-clamp-2">
                                                {metaTitle.trim() || title || "Your Blog Post Headline"} | VidyaLoans
                                            </h4>
                                            <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2 mt-1">
                                                {metaDescription.trim() || excerpt || "Detailed education loan guidance, interest rates, eligibility criteria, and step-by-step application walkthrough."}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Focus Keyword */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-xs font-bold text-slate-700">Focus Keyword *</label>
                                            {focusKeyword && (
                                                <span
                                                    className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                                                        seoAnalysis.kwCount > 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                                                    }`}
                                                >
                                                    {seoAnalysis.kwCount} in content ({seoAnalysis.kwDensity}%)
                                                </span>
                                            )}
                                        </div>
                                        <input
                                            type="text"
                                            value={focusKeyword}
                                            onChange={(e) => {
                                                setFocusKeyword(e.target.value);
                                                setSaveStatus("Unsaved");
                                            }}
                                            placeholder="e.g. sbi education loan for abroad"
                                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-200 outline-none"
                                        />
                                        <p className="text-[10px] text-slate-400 mt-1">The main search query you want this blog to rank for on Google.</p>
                                    </div>

                                    {/* Meta Title */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-xs font-bold text-slate-700">Meta Title (SEO Title)</label>
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={autoFillMetaTitle}
                                                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                                                    title="Copy from Blog Title"
                                                >
                                                    Auto-Fill
                                                </button>
                                                <span
                                                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                                                        (metaTitle.length || title.length) >= 40 && (metaTitle.length || title.length) <= 65
                                                            ? "bg-emerald-100 text-emerald-800"
                                                            : (metaTitle.length || title.length) > 65
                                                            ? "bg-rose-100 text-rose-800"
                                                            : "bg-slate-100 text-slate-600"
                                                    }`}
                                                >
                                                    {metaTitle.length || title.length} / 60
                                                </span>
                                            </div>
                                        </div>
                                        <input
                                            type="text"
                                            value={metaTitle}
                                            onChange={(e) => {
                                                setMetaTitle(e.target.value);
                                                setSaveStatus("Unsaved");
                                            }}
                                            placeholder={title || "Article SEO title..."}
                                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-200 outline-none"
                                        />
                                        <p className="text-[10px] text-slate-400 mt-1">Recommended length: 40-60 characters for complete SERP display.</p>
                                    </div>

                                    {/* Meta Description */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-xs font-bold text-slate-700">Meta Description</label>
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={autoFillMetaDesc}
                                                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                                                    title="Auto-extract from first content paragraph"
                                                >
                                                    Auto-Extract
                                                </button>
                                                <span
                                                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                                                        (metaDescription.length || excerpt.length) >= 120 && (metaDescription.length || excerpt.length) <= 160
                                                            ? "bg-emerald-100 text-emerald-800"
                                                            : (metaDescription.length || excerpt.length) > 160
                                                            ? "bg-rose-100 text-rose-800"
                                                            : "bg-slate-100 text-slate-600"
                                                    }`}
                                                >
                                                    {metaDescription.length || excerpt.length} / 155
                                                </span>
                                            </div>
                                        </div>
                                        <textarea
                                            value={metaDescription}
                                            onChange={(e) => {
                                                setMetaDescription(e.target.value);
                                                setSaveStatus("Unsaved");
                                            }}
                                            placeholder={excerpt || "Summarize the blog post for searchers..."}
                                            rows={3}
                                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs resize-none focus:ring-2 focus:ring-indigo-200 outline-none"
                                        />
                                        <p className="text-[10px] text-slate-400 mt-1">Target 120-160 characters. Appears as snippet text beneath your link.</p>
                                    </div>

                                    {/* Slug & Canonical */}
                                    <div className="space-y-3 pt-2 border-t border-slate-200">
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-xs font-bold text-slate-700">URL Slug</label>
                                                <button
                                                    type="button"
                                                    onClick={autoGenerateCleanSlug}
                                                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                                                >
                                                    Regenerate
                                                </button>
                                            </div>
                                            <input
                                                type="text"
                                                value={slug}
                                                onChange={(e) => {
                                                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9\-]/g, "-"));
                                                    setSaveStatus("Unsaved");
                                                }}
                                                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono text-slate-700 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-200 outline-none"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-slate-700 block mb-1">Custom Canonical URL (Optional)</label>
                                            <input
                                                type="text"
                                                value={canonicalUrl}
                                                onChange={(e) => {
                                                    setCanonicalUrl(e.target.value);
                                                    setSaveStatus("Unsaved");
                                                }}
                                                placeholder={`https://www.vidyaloans.in/blog/${slug || "slug"}`}
                                                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-200 outline-none"
                                            />
                                        </div>

                                        {/* NoIndex Toggle */}
                                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                                            <label className="flex items-center justify-between cursor-pointer">
                                                <span className="text-xs font-bold text-slate-800">Search Engine Indexing</span>
                                                <input
                                                    type="checkbox"
                                                    checked={!noIndex}
                                                    onChange={(e) => {
                                                        setNoIndex(!e.target.checked);
                                                        setSaveStatus("Unsaved");
                                                    }}
                                                    className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                                                />
                                            </label>
                                            <p className="text-[10px] text-slate-500 leading-snug">
                                                {noIndex
                                                    ? "⚠️ Hidden: Search engines will receive noindex, nofollow and exclude this page."
                                                    : "✓ Active: Included in sitemap.xml and open to Google crawling."}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* SUB-VIEW 2: SOCIAL SHARE CARD (WHATSAPP, LINKEDIN, X) */}
                            {seoTabMode === "social" && (
                                <div className="space-y-4">
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                                        <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                            <span className="material-symbols-outlined text-[16px] text-indigo-600">share</span>
                                            Social & OpenGraph Preview
                                        </h4>
                                        <p className="text-[11px] text-slate-500">
                                            This is how your article card appears when shared on WhatsApp, LinkedIn, Twitter/X, and Facebook.
                                        </p>

                                        {/* Mock Share Card */}
                                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                                            <div className="aspect-[1.91/1] bg-slate-100 relative overflow-hidden flex items-center justify-center">
                                                {blocks.find((b) => b.type === "image")?.content || initialBlog?.coverImage || initialBlog?.featuredImage ? (
                                                    <img
                                                        src={blocks.find((b) => b.type === "image")?.content || initialBlog?.coverImage || initialBlog?.featuredImage}
                                                        alt="OG Preview"
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="text-center p-4">
                                                        <span className="material-symbols-outlined text-3xl text-slate-300">image</span>
                                                        <span className="text-[11px] text-slate-400 block font-medium">Add an Image block to set Social Preview</span>
                                                    </div>
                                                )}
                                                <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 text-white text-[9px] font-bold uppercase tracking-wider backdrop-blur-xs">
                                                    1200 x 630 OG Standard
                                                </span>
                                            </div>
                                            <div className="p-3 space-y-1">
                                                <span className="text-[10px] text-slate-400 font-mono uppercase block">VIDYALOANS.IN</span>
                                                <h5 className="text-xs font-bold text-slate-900 leading-snug line-clamp-2">
                                                    {metaTitle.trim() || title || "Your Blog Post Headline"}
                                                </h5>
                                                <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                                                    {metaDescription.trim() || excerpt || "Comprehensive guidance on study abroad education loans, rates, and criteria."}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* SUB-VIEW 3: AUDIT CHECKLIST */}
                            {seoTabMode === "checklist" && (
                                <div className="space-y-2.5">
                                    <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                                        <span className="text-xs font-bold text-slate-800">Audit Checklist ({seoAnalysis.checks.length})</span>
                                        <span className="text-[11px] font-mono text-slate-500">{seoAnalysis.wordCount} words (~{seoAnalysis.readingTime}m)</span>
                                    </div>
                                    <div className="space-y-2">
                                        {seoAnalysis.checks.map((chk) => (
                                            <div
                                                key={chk.id}
                                                className={`p-2.5 rounded-xl border text-left transition-all ${
                                                    chk.status === "pass"
                                                        ? "bg-emerald-50/50 border-emerald-200 text-emerald-950"
                                                        : chk.status === "warn"
                                                        ? "bg-amber-50/50 border-amber-200 text-amber-950"
                                                        : "bg-rose-50/50 border-rose-200 text-rose-950"
                                                }`}
                                            >
                                                <div className="flex items-center justify-between mb-0.5">
                                                    <span className="text-xs font-bold flex items-center gap-1.5">
                                                        <span className="material-symbols-outlined text-[15px]">
                                                            {chk.status === "pass" ? "check_circle" : chk.status === "warn" ? "warning" : "cancel"}
                                                        </span>
                                                        {chk.label}
                                                    </span>
                                                    <span
                                                        className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full ${
                                                            chk.status === "pass"
                                                                ? "bg-emerald-200 text-emerald-900"
                                                                : chk.status === "warn"
                                                                ? "bg-amber-200 text-amber-900"
                                                                : "bg-rose-200 text-rose-900"
                                                        }`}
                                                    >
                                                        {chk.status === "pass" ? "Pass" : chk.status === "warn" ? "Improve" : "Issue"}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] leading-snug pl-5 text-slate-600">{chk.message}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* SUB-VIEW 4: SCHEMA.ORG FAQ BUILDER */}
                            {seoTabMode === "faq" && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="text-xs font-bold text-slate-800">FAQ Schema (Rich Snippets)</h4>
                                            <p className="text-[10px] text-slate-500">Enables Google drop-down FAQ accordions in SERP.</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={addFaqItem}
                                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
                                        >
                                            <span>+ Add FAQ</span>
                                        </button>
                                    </div>

                                    {faqSchema.length === 0 ? (
                                        <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                                            <span className="material-symbols-outlined text-3xl text-slate-300 block mb-1">quiz</span>
                                            <p className="text-xs font-bold text-slate-600">No FAQs Added Yet</p>
                                            <p className="text-[10px] text-slate-400 mt-1 mb-3">Adding 2-4 FAQs can qualify this article for Google FAQ Rich Snippets.</p>
                                            <button
                                                type="button"
                                                onClick={addFaqItem}
                                                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-bold text-indigo-600 cursor-pointer shadow-2xs"
                                            >
                                                + Add First Question
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {faqSchema.map((item, idx) => (
                                                <div key={item.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 relative group">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[11px] font-black text-indigo-700 uppercase">Question #{idx + 1}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeFaqItem(item.id)}
                                                            className="text-slate-400 hover:text-rose-600 cursor-pointer text-xs font-bold"
                                                            title="Delete FAQ"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={item.question}
                                                        onChange={(e) => updateFaqItem(item.id, { question: e.target.value })}
                                                        placeholder="e.g. Can I get an education loan without collateral?"
                                                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-200 outline-none"
                                                    />
                                                    <textarea
                                                        value={item.answer}
                                                        onChange={(e) => updateFaqItem(item.id, { answer: e.target.value })}
                                                        placeholder="Answer details that Google should show..."
                                                        rows={2}
                                                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 resize-none focus:ring-2 focus:ring-indigo-200 outline-none"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </aside>

                {/* Main Canvas Area */}
                <main
                    className="flex-1 bg-slate-100 overflow-y-auto flex justify-center p-6 md:p-8"
                    onDragOver={(e) => handleCanvasDragOver(e)}
                    onDrop={(e) => handleCanvasDrop(e)}
                >
                    <div className="w-full max-w-[900px] bg-white min-h-[1000px] shadow-lg rounded-2xl p-8 md:p-12 border border-slate-200">
                        {/* Canvas Header */}
                        <div className="text-center mb-10 pb-6 border-b border-slate-200">
                            <h1 className="text-3xl font-extrabold text-slate-900 mb-2">
                                {title || "Your Blog Title"}
                            </h1>
                            <p className="text-xs text-slate-500 font-medium">
                                <span>{author || "Author Name"}</span> • <span>{currentDate}</span>
                            </p>
                        </div>

                        {/* Content Area */}
                        <div className="min-h-[400px]">
                            {blocks.length === 0 ? (
                                <div className="text-center text-slate-400 py-20 border-2 border-dashed border-slate-200 rounded-2xl">
                                    <span className="material-symbols-outlined text-5xl mb-3 block text-slate-300">edit_note</span>
                                    <p className="text-sm font-bold text-slate-600">Drag elements from the sidebar</p>
                                    <p className="text-xs mt-1 text-slate-400">Or choose a template to get started</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {blocks.map((block, index) => (
                                        <div
                                            key={block.id}
                                            draggable
                                            onDragStart={(e) => handleBlockDragStart(e, block.id)}
                                            onDragEnd={handleBlockDragEnd}
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                setDragOverIndex(index);
                                            }}
                                            onDrop={(e) => handleCanvasDrop(e, index)}
                                            className={`relative group p-4 border-2 border-dashed rounded-xl transition-all cursor-move
                                                ${draggingBlockId === block.id ? "opacity-50" : ""}
                                                ${dragOverIndex === index ? "border-emerald-400 bg-emerald-50/50" : "border-transparent hover:border-indigo-400 hover:bg-indigo-50/30"}
                                            `}
                                        >
                                            {/* Block Controls */}
                                            <div className="absolute -top-3 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                <button
                                                    onClick={() => openEditModal(block)}
                                                    className="px-2 py-1 bg-white border border-slate-200 rounded text-xs shadow-xs hover:bg-slate-50 text-slate-700 flex items-center"
                                                >
                                                    <span className="material-symbols-outlined text-xs">edit</span>
                                                </button>
                                                <button
                                                    onClick={() => duplicateBlock(block.id)}
                                                    className="px-2 py-1 bg-white border border-slate-200 rounded text-xs shadow-xs hover:bg-slate-50 text-slate-700 flex items-center"
                                                >
                                                    <span className="material-symbols-outlined text-xs">content_copy</span>
                                                </button>
                                                <button
                                                    onClick={() => removeBlock(block.id)}
                                                    className="px-2 py-1 bg-white border border-rose-200 rounded text-xs shadow-xs hover:bg-rose-50 text-rose-600 flex items-center"
                                                >
                                                    <span className="material-symbols-outlined text-xs">delete</span>
                                                </button>
                                            </div>

                                            {renderBlockContent(block)}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>

            {/* Edit Modal */}
            {showModal && editingBlock && (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
                    onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
                >
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-100">
                        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
                            <h3 className="text-base font-bold text-slate-900">Edit {editingBlock.type.charAt(0).toUpperCase() + editingBlock.type.slice(1)}</h3>
                            <button
                                onClick={() => setShowModal(false)}
                                className="material-symbols-outlined text-xl cursor-pointer text-slate-400 hover:text-rose-600 transition-colors"
                            >
                                close
                            </button>
                        </div>
                        <div className="p-6">
                            {editingBlock.type === "heading" ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-700 mb-2 block">
                                            Select Heading Level (H1 - H6)
                                        </label>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {HEADING_LEVELS.map((hl) => {
                                                const isSelected = (editingBlock.level || 2) === hl.level;
                                                return (
                                                    <button
                                                        key={hl.level}
                                                        type="button"
                                                        onClick={() => setEditingBlock({ ...editingBlock, level: hl.level })}
                                                        className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                                                            isSelected
                                                                ? "border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-200"
                                                                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 bg-white"
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className={`px-2 py-0.5 rounded text-xs font-black ${
                                                                isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"
                                                            }`}>
                                                                H{hl.level}
                                                            </span>
                                                            {isSelected && (
                                                                <span className="material-symbols-outlined text-xs text-indigo-600">check_circle</span>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-slate-800">{hl.name}</p>
                                                            <p className="text-[10px] text-slate-500">{hl.sublabel}</p>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-slate-700 mb-1 block">Heading Content</label>
                                        <input
                                            type="text"
                                            value={editingBlock.content}
                                            onChange={(e) => setEditingBlock({ ...editingBlock, content: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-200 outline-none"
                                            placeholder="Enter heading text..."
                                        />
                                    </div>

                                    {/* Live Preview */}
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                            Live Preview &lt;h{editingBlock.level || 2}&gt;
                                        </span>
                                        <div className={
                                            (editingBlock.level || 2) === 1 ? "text-2xl font-black text-slate-900" :
                                            (editingBlock.level || 2) === 2 ? "text-xl font-extrabold text-slate-900" :
                                            (editingBlock.level || 2) === 3 ? "text-lg font-bold text-slate-800" :
                                            (editingBlock.level || 2) === 4 ? "text-base font-bold text-slate-800" :
                                            (editingBlock.level || 2) === 5 ? "text-sm font-semibold text-slate-700" :
                                            "text-xs font-bold text-slate-600 uppercase tracking-wider"
                                        }>
                                            {editingBlock.content || "Empty heading text"}
                                        </div>
                                    </div>
                                </div>
                            ) : editingBlock.type === "image" ? (
                                <div className="space-y-4">
                                    {/* Source Mode Switcher */}
                                    <div>
                                        <label className="text-xs font-bold text-slate-700 mb-2 block">Image Source</label>
                                        <div className="grid grid-cols-2 gap-2 mb-3">
                                            <button
                                                type="button"
                                                onClick={() => setEditingBlock({ ...editingBlock, mediaMode: "upload" })}
                                                className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                                    editingBlock.mediaMode !== "url"
                                                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                                                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                                }`}
                                            >
                                                <span className="material-symbols-outlined text-sm">upload_file</span>
                                                <span>Upload from Device</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setEditingBlock({ ...editingBlock, mediaMode: "url" })}
                                                className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                                    editingBlock.mediaMode === "url"
                                                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                                                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                                }`}
                                            >
                                                <span className="material-symbols-outlined text-sm">link</span>
                                                <span>Image Web URL</span>
                                            </button>
                                        </div>

                                        {editingBlock.mediaMode !== "url" ? (
                                            <div
                                                onDragOver={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                }}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    const f = e.dataTransfer.files?.[0];
                                                    if (f) handleModalImageFileUpload(f);
                                                }}
                                                className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/30 rounded-2xl p-6 text-center transition-all"
                                            >
                                                <span className="material-symbols-outlined text-3xl text-indigo-500 mb-1 block">cloud_upload</span>
                                                <p className="text-xs font-bold text-slate-700 mb-0.5">Drag & drop image file here</p>
                                                <p className="text-[11px] text-slate-400 mb-3">Supports JPG, PNG, WEBP, GIF, SVG</p>
                                                <label className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs transition-colors">
                                                    <span className="material-symbols-outlined text-sm">folder_open</span>
                                                    <span>Browse from Computer</span>
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        className="hidden"
                                                        onChange={(e) => handleModalImageFileUpload(e.target.files?.[0])}
                                                    />
                                                </label>
                                                {editingBlock.fileName && (
                                                    <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-indigo-200 rounded-lg text-xs text-indigo-700 font-mono">
                                                        <span className="material-symbols-outlined text-sm text-emerald-500">check_circle</span>
                                                        <span className="font-bold">{editingBlock.fileName}</span>
                                                        {editingBlock.fileSize && <span className="text-slate-400">({editingBlock.fileSize})</span>}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div>
                                                <input
                                                    type="text"
                                                    value={editingBlock.content.startsWith("data:image") ? "" : editingBlock.content}
                                                    onChange={(e) => setEditingBlock({ ...editingBlock, content: e.target.value, fileName: undefined, fileSize: undefined })}
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-200 outline-none font-mono"
                                                    placeholder="https://example.com/image.jpg"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Caption Field */}
                                    <div>
                                        <label className="text-xs font-bold text-slate-700 mb-1 block">Image Caption / Attribution (Optional)</label>
                                        <input
                                            type="text"
                                            value={editingBlock.caption || ""}
                                            onChange={(e) => setEditingBlock({ ...editingBlock, caption: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-200 outline-none"
                                            placeholder="e.g. Photo courtesy of Stanford University, Admissions Center"
                                        />
                                    </div>

                                    {/* Crop Aspect Ratio */}
                                    <div>
                                        <label className="text-xs font-bold text-slate-700 mb-1 block">Aspect Ratio / Crop Dimension</label>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {[
                                                { label: "16:9 Landscape", val: "16/9" },
                                                { label: "4:3 Standard", val: "4/3" },
                                                { label: "1:1 Square", val: "1/1" },
                                                { label: "21:9 Ultra-Wide Banner", val: "21/9" },
                                                { label: "Auto / Natural", val: "auto" },
                                            ].map((r) => (
                                                <button
                                                    key={r.val}
                                                    type="button"
                                                    onClick={() => setEditingBlock({
                                                        ...editingBlock,
                                                        style: { ...editingBlock.style, aspectRatio: r.val },
                                                    })}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${(editingBlock.style?.aspectRatio || "16/9") === r.val
                                                            ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                                                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                                        }`}
                                                >
                                                    {r.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Fit Mode */}
                                    <div>
                                        <label className="text-xs font-bold text-slate-700 mb-1 block">Crop & Fit Behavior</label>
                                        <div className="flex items-center gap-2">
                                            {[
                                                { label: "Crop to Fill (Cover)", val: "cover" as const, desc: "Fills the container cleanly by cropping overflow" },
                                                { label: "Fit Entire Image (Contain)", val: "contain" as const, desc: "Shows whole image without clipping" },
                                                { label: "Stretch (Fill)", val: "fill" as const, desc: "Stretches to fill bounds" },
                                            ].map((f) => (
                                                <button
                                                    key={f.val}
                                                    type="button"
                                                    title={f.desc}
                                                    onClick={() => setEditingBlock({
                                                        ...editingBlock,
                                                        style: { ...editingBlock.style, objectFit: f.val },
                                                    })}
                                                    className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold border text-center transition-all cursor-pointer ${(editingBlock.style?.objectFit || "cover") === f.val
                                                            ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                                                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                                        }`}
                                                >
                                                    {f.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Height & Focus */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-bold text-slate-700 mb-1 block">Max Height</label>
                                            <select
                                                value={editingBlock.style?.maxHeight || "380px"}
                                                onChange={(e) => setEditingBlock({
                                                    ...editingBlock,
                                                    style: { ...editingBlock.style, maxHeight: e.target.value },
                                                })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-800"
                                            >
                                                <option value="240px">240px (Compact)</option>
                                                <option value="380px">380px (Standard Editorial)</option>
                                                <option value="500px">500px (Large Feature)</option>
                                                <option value="650px">650px (Hero Banner)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-700 mb-1 block">Crop Focus Point</label>
                                            <select
                                                value={editingBlock.style?.objectPosition || "center"}
                                                onChange={(e) => setEditingBlock({
                                                    ...editingBlock,
                                                    style: { ...editingBlock.style, objectPosition: e.target.value as any },
                                                })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-800"
                                            >
                                                <option value="top">Top Focus</option>
                                                <option value="center">Center Focus</option>
                                                <option value="bottom">Bottom Focus</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Preview */}
                                    {editingBlock.content && (
                                        <div className="mt-2">
                                            <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Live Crop Preview</span>
                                            <div
                                                className="rounded-xl overflow-hidden border border-slate-200 bg-slate-900"
                                                style={{ maxHeight: editingBlock.style?.maxHeight || "380px" }}
                                            >
                                                <img
                                                    src={editingBlock.content}
                                                    alt="Preview"
                                                    className="w-full block"
                                                    style={{
                                                        aspectRatio: editingBlock.style?.aspectRatio || "16/9",
                                                        objectFit: editingBlock.style?.objectFit || "cover",
                                                        objectPosition: editingBlock.style?.objectPosition || "center",
                                                        maxHeight: editingBlock.style?.maxHeight || "380px",
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : editingBlock.type === "split_content" || editingBlock.type === "container" ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-700 mb-1 block">Layout Mode</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {[
                                                { id: "content_form" as const, label: "📝 Content + 📋 Register Form", desc: "One side content, one side student lead form" },
                                                { id: "form_content" as const, label: "📋 Register Form + 📝 Content", desc: "One side student lead form, one side content" },
                                                { id: "image_text" as const, label: "🖼️ Left Image + 📝 Right Content", desc: "Photo with side details" },
                                                { id: "text_image" as const, label: "📝 Left Content + 🖼️ Right Image", desc: "Details with photo" },
                                            ].map((m) => (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    onClick={() => setEditingBlock({
                                                        ...editingBlock,
                                                        splitConfig: {
                                                            ...(editingBlock.splitConfig || { layoutType: "content_form" }),
                                                            layoutType: m.id,
                                                        },
                                                    })}
                                                    className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${(editingBlock.splitConfig?.layoutType || "content_form") === m.id
                                                            ? "bg-indigo-50 border-indigo-600 text-indigo-900 font-bold shadow-2xs"
                                                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                                                        }`}
                                                >
                                                    <p className="text-xs font-bold">{m.label}</p>
                                                    <p className="text-[10px] text-slate-500 mt-0.5">{m.desc}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {(editingBlock.splitConfig?.layoutType === "content_form" || editingBlock.splitConfig?.layoutType === "form_content") && (
                                        <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-3">
                                            <span className="text-[10px] font-black uppercase text-indigo-700 block">Registration Form Settings</span>
                                            <div>
                                                <label className="text-xs font-bold text-slate-700 mb-1 block">Form Heading</label>
                                                <input
                                                    type="text"
                                                    value={editingBlock.splitConfig?.formTitle || "Instant Loan Inquiry & Registration"}
                                                    onChange={(e) => setEditingBlock({
                                                        ...editingBlock,
                                                        splitConfig: {
                                                            ...(editingBlock.splitConfig || { layoutType: "content_form" }),
                                                            formTitle: e.target.value,
                                                        },
                                                    })}
                                                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-700 mb-1 block">Form Subtitle</label>
                                                <input
                                                    type="text"
                                                    value={editingBlock.splitConfig?.formSubtitle || "Enter your contact details to check eligibility & receive a callback within 15 minutes."}
                                                    onChange={(e) => setEditingBlock({
                                                        ...editingBlock,
                                                        splitConfig: {
                                                            ...(editingBlock.splitConfig || { layoutType: "content_form" }),
                                                            formSubtitle: e.target.value,
                                                        },
                                                    })}
                                                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-700 mb-1 block">Submit CTA Button Label</label>
                                                <input
                                                    type="text"
                                                    value={editingBlock.splitConfig?.formButtonText || "Register & Check Eligibility"}
                                                    onChange={(e) => setEditingBlock({
                                                        ...editingBlock,
                                                        splitConfig: {
                                                            ...(editingBlock.splitConfig || { layoutType: "content_form" }),
                                                            formButtonText: e.target.value,
                                                        },
                                                    })}
                                                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-indigo-700"
                                                />
                                            </div>

                                            {/* Columns Manager for Split Form */}
                                            {renderFormFieldsManager(
                                                editingBlock.id,
                                                editingBlock.splitConfig?.formFields || DEFAULT_FORM_FIELDS,
                                                true,
                                                (newFields) => {
                                                    setEditingBlock({
                                                        ...editingBlock,
                                                        splitConfig: {
                                                            ...(editingBlock.splitConfig || { layoutType: "content_form" }),
                                                            formFields: newFields,
                                                        },
                                                    });
                                                }
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : editingBlock.type === "registration_form" ? (
                                <div className="space-y-4">
                                    <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-3">
                                        <span className="text-[10px] font-black uppercase text-emerald-700 block">Separate Registration Form Settings</span>
                                        <div>
                                            <label className="text-xs font-bold text-slate-700 mb-1 block">Badge Text</label>
                                            <input
                                                type="text"
                                                value={editingBlock.formConfig?.badgeText || "Instant Assessment"}
                                                onChange={(e) => setEditingBlock({
                                                    ...editingBlock,
                                                    formConfig: {
                                                        ...(editingBlock.formConfig || {
                                                            formTitle: "Instant Loan Inquiry & Registration",
                                                            fields: DEFAULT_FORM_FIELDS,
                                                        }),
                                                        badgeText: e.target.value,
                                                    },
                                                })}
                                                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-700 mb-1 block">Form Heading</label>
                                            <input
                                                type="text"
                                                value={editingBlock.formConfig?.formTitle || "Instant Loan Inquiry & Registration"}
                                                onChange={(e) => setEditingBlock({
                                                    ...editingBlock,
                                                    formConfig: {
                                                        ...(editingBlock.formConfig || {
                                                            fields: DEFAULT_FORM_FIELDS,
                                                        }),
                                                        formTitle: e.target.value,
                                                    },
                                                })}
                                                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-700 mb-1 block">Form Subtitle</label>
                                            <input
                                                type="text"
                                                value={editingBlock.formConfig?.formSubtitle || "Enter your contact details to check eligibility & receive a callback within 15 minutes."}
                                                onChange={(e) => setEditingBlock({
                                                    ...editingBlock,
                                                    formConfig: {
                                                        ...(editingBlock.formConfig || {
                                                            fields: DEFAULT_FORM_FIELDS,
                                                        }),
                                                        formSubtitle: e.target.value,
                                                    },
                                                })}
                                                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-xs font-bold text-slate-700 mb-1 block">Submit Button Label</label>
                                                <input
                                                    type="text"
                                                    value={editingBlock.formConfig?.formButtonText || "Register & Check Eligibility"}
                                                    onChange={(e) => setEditingBlock({
                                                        ...editingBlock,
                                                        formConfig: {
                                                            ...(editingBlock.formConfig || {
                                                                fields: DEFAULT_FORM_FIELDS,
                                                            }),
                                                            formButtonText: e.target.value,
                                                        },
                                                    })}
                                                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-emerald-700"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-700 mb-1 block">Redirect URL</label>
                                                <input
                                                    type="text"
                                                    value={editingBlock.formConfig?.targetUrl || "/apply-loan"}
                                                    onChange={(e) => setEditingBlock({
                                                        ...editingBlock,
                                                        formConfig: {
                                                            ...(editingBlock.formConfig || {
                                                                fields: DEFAULT_FORM_FIELDS,
                                                            }),
                                                            targetUrl: e.target.value,
                                                        },
                                                    })}
                                                    placeholder="/apply-loan"
                                                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-700 mb-1 block">Footer Trust Note</label>
                                            <input
                                                type="text"
                                                value={editingBlock.formConfig?.footerNote || "🔒 100% Free Service • No CIBIL Impact • Doorstep Support"}
                                                onChange={(e) => setEditingBlock({
                                                    ...editingBlock,
                                                    formConfig: {
                                                        ...(editingBlock.formConfig || {
                                                            fields: DEFAULT_FORM_FIELDS,
                                                        }),
                                                        footerNote: e.target.value,
                                                    },
                                                })}
                                                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                                            />
                                        </div>
                                    </div>

                                    {/* Columns Manager for Standalone Registration Form */}
                                    {renderFormFieldsManager(
                                        editingBlock.id,
                                        editingBlock.formConfig?.fields || DEFAULT_FORM_FIELDS,
                                        false,
                                        (newFields) => {
                                            setEditingBlock({
                                                ...editingBlock,
                                                formConfig: {
                                                    ...(editingBlock.formConfig || {
                                                        formTitle: "Instant Loan Inquiry & Registration",
                                                    }),
                                                    fields: newFields,
                                                },
                                            });
                                        }
                                    )}
                                </div>
                            ) : editingBlock.type === "button" ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-bold text-slate-700 mb-1 block">Button Label / CTA Text *</label>
                                            <input
                                                type="text"
                                                value={editingBlock.buttonText || editingBlock.content || ""}
                                                onChange={(e) => setEditingBlock({
                                                    ...editingBlock,
                                                    content: e.target.value,
                                                    buttonText: e.target.value,
                                                })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-200 outline-none"
                                                placeholder="e.g. Apply for Study Loan Now"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-700 mb-1 block">Target URL (Web Link) *</label>
                                            <input
                                                type="text"
                                                value={editingBlock.buttonUrl || ""}
                                                onChange={(e) => setEditingBlock({ ...editingBlock, buttonUrl: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-200 outline-none"
                                                placeholder="e.g. /apply-loan or https://..."
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                            <label className="text-xs font-bold text-slate-700 mb-1 block">Color & Style Theme</label>
                                            <select
                                                value={editingBlock.buttonVariant || "gradient"}
                                                onChange={(e) => setEditingBlock({ ...editingBlock, buttonVariant: e.target.value as any })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-200 outline-none capitalize"
                                            >
                                                <option value="gradient">Purple-Indigo Gradient (Vibrant)</option>
                                                <option value="emerald">Emerald Success (Green)</option>
                                                <option value="dark">Dark Slate / Black</option>
                                                <option value="outline">Indigo Border / Outline</option>
                                                <option value="amber">Amber / Gold Accent</option>
                                                <option value="rose">Rose / Coral Action</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-slate-700 mb-1 block">Button Size</label>
                                            <select
                                                value={editingBlock.buttonSize || "md"}
                                                onChange={(e) => setEditingBlock({ ...editingBlock, buttonSize: e.target.value as any })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-200 outline-none"
                                            >
                                                <option value="sm">Small (Compact)</option>
                                                <option value="md">Medium (Standard)</option>
                                                <option value="lg">Large (Prominent Headline CTA)</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-slate-700 mb-1 block">Alignment</label>
                                            <select
                                                value={editingBlock.buttonAlign || "center"}
                                                onChange={(e) => setEditingBlock({ ...editingBlock, buttonAlign: e.target.value as any })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-200 outline-none"
                                            >
                                                <option value="center">Center</option>
                                                <option value="left">Left Aligned</option>
                                                <option value="right">Right Aligned</option>
                                                <option value="full">Full Width (100% Stretch)</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="pt-1">
                                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={editingBlock.buttonNewTab !== false}
                                                onChange={(e) => setEditingBlock({ ...editingBlock, buttonNewTab: e.target.checked })}
                                                className="rounded text-indigo-600 focus:ring-indigo-400"
                                            />
                                            Open link in a new browser tab (target=&ldquo;_blank&rdquo;)
                                        </label>
                                    </div>

                                    {/* Live Preview */}
                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Live Button Preview:</span>
                                        <div className={`flex ${
                                            editingBlock.buttonAlign === "left" ? "justify-start" :
                                            editingBlock.buttonAlign === "right" ? "justify-end" :
                                            editingBlock.buttonAlign === "full" ? "w-full justify-center" :
                                            "justify-center"
                                        }`}>
                                            <a
                                                href={editingBlock.buttonUrl || "#"}
                                                onClick={(e) => e.preventDefault()}
                                                className={`inline-flex items-center justify-center gap-2 font-bold cursor-pointer transition-all shadow-md ${
                                                    editingBlock.buttonVariant === "emerald" ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white" :
                                                    editingBlock.buttonVariant === "dark" ? "bg-slate-900 text-white" :
                                                    editingBlock.buttonVariant === "outline" ? "bg-transparent text-indigo-600 border-2 border-indigo-600" :
                                                    editingBlock.buttonVariant === "amber" ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white" :
                                                    editingBlock.buttonVariant === "rose" ? "bg-gradient-to-r from-rose-600 to-pink-600 text-white" :
                                                    "bg-gradient-to-r from-purple-600 to-indigo-600 text-white"
                                                } ${
                                                    editingBlock.buttonSize === "sm" ? "px-4 py-2 text-xs rounded-lg" :
                                                    editingBlock.buttonSize === "lg" ? "px-8 py-4 text-base rounded-2xl" :
                                                    "px-6 py-2.5 text-xs rounded-xl"
                                                } ${editingBlock.buttonAlign === "full" ? "w-full" : ""}`}
                                            >
                                                <span>{editingBlock.buttonText || editingBlock.content || "Click Here"}</span>
                                                <span className="material-symbols-outlined text-sm font-bold">arrow_forward</span>
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            ) : editingBlock.type === "list" ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-700 mb-1.5 block">Select List Format</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const raw = (editingBlock.content || "").split("\n").map((l) => l.replace(/^(\s*•|\s*-|\s*\d+[\.\)])\s*/, "").trim());
                                                    setEditingBlock({
                                                        ...editingBlock,
                                                        listType: "unordered",
                                                        content: raw.map((l) => `• ${l}`).join("\n"),
                                                    });
                                                }}
                                                className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 ${
                                                    editingBlock.listType !== "ordered"
                                                        ? "border-teal-600 bg-teal-50/70 ring-2 ring-teal-200"
                                                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 bg-white"
                                                }`}
                                            >
                                                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-teal-600 text-white shrink-0">
                                                    <span className="material-symbols-outlined text-xl">format_list_bulleted</span>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-800">Unordered List (Bullets)</p>
                                                    <p className="text-[10px] text-slate-500">Feature points, bulleted overview (&bull;)</p>
                                                </div>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const raw = (editingBlock.content || "").split("\n").map((l) => l.replace(/^(\s*•|\s*-|\s*\d+[\.\)])\s*/, "").trim());
                                                    setEditingBlock({
                                                        ...editingBlock,
                                                        listType: "ordered",
                                                        content: raw.map((l, i) => `${i + 1}. ${l}`).join("\n"),
                                                    });
                                                }}
                                                className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 ${
                                                    editingBlock.listType === "ordered"
                                                        ? "border-teal-600 bg-teal-50/70 ring-2 ring-teal-200"
                                                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 bg-white"
                                                }`}
                                            >
                                                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-teal-600 text-white shrink-0">
                                                    <span className="material-symbols-outlined text-xl">format_list_numbered</span>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-800">Ordered List (Numbered)</p>
                                                    <p className="text-[10px] text-slate-500">Step-by-step procedure (1, 2, 3)</p>
                                                </div>
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-slate-700 mb-1 block">
                                            List Items (Each line represents one item)
                                        </label>
                                        <textarea
                                            value={editingBlock.content}
                                            onChange={(e) => setEditingBlock({ ...editingBlock, content: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-200 outline-none min-h-[140px] resize-y font-sans leading-relaxed"
                                            placeholder="Item 1&#10;Item 2&#10;Item 3"
                                        />
                                    </div>

                                    {/* Live Preview */}
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                            Live Preview &lt;{editingBlock.listType === "ordered" ? "ol" : "ul"}&gt;
                                        </span>
                                        {editingBlock.listType === "ordered" ? (
                                            <ol className="list-decimal list-outside ml-5 space-y-1 text-xs text-slate-700">
                                                {(editingBlock.content || "")
                                                    .split("\n")
                                                    .map((l) => l.replace(/^(\s*•|\s*-|\s*\d+[\.\)])\s*/, "").trim())
                                                    .filter(Boolean)
                                                    .map((it, idx) => (
                                                        <li key={idx}>{it}</li>
                                                    ))}
                                            </ol>
                                        ) : (
                                            <ul className="list-disc list-outside ml-5 space-y-1 text-xs text-slate-700">
                                                {(editingBlock.content || "")
                                                    .split("\n")
                                                    .map((l) => l.replace(/^(\s*•|\s*-|\s*\d+[\.\)])\s*/, "").trim())
                                                    .filter(Boolean)
                                                    .map((it, idx) => (
                                                        <li key={idx}>{it}</li>
                                                    ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            ) : editingBlock.type === "video" ? (
                                <div className="space-y-4">
                                    {/* Video Source Switcher */}
                                    <div>
                                        <label className="text-xs font-bold text-slate-700 mb-2 block">Video Source</label>
                                        <div className="grid grid-cols-2 gap-2 mb-3">
                                            <button
                                                type="button"
                                                onClick={() => setEditingBlock({ ...editingBlock, mediaMode: "upload" })}
                                                className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                                    editingBlock.mediaMode !== "url"
                                                        ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                                                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                                }`}
                                            >
                                                <span className="material-symbols-outlined text-sm">video_file</span>
                                                <span>Upload Video File</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setEditingBlock({ ...editingBlock, mediaMode: "url" })}
                                                className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                                    editingBlock.mediaMode === "url"
                                                        ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                                                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                                }`}
                                            >
                                                <span className="material-symbols-outlined text-sm">link</span>
                                                <span>Video URL / Embed</span>
                                            </button>
                                        </div>

                                        {editingBlock.mediaMode !== "url" ? (
                                            <div
                                                onDragOver={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                }}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    const f = e.dataTransfer.files?.[0];
                                                    if (f) handleModalVideoFileUpload(f);
                                                }}
                                                className="border-2 border-dashed border-rose-200 hover:border-rose-400 bg-rose-50/30 rounded-2xl p-6 text-center transition-all"
                                            >
                                                <span className="material-symbols-outlined text-3xl text-rose-500 mb-1 block">movie</span>
                                                <p className="text-xs font-bold text-slate-700 mb-0.5">Drag & drop video file here</p>
                                                <p className="text-[11px] text-slate-400 mb-3">Supports MP4, WebM, Ogg, MOV</p>
                                                <label className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs transition-colors">
                                                    <span className="material-symbols-outlined text-sm">folder_open</span>
                                                    <span>Browse Video File</span>
                                                    <input
                                                        type="file"
                                                        accept="video/mp4,video/webm,video/ogg,video/quicktime,video/*"
                                                        className="hidden"
                                                        onChange={(e) => handleModalVideoFileUpload(e.target.files?.[0])}
                                                    />
                                                </label>
                                                {editingBlock.fileName && (
                                                    <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-rose-200 rounded-lg text-xs text-rose-700 font-mono">
                                                        <span className="material-symbols-outlined text-sm text-emerald-500">check_circle</span>
                                                        <span className="font-bold">{editingBlock.fileName}</span>
                                                        {editingBlock.fileSize && <span className="text-slate-400">({editingBlock.fileSize})</span>}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div>
                                                <label className="text-xs font-bold text-slate-700 mb-1 block">Video or Embed URL</label>
                                                <input
                                                    type="text"
                                                    value={editingBlock.content.startsWith("data:video") ? "" : editingBlock.content}
                                                    onChange={(e) => setEditingBlock({ ...editingBlock, content: e.target.value, fileName: undefined, fileSize: undefined })}
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-200 outline-none font-mono"
                                                    placeholder="Paste YouTube, Vimeo or MP4 URL (e.g. https://www.youtube.com/watch?v=...)"
                                                />
                                                <p className="text-[11px] text-slate-400 mt-1">Automatic conversion: YouTube watch URLs are converted into embed URLs automatically.</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Video Caption */}
                                    <div>
                                        <label className="text-xs font-bold text-slate-700 mb-1 block">Video Caption / Description (Optional)</label>
                                        <input
                                            type="text"
                                            value={editingBlock.caption || ""}
                                            onChange={(e) => setEditingBlock({ ...editingBlock, caption: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-200 outline-none"
                                            placeholder="e.g. Overview of international student loan application process"
                                        />
                                    </div>

                                    {/* Live Video Preview */}
                                    {editingBlock.content && (
                                        <div>
                                            <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Live Video Player Preview</span>
                                            <div className="aspect-video rounded-xl overflow-hidden bg-black border border-slate-200 shadow-inner">
                                                {isDirectVideoSource(editingBlock.content) ? (
                                                    <video
                                                        controls
                                                        playsInline
                                                        className="w-full h-full object-contain"
                                                        src={editingBlock.content}
                                                        key={editingBlock.content}
                                                    >
                                                        Your browser does not support the video tag.
                                                    </video>
                                                ) : (
                                                    <iframe
                                                        src={formatVideoEmbedUrl(editingBlock.content)}
                                                        className="w-full h-full"
                                                        allowFullScreen
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : editingBlock.type === "divider" || editingBlock.type === "spacer" ? (
                                <p className="text-xs text-slate-500">This element has no editable content.</p>
                            ) : (
                                <div>
                                    <label className="text-xs font-bold text-slate-700 mb-2 block">Content</label>
                                    <textarea
                                        value={editingBlock.content}
                                        onChange={(e) => setEditingBlock({ ...editingBlock, content: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-200 outline-none min-h-[160px] resize-none"
                                        placeholder="Enter content..."
                                    />
                                </div>
                            )}
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={saveEditModal}
                                    className="px-5 py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
