"use client";

import { useState, useEffect, useRef, DragEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { adminApi, blogApi } from "@/lib/api";
import { cleanHtmlContent, RichTextBlock } from "./DynamicBlogEditor";

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
    splitConfig?: SplitConfig;
    formConfig?: FormConfig;
    style?: {
        fontSize?: string;
        fontFamily?: string;
        fontWeight?: string;
        lineHeight?: string;
        color?: string;
        backgroundColor?: string;
        textAlign?: "left" | "center" | "right";
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

const ELEMENT_TYPES: { type: BlockType; label: string; icon: string; color: string; desc: string; defaultLayout?: SplitConfig["layoutType"] }[] = [
    { type: "heading", label: "Heading", icon: "title", color: "blue", desc: "Drag to add title" },
    { type: "registration_form", label: "Separate Register Form", icon: "how_to_reg", color: "emerald", desc: "Standalone customizable student inquiry/lead form" },
    { type: "split_content", label: "Split 2-Column", icon: "view_column", color: "indigo", desc: "Left/right matter or image & text" },
    { type: "split_content", label: "Content + Register Form", icon: "contact_mail", color: "purple", desc: "One side content, one side form", defaultLayout: "content_form" },
    { type: "container", label: "Container", icon: "view_agenda", color: "purple", desc: "Drag to add container" },
    { type: "text", label: "Text & Live Editor", icon: "text_fields", color: "green", desc: "Drag to add rich text" },
    { type: "image", label: "Image (Crop & Fit)", icon: "crop", color: "orange", desc: "Crop, aspect ratio & sizing" },
    { type: "video", label: "Video", icon: "videocam", color: "red", desc: "Drag to add video" },
    { type: "button", label: "Button", icon: "smart_button", color: "indigo", desc: "Drag to add CTA" },
    { type: "list", label: "List", icon: "format_list_bulleted", color: "teal", desc: "Drag to add bullets" },
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

    // Editor state
    const [blocks, setBlocks] = useState<Block[]>([]);
    const [draggedType, setDraggedType] = useState<BlockType | null>(null);
    const [draggedLayout, setDraggedLayout] = useState<SplitConfig["layoutType"] | undefined>(undefined);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
    const [saveStatus, setSaveStatus] = useState("Saved");
    const [activeHighlightPicker, setActiveHighlightPicker] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

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
        if (initialBlog.content && blocks.length === 0) {
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(initialBlog.content, "text/html");
                const parsedBlocks: Block[] = [];
                Array.from(doc.body.children).forEach((el, idx) => {
                    const tag = el.tagName.toLowerCase();
                    const bId = `blk_${Date.now()}_${idx}`;
                    if (tag.startsWith("h")) {
                        parsedBlocks.push({ id: bId, type: "heading", content: el.textContent || "" });
                    } else if (tag === "img") {
                        parsedBlocks.push({ id: bId, type: "image", content: el.getAttribute("src") || "" });
                    } else if (el.querySelector("img")) {
                        const img = el.querySelector("img");
                        parsedBlocks.push({ id: bId, type: "image", content: img?.getAttribute("src") || "" });
                    } else if (tag === "hr") {
                        parsedBlocks.push({ id: bId, type: "divider", content: "" });
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

    const applyHighlight = (blockId: string, bg: string = "#fef08a", _textColor?: string) => {
        const el = editorRefs.current[blockId] || document.getElementById(`editor-${blockId}`);
        const sel = window.getSelection();
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
                    containerEl.querySelectorAll('mark, [data-highlight="true"], span[style*="background"]')
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

            // 2. Check if selection is already inside an existing highlight container
            let container: Node | null = range.commonAncestorContainer;
            if (container.nodeType === Node.TEXT_NODE) {
                container = container.parentNode;
            }
            const existing = (container as HTMLElement)?.closest?.('[data-highlight="true"], mark') as HTMLElement | null;
            if (existing && containerEl?.contains(existing) && existing.textContent?.trim() === range.toString().trim()) {
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
                } catch {
                    try {
                        const frag = range.extractContents();
                        span.appendChild(frag);
                        range.insertNode(span);
                    } catch (_) { }
                }
            }

            if (containerEl) {
                // Convert any legacy marks
                const marks = Array.from(containerEl.querySelectorAll("mark"));
                marks.forEach((m) => {
                    const s = document.createElement("span");
                    s.setAttribute("data-highlight", "true");
                    s.style.backgroundColor = m.style.backgroundColor || bg;
                    s.innerHTML = m.innerHTML;
                    m.parentNode?.replaceChild(s, m);
                });
                updateBlock(blockId, containerEl.innerHTML);
            }
        }
        setActiveHighlightPicker(null);
    };

    const removeHighlight = (blockId: string) => {
        const el = editorRefs.current[blockId] || document.getElementById(`editor-${blockId}`);
        const sel = window.getSelection();

        const cleanHighlightNode = (node: HTMLElement) => {
            node.style.backgroundColor = "";
            node.style.background = "";
            node.removeAttribute("data-highlight");
            node.removeAttribute("data-color");

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

            if (node.style.padding === "2px 5px" || node.style.padding === "2px 6px") {
                node.style.padding = "";
            }
            if (node.style.borderRadius === "4px") {
                node.style.borderRadius = "";
            }
            if (node.style.fontWeight === "600") {
                node.style.fontWeight = "";
            }

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
            const containerEl = el || (range.commonAncestorContainer as HTMLElement)?.closest?.('[contenteditable="true"]') as HTMLElement | null;

            if (containerEl) {
                const ancestorNodes = [range.commonAncestorContainer, range.startContainer, range.endContainer];
                ancestorNodes.forEach((startNode) => {
                    let curr: Node | null = startNode;
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
                            if (selText.trim() === fullText.trim() || selText.length >= fullText.length) {
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

                const allHighlights = Array.from(
                    containerEl.querySelectorAll('mark, [data-highlight="true"], span[style*="background"]')
                ) as HTMLElement[];

                allHighlights.forEach((candidate) => {
                    if (candidate !== containerEl) {
                        if (
                            sel.isCollapsed ||
                            sel.containsNode(candidate, true) ||
                            (range.intersectsNode && range.intersectsNode(candidate))
                        ) {
                            cleanHighlightNode(candidate);
                        }
                    }
                });

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
            }
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
    const createBlock = (type: BlockType, defaultLayout?: SplitConfig["layoutType"]): Block => {
        const defaults: Record<BlockType, string> = {
            heading: "New Heading",
            container: "",
            split_content: "",
            registration_form: "",
            text: "Enter your text here...",
            image: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1200",
            video: "https://www.youtube.com/embed/dQw4w9WgXcQ",
            button: "Click Here",
            list: "• Item 1\n• Item 2\n• Item 3",
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
            targetUrl: "/apply-loan",
            badgeText: "Instant Assessment",
            footerNote: "🔒 100% Free Service • No CIBIL Impact • Doorstep Support",
            fields: DEFAULT_FORM_FIELDS.map((f) => ({ ...f, id: "f_" + Math.random().toString(36).substr(2, 6) })),
        };

        return {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            type,
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

    const handleAddElement = (type: BlockType, defaultLayout?: SplitConfig["layoutType"]) => {
        const newBlock = createBlock(type, defaultLayout);
        setBlocks((prev) => [...prev, newBlock]);
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
    const handleDragStart = (e: DragEvent, type: BlockType, defaultLayout?: SplitConfig["layoutType"]) => {
        setDraggedType(type);
        setDraggedLayout(defaultLayout);
        e.dataTransfer.effectAllowed = "copy";
    };

    const handleDragEnd = () => {
        setDraggedType(null);
        setDraggedLayout(undefined);
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
            const newBlock = createBlock(draggedType, draggedLayout);
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
        setDraggingBlockId(null);
        setDragOverIndex(null);
    };

    // Block operations
    const updateBlock = (id: string, content: string) => {
        setBlocks(blocks.map((b) => (b.id === id ? { ...b, content } : b)));
        setSaveStatus("Unsaved");
    };

    const removeBlock = (id: string) => {
        setBlocks(blocks.filter((b) => b.id !== id));
        setSaveStatus("Unsaved");
    };

    const duplicateBlock = (id: string) => {
        const index = blocks.findIndex((b) => b.id === id);
        if (index !== -1) {
            const newBlock = { ...blocks[index], id: Date.now().toString() };
            const newBlocks = [...blocks];
            newBlocks.splice(index + 1, 0, newBlock);
            setBlocks(newBlocks);
            setSaveStatus("Unsaved");
        }
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
            const htmlContent = blocks
                .map((b) => {
                    switch (b.type) {
                        case "heading":
                            return `<h2 class="text-3xl font-bold mt-8 mb-4">${b.content}</h2>`;
                        case "text":
                            return `<p class="text-lg leading-relaxed text-gray-700 mb-4">${b.content}</p>`;
                        case "image": {
                            const st = b.style || {};
                            const aspect = st.aspectRatio && st.aspectRatio !== "auto" ? `aspect-ratio: ${st.aspectRatio};` : "";
                            const maxH = st.maxHeight ? `max-height: ${st.maxHeight};` : "max-height: 480px;";
                            const fit = st.objectFit || "cover";
                            const pos = st.objectPosition || "center";
                            const rad = st.borderRadius || "16px";
                            return `<div class="my-8 overflow-hidden shadow-lg border border-slate-200/80" style="border-radius: ${rad};"><img src="${b.content}" class="w-full block" style="object-fit: ${fit}; object-position: ${pos}; ${maxH} ${aspect}" alt="Blog Image" /></div>`;
                        }
                        case "video":
                            return `<div class="my-8 aspect-video"><iframe src="${b.content}" class="w-full h-full rounded-2xl" frameborder="0" allowfullscreen></iframe></div>`;
                        case "button":
                            return `<div class="my-6"><a href="#" class="inline-block px-8 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-colors">${b.content}</a></div>`;
                        case "list":
                            const items = b.content.split("\n").map((item) => `<li>${item.replace(/^[•\-]\s*/, "")}</li>`).join("");
                            return `<ul class="list-disc list-inside my-4 space-y-2 text-gray-700">${items}</ul>`;
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
                                const formSubtitle = formCfg.formSubtitle || "Fill details for instant loan eligibility assessment & expert callback.";
                                const formBtn = formCfg.formButtonText || "Register & Check Eligibility";
                                const targetUrl = formCfg.targetUrl || "/apply-loan";
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
                                            <select name="${fieldName}" ${reqAttr} class="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white">
                                                ${opts}
                                            </select>
                                        </div>`;
                                    }

                                    return `
                                    <div class="${colClass}">
                                        <label class="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">${f.label}${reqStar}</label>
                                        <input type="${f.type}" name="${fieldName}" ${reqAttr} placeholder="${f.placeholder || ''}" class="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white" />
                                    </div>`;
                                }).join("");

                                return `
                                <div class="bg-white p-6 md:p-8 rounded-2xl border border-indigo-100 shadow-xl shadow-indigo-100/50 ${isStandalone ? 'max-w-2xl mx-auto my-8' : ''}">
                                    <div class="mb-4">
                                        <span class="inline-block px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-wider rounded-md mb-2">${badge}</span>
                                        <h3 class="text-xl font-extrabold text-slate-900 mb-1">${formTitle}</h3>
                                        <p class="text-slate-500 text-xs">${formSubtitle}</p>
                                    </div>
                                    <form action="${targetUrl}" method="GET" class="space-y-3">
                                        <input type="hidden" name="source" value="${isStandalone ? 'blog_register_standalone' : 'blog_register_split'}" />
                                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            ${fieldsHtml}
                                        </div>
                                        <button type="submit" class="w-full mt-2 py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                                            <span>${formBtn}</span>
                                            <span>&rarr;</span>
                                        </button>
                                        <p class="text-[10px] text-center text-slate-400 mt-2">${footer}</p>
                                    </form>
                                </div>`;
                            };

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
                                formSubtitle: "Fill details for instant loan eligibility assessment & expert callback.",
                                formButtonText: "Register & Check Eligibility",
                                targetUrl: "/apply-loan",
                                badgeText: "Instant Assessment",
                                footerNote: "🔒 100% Free Service • No CIBIL Impact • Doorstep Support",
                                fields: DEFAULT_FORM_FIELDS,
                            };
                            const fields = fConfig.fields && fConfig.fields.length > 0 ? fConfig.fields : DEFAULT_FORM_FIELDS;
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
                                        <select name="${fieldName}" ${reqAttr} class="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white">
                                            ${opts}
                                        </select>
                                    </div>`;
                                }

                                return `
                                <div class="${colClass}">
                                    <label class="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">${f.label}${reqStar}</label>
                                    <input type="${f.type}" name="${fieldName}" ${reqAttr} placeholder="${f.placeholder || ''}" class="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white" />
                                </div>`;
                            }).join("");

                            return `<div class="blog-form-standalone not-prose my-10 max-w-2xl mx-auto">
                                <div class="bg-white p-6 md:p-8 rounded-2xl border border-indigo-100 shadow-xl shadow-indigo-100/50">
                                    <div class="mb-4">
                                        <span class="inline-block px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-wider rounded-md mb-2">${fConfig.badgeText || "Instant Assessment"}</span>
                                        <h3 class="text-xl font-extrabold text-slate-900 mb-1">${fConfig.formTitle || "Instant Loan Inquiry & Registration"}</h3>
                                        <p class="text-slate-500 text-xs">${fConfig.formSubtitle || "Fill details for instant loan eligibility assessment & expert callback."}</p>
                                    </div>
                                    <form action="${fConfig.targetUrl || '/apply-loan'}" method="GET" class="space-y-3">
                                        <input type="hidden" name="source" value="blog_register_standalone" />
                                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            ${fieldsHtml}
                                        </div>
                                        <button type="submit" class="w-full mt-2 py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                                            <span>${fConfig.formButtonText || "Register & Check Eligibility"}</span>
                                            <span>&rarr;</span>
                                        </button>
                                        <p class="text-[10px] text-center text-slate-400 mt-2">${fConfig.footerNote || "🔒 100% Free Service • No CIBIL Impact • Doorstep Support"}</p>
                                    </form>
                                </div>
                            </div>`;
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

            const blogData = {
                title,
                slug: slug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                category,
                authorName: author,
                content: htmlContent,
                isPublished,
                isFeatured,
                featuredImage: blocks.find((b) => b.type === "image")?.content || "",
                excerpt: excerpt || blocks.find((b) => b.type === "text")?.content?.substring(0, 150) + "...",
                tags: typeof tags === "string" ? tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
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
            case "heading":
                return (
                    <h2
                        contentEditable
                        suppressContentEditableWarning
                        onPaste={(e) => {
                            e.preventDefault();
                            const text = e.clipboardData.getData("text/plain");
                            document.execCommand("insertText", false, text);
                            updateBlock(block.id, e.currentTarget.textContent || "");
                        }}
                        onBlur={(e) => updateBlock(block.id, e.currentTarget.textContent || "")}
                        className="text-3xl font-bold outline-none"
                    >
                        {block.content}
                    </h2>
                );
            case "text":
                return (
                    <div className="space-y-2 group/textblock">
                        {/* Interactive WYSIWYG & Dynamic Formatting Toolbar */}
                        <div className="flex items-center justify-between gap-2 flex-wrap bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        document.execCommand("bold");
                                    }}
                                    className="px-2 py-0.5 text-xs font-black text-slate-700 hover:bg-white rounded cursor-pointer"
                                    title="Bold (Ctrl+B)"
                                >
                                    B
                                </button>
                                <button
                                    type="button"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        document.execCommand("italic");
                                    }}
                                    className="px-2 py-0.5 text-xs italic font-serif text-slate-700 hover:bg-white rounded cursor-pointer"
                                    title="Italic (Ctrl+I)"
                                >
                                    I
                                </button>
                                <button
                                    type="button"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        document.execCommand("underline");
                                    }}
                                    className="px-2 py-0.5 text-xs underline font-semibold text-slate-700 hover:bg-white rounded cursor-pointer"
                                    title="Underline (Ctrl+U)"
                                >
                                    U
                                </button>

                                {/* Auto-closing Highlight Picker */}
                                <div className="relative inline-flex items-center">
                                    <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => applyHighlight(block.id, "#fef08a", "#854d0e")}
                                        className="px-2 py-0.5 text-xs font-black text-amber-900 bg-amber-200 hover:bg-amber-300 rounded-l cursor-pointer shadow-2xs border-r border-amber-300/80"
                                        title="Quick Yellow Highlight (or toggle off)"
                                    >
                                        Highlight
                                    </button>
                                    <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() =>
                                            setActiveHighlightPicker(activeHighlightPicker === block.id ? null : block.id)
                                        }
                                        className="px-1 py-0.5 text-xs text-amber-900 bg-amber-200 hover:bg-amber-300 rounded-r cursor-pointer"
                                        title="Choose Highlight Color or Remove"
                                    >
                                        ▾
                                    </button>
                                    {activeHighlightPicker === block.id && (
                                        <div
                                            onMouseDown={(e) => e.preventDefault()}
                                            className="absolute top-full left-0 mt-1 z-30 bg-white p-2 rounded-xl shadow-xl border border-slate-200 flex flex-col gap-1.5 min-w-[200px]"
                                        >
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 flex items-center justify-between">
                                                <span>Highlight Colors</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveHighlightPicker(null)}
                                                    className="text-slate-400 hover:text-slate-700 cursor-pointer"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-3 gap-1">
                                                {HIGHLIGHT_SWATCHES.map((swatch) => (
                                                    <button
                                                        key={swatch.name}
                                                        type="button"
                                                        onMouseDown={(e) => e.preventDefault()}
                                                        onClick={() => applyHighlight(block.id, swatch.bg, swatch.text)}
                                                        className="px-2 py-1 text-[11px] font-bold rounded-lg cursor-pointer text-center"
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
                                            <div className="border-t border-slate-100 pt-1">
                                                <button
                                                    type="button"
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    onClick={() => removeHighlight(block.id)}
                                                    className="w-full px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-rose-50 hover:text-rose-700 rounded-lg cursor-pointer flex items-center justify-center gap-1"
                                                >
                                                    Remove Highlight
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        const url = prompt("Enter hyperlink URL:", "https://");
                                        if (url) {
                                            document.execCommand("createLink", false, url);
                                        }
                                    }}
                                    className="px-2 py-0.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-white rounded cursor-pointer border border-indigo-200"
                                    title="Add Hyperlink"
                                >
                                    Link
                                </button>
                            </div>

                            {/* Dynamic Presets */}
                            <div className="flex items-center gap-1 text-[11px]">
                                <span className="text-[10px] font-bold text-slate-400">Preset:</span>
                                <button
                                    type="button"
                                    onClick={() => applyTextPreset(block.id, "body")}
                                    className="px-1.5 py-0.5 rounded font-semibold bg-white text-slate-700 hover:bg-indigo-50 border border-slate-200 cursor-pointer"
                                >
                                    Body
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyTextPreset(block.id, "lead")}
                                    className="px-1.5 py-0.5 rounded font-bold bg-white text-indigo-700 hover:bg-indigo-50 border border-indigo-200 cursor-pointer"
                                >
                                    Lead
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyTextPreset(block.id, "editorial")}
                                    className="px-1.5 py-0.5 rounded font-serif italic bg-white text-slate-800 hover:bg-amber-50 border border-slate-200 cursor-pointer"
                                >
                                    Editorial
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyTextPreset(block.id, "tip")}
                                    className="px-1.5 py-0.5 rounded font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 cursor-pointer"
                                >
                                    Deal Tip
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyTextPreset(block.id, "card")}
                                    className="px-1.5 py-0.5 rounded font-bold bg-slate-100 text-slate-700 hover:bg-white border border-slate-300 cursor-pointer"
                                >
                                    Card
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        try {
                                            document.execCommand("removeFormat", false, undefined);
                                        } catch (_) { }
                                        updateBlock(block.id, cleanHtmlContent(block.content || ""));
                                    }}
                                    className="px-1.5 py-0.5 rounded font-bold bg-slate-100 text-slate-700 hover:bg-white border border-slate-300 cursor-pointer text-xs"
                                    title="Clean formatting and remove dark backgrounds"
                                >
                                    Clean
                                </button>
                            </div>
                        </div>

                        {/* ContentEditable Live Dynamic Editor with Cursor Jump Protection */}
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
                            onSaveSelection={() => { }}
                        />
                    </div>
                );
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
                                {(["top", "center", "bottom"] as const).map((pos) => (
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

                        {/* Cropped & Adjusted Image Container */}
                        <div
                            className="relative overflow-hidden border border-slate-200 shadow-md bg-slate-900 group/preview"
                            style={{
                                borderRadius: currentRad,
                                maxHeight: currentMaxH,
                            }}
                        >
                            <img
                                src={block.content}
                                alt="Blog illustration"
                                className="w-full transition-all"
                                style={{
                                    aspectRatio: currentAspect,
                                    objectFit: currentFit,
                                    objectPosition: currentPos,
                                    maxHeight: currentMaxH,
                                }}
                            />

                            {/* Quick URL change on hover */}
                            <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center gap-2">
                                <span className="text-[10px] font-bold text-white uppercase tracking-wider shrink-0">Image URL:</span>
                                <input
                                    type="text"
                                    value={block.content}
                                    onChange={(e) => updateBlock(block.id, e.target.value)}
                                    className="flex-1 px-3 py-1 bg-white/20 backdrop-blur rounded-lg text-white text-xs border border-white/30 outline-none placeholder-white/60 font-mono"
                                    placeholder="Paste image URL..."
                                />
                            </div>
                        </div>
                    </div>
                );
            }
            case "video":
                return (
                    <div className="aspect-video rounded-xl overflow-hidden bg-gray-100">
                        <iframe src={block.content} className="w-full h-full" allowFullScreen />
                    </div>
                );
            case "button":
                return (
                    <div className="my-2 p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2 max-w-md">
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={block.content}
                                onChange={(e) => updateBlock(block.id, e.target.value)}
                                placeholder="Button label..."
                                className="flex-1 font-bold text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-800 focus:outline-none"
                            />
                        </div>
                        <button
                            type="button"
                            className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-xl text-xs shadow-md"
                        >
                            {block.content || "Click Here"}
                        </button>
                    </div>
                );
            case "list":
                return (
                    <textarea
                        value={block.content}
                        onChange={(e) => updateBlock(block.id, e.target.value)}
                        className="w-full text-gray-700 outline-none resize-none min-h-[100px] bg-transparent"
                        placeholder="• Item 1&#10;• Item 2&#10;• Item 3"
                    />
                );
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
                            <div className="flex items-center justify-between border-b border-indigo-50 pb-2">
                                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-wider rounded">
                                    📋 Registration Form Card (Split Layout)
                                </span>
                                <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    Lead Capture ({splitFormFields.length} columns)
                                </span>
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
                    targetUrl: "/apply-loan",
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

                        {/* Live Form Preview */}
                        <div className="p-5 sm:p-6 space-y-4">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                                <span>Live Responsive Column Layout</span>
                                <span>{fields.length} Columns</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                {fields.map((f) => (
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
                                                disabled
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 cursor-not-allowed"
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
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 cursor-not-allowed"
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Submit Button & Redirect Settings */}
                            <div className="space-y-2.5 pt-2 border-t border-slate-100">
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
                                        <label className="text-[10px] font-bold uppercase text-slate-500">Redirect URL on Submit</label>
                                        <input
                                            type="text"
                                            value={fConfig.targetUrl || "/apply-loan"}
                                            onChange={(e) => updateFormConfig(block.id, { targetUrl: e.target.value })}
                                            placeholder="/apply-loan"
                                            className="w-full text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:border-indigo-500 focus:outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 text-white font-extrabold text-sm rounded-xl shadow-md flex items-center justify-center gap-2">
                                    <span>{fConfig.formButtonText || "Register & Check Eligibility"}</span>
                                    <span>&rarr;</span>
                                </div>

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
                <aside className="w-[300px] bg-white border-r border-slate-200 overflow-y-auto flex-shrink-0">
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
                            {ELEMENT_TYPES.map((el) => (
                                <div
                                    key={el.label}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, el.type, el.defaultLayout)}
                                    onDragEnd={handleDragEnd}
                                    onClick={() => handleAddElement(el.type, el.defaultLayout)}
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
                            ))}
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
                            {editingBlock.type === "image" ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-700 mb-1 block">Image URL</label>
                                        <input
                                            type="text"
                                            value={editingBlock.content}
                                            onChange={(e) => setEditingBlock({ ...editingBlock, content: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-200 outline-none font-mono"
                                            placeholder="https://example.com/image.jpg"
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
                            ) : editingBlock.type === "video" ? (
                                <div>
                                    <label className="text-xs font-bold text-slate-700 mb-2 block">Video Embed URL</label>
                                    <input
                                        type="text"
                                        value={editingBlock.content}
                                        onChange={(e) => setEditingBlock({ ...editingBlock, content: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-200 outline-none"
                                        placeholder="https://youtube.com/embed/..."
                                    />
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
