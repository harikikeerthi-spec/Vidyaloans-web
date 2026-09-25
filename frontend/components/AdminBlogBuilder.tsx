"use client";

import { useState, useEffect, DragEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { adminApi } from "@/lib/api";

type BlockType = "heading" | "container" | "text" | "image" | "video" | "button" | "list" | "quote" | "code" | "divider" | "spacer" | "tags";

interface Block {
    id: string;
    type: BlockType;
    content: string;
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
    };
}

const ELEMENT_TYPES: { type: BlockType; label: string; icon: string; color: string; desc: string }[] = [
    { type: "heading", label: "Heading", icon: "title", color: "blue", desc: "Drag to add" },
    { type: "container", label: "Container", icon: "view_agenda", color: "purple", desc: "Drag to add" },
    { type: "text", label: "Text & Live Editor", icon: "text_fields", color: "green", desc: "Drag to add" },
    { type: "image", label: "Image", icon: "image", color: "orange", desc: "Drag to add" },
    { type: "video", label: "Video", icon: "videocam", color: "red", desc: "Drag to add" },
    { type: "button", label: "Button", icon: "smart_button", color: "indigo", desc: "Drag to add" },
    { type: "list", label: "List", icon: "format_list_bulleted", color: "teal", desc: "Drag to add" },
    { type: "quote", label: "Quote", icon: "format_quote", color: "yellow", desc: "Drag to add" },
    { type: "code", label: "Code Block", icon: "code", color: "gray", desc: "Drag to add" },
    { type: "divider", label: "Divider", icon: "horizontal_rule", color: "pink", desc: "Drag to add" },
    { type: "spacer", label: "Spacer", icon: "unfold_more", color: "cyan", desc: "Drag to add" },
    { type: "tags", label: "Tags Cloud", icon: "label", color: "purple", desc: "Drag to add" },
];

const COLOR_MAP: Record<string, string> = {
    blue: "bg-blue-100 text-blue-600",
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
}

export default function AdminBlogBuilder({ onBack, onPublished, backHref = "/admin" }: AdminBlogBuilderProps) {
    const { user } = useAuth();
    const router = useRouter();

    // Blog settings
    const [title, setTitle] = useState("");
    const [slug, setSlug] = useState("");
    const [category, setCategory] = useState("Education");
    const [author, setAuthor] = useState(user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : "");
    const [tags, setTags] = useState("");
    const [excerpt, setExcerpt] = useState("");
    const [isFeatured, setIsFeatured] = useState(false);
    const [isPublished, setIsPublished] = useState(true);
    const [enableComments, setEnableComments] = useState(true);

    // Editor state
    const [blocks, setBlocks] = useState<Block[]>([]);
    const [draggedType, setDraggedType] = useState<BlockType | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
    const [saveStatus, setSaveStatus] = useState("Saved");
    const [activeHighlightPicker, setActiveHighlightPicker] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Modal state
    const [editingBlock, setEditingBlock] = useState<Block | null>(null);
    const [showModal, setShowModal] = useState(false);

    // Generate slug from title
    useEffect(() => {
        const generated = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "");
        setSlug(generated);
    }, [title]);

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

    const applyHighlight = (blockId: string, bg: string = "#fef08a", textColor: string = "#854d0e") => {
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
            try {
                const range = sel.getRangeAt(0);
                let node: Node | null = range.commonAncestorContainer;
                if (node.nodeType === Node.TEXT_NODE) {
                    node = node.parentNode;
                }
                const existingMark =
                    (node as HTMLElement)?.closest?.("mark") ||
                    ((node as HTMLElement)?.tagName === "MARK" ? (node as HTMLElement) : null);

                if (existingMark) {
                    const isSame = existingMark.style.backgroundColor === bg;
                    if (isSame) {
                        const textNode = document.createTextNode(existingMark.textContent || "");
                        existingMark.parentNode?.replaceChild(textNode, existingMark);
                    } else {
                        existingMark.style.backgroundColor = bg;
                        existingMark.style.color = textColor;
                    }
                } else {
                    const mark = document.createElement("mark");
                    mark.style.backgroundColor = bg;
                    mark.style.color = textColor;
                    mark.style.padding = "2px 5px";
                    mark.style.borderRadius = "4px";
                    mark.style.fontWeight = "600";
                    try {
                        range.surroundContents(mark);
                    } catch {
                        const frag = range.extractContents();
                        mark.appendChild(frag);
                        range.insertNode(mark);
                    }
                }
                sel.collapseToEnd();
            } catch {
                try {
                    document.execCommand("hiliteColor", false, bg);
                } catch (_) {}
                sel.collapseToEnd();
            }
        }
        setActiveHighlightPicker(null);
    };

    const removeHighlight = (blockId: string) => {
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
            try {
                const range = sel.getRangeAt(0);
                let node: Node | null = range.commonAncestorContainer;
                if (node.nodeType === Node.TEXT_NODE) {
                    node = node.parentNode;
                }
                const existingMark =
                    (node as HTMLElement)?.closest?.("mark") ||
                    ((node as HTMLElement)?.tagName === "MARK" ? (node as HTMLElement) : null);
                if (existingMark) {
                    const textNode = document.createTextNode(existingMark.textContent || "");
                    existingMark.parentNode?.replaceChild(textNode, existingMark);
                } else {
                    document.execCommand("hiliteColor", false, "transparent");
                }
                sel.collapseToEnd();
            } catch {
                try {
                    document.execCommand("hiliteColor", false, "transparent");
                } catch {}
                sel?.collapseToEnd();
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
    const createBlock = (type: BlockType): Block => {
        const defaults: Record<BlockType, string> = {
            heading: "New Heading",
            container: "",
            text: "Enter your text here...",
            image: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=800",
            video: "https://www.youtube.com/embed/dQw4w9WgXcQ",
            button: "Click Here",
            list: "• Item 1\n• Item 2\n• Item 3",
            quote: "Enter an inspiring quote here...",
            code: "// Your code here\nconsole.log('Hello World');",
            divider: "",
            spacer: "",
            tags: "iPhoneAir, PriceDrop, AmazonDeals, TechNews",
        };
        return {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            type,
            content: defaults[type],
        };
    };

    // Drag handlers for sidebar elements
    const handleDragStart = (e: DragEvent, type: BlockType) => {
        setDraggedType(type);
        e.dataTransfer.effectAllowed = "copy";
    };

    const handleDragEnd = () => {
        setDraggedType(null);
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
            const newBlock = createBlock(draggedType);
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
                        case "image":
                            return `<img src="${b.content}" class="w-full rounded-2xl my-8 object-cover shadow-lg" alt="Blog Image" />`;
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
                        case "container":
                            return `<div class="p-6 bg-gray-50 rounded-xl my-6">${b.content}</div>`;
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
                tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
            };

            const res: any = await adminApi.createBlog(blogData);
            if (res.success) {
                alert("Blog published successfully!");
                if (onPublished) {
                    onPublished();
                } else {
                    router.push(backHref);
                }
            } else {
                alert(res.message || "Failed to publish blog");
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
                            </div>
                        </div>

                        {/* ContentEditable Live Dynamic Editor */}
                        <div
                            contentEditable
                            suppressContentEditableWarning
                            dangerouslySetInnerHTML={{ __html: block.content }}
                            onBlur={(e) => updateBlock(block.id, e.currentTarget.innerHTML || "")}
                            className="outline-none min-h-[3rem] transition-all"
                            style={{
                                fontSize: block.style?.fontSize || "16px",
                                textAlign: block.style?.textAlign || "left",
                                fontFamily: block.style?.fontFamily,
                                color: block.style?.color || "#374151",
                                backgroundColor: block.style?.backgroundColor,
                                padding: block.style?.padding,
                                borderRadius: block.style?.borderRadius,
                                border: block.style?.border,
                                borderLeft: block.style?.borderLeft,
                                lineHeight: block.style?.lineHeight || "1.65",
                            }}
                        />
                    </div>
                );
            case "image":
                return (
                    <div className="relative group/img">
                        <img src={block.content} alt="Blog" className="w-full rounded-xl object-cover max-h-[400px]" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                            <input
                                type="text"
                                value={block.content}
                                onChange={(e) => updateBlock(block.id, e.target.value)}
                                className="w-3/4 px-4 py-2 bg-white/20 backdrop-blur rounded-lg text-white text-sm border border-white/30 outline-none"
                                placeholder="Paste image URL..."
                            />
                        </div>
                    </div>
                );
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
                return (
                    <div className="p-6 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                        <p className="text-gray-400 text-sm">Container - Drop elements here</p>
                    </div>
                );
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
                        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">🎨 Elements (Drag to Canvas)</h2>
                        <div className="space-y-2">
                            {ELEMENT_TYPES.map((el) => (
                                <div
                                    key={el.type}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, el.type)}
                                    onDragEnd={handleDragEnd}
                                    className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 cursor-grab active:cursor-grabbing hover:bg-slate-50 hover:border-slate-200 transition-all"
                                >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${COLOR_MAP[el.color]}`}>
                                        <span className="material-symbols-outlined text-[18px]">{el.icon}</span>
                                    </div>
                                    <div>
                                        <p className="font-bold text-xs text-slate-800">{el.label}</p>
                                        <p className="text-[10px] text-slate-400">{el.desc}</p>
                                    </div>
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
                            {editingBlock.type === "image" || editingBlock.type === "video" ? (
                                <div>
                                    <label className="text-xs font-bold text-slate-700 mb-2 block">
                                        {editingBlock.type === "image" ? "Image URL" : "Video Embed URL"}
                                    </label>
                                    <input
                                        type="text"
                                        value={editingBlock.content}
                                        onChange={(e) => setEditingBlock({ ...editingBlock, content: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-200 outline-none"
                                        placeholder={editingBlock.type === "image" ? "https://example.com/image.jpg" : "https://youtube.com/embed/..."}
                                    />
                                    {editingBlock.type === "image" && editingBlock.content && (
                                        <img src={editingBlock.content} alt="Preview" className="mt-4 rounded-xl max-h-64 object-cover border border-slate-200" />
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
