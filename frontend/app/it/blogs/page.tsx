"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { blogApi } from "@/lib/api";
import Link from "next/link";

type BlockType =
  | "heading"
  | "image"
  | "text"
  | "video"
  | "button"
  | "table"
  | "table_of_contents"
  | "list"
  | "link_bio"
  | "image_box"
  | "testimonial"
  | "icon"
  | "icon_box"
  | "social_icons"
  | "image_gallery"
  | "image_carousel"
  | "icon_list"
  | "counter"
  | "progress_bar"
  | "nested_tabs"
  | "nested_accordion"
  | "rating"
  | "alert"
  | "html"
  | "shortcode"
  | "menu_anchor"
  | "read_more"
  | "sidebar"
  | "google_maps"
  | "soundcloud"
  | "divider"
  | "spacer"
  | "text_path"
  | "tags"
  // Legacy / convenience types
  | "link"
  | "cta"
  | "quote"
  | "code"
  | "container";

interface BlockItem {
  id: string;
  title: string;
  content?: string;
  url?: string;
  icon?: string;
  badge?: string;
}

interface Block {
  id: string;
  type: BlockType;
  content: string;
  title?: string;
  subtitle?: string;
  buttonText?: string;
  iconName?: string;
  badge?: string;
  value?: number | string;
  max?: number;
  suffix?: string;
  prefix?: string;
  items?: BlockItem[];
  tags?: string[];
  tagsStyle?: "pill" | "badge" | "outline" | "minimal";
  activeSlideIndex?: number;
  // Heading specific (H1 to H6)
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  // List specific (Ordered vs Unordered)
  listType?: "ordered" | "unordered";
  listStyle?: "disc" | "decimal" | "check" | "roman";
  // Table specific
  tableData?: {
    headers: string[];
    rows: string[][];
    hasHeader: boolean;
    isStriped: boolean;
  };
  // Table of Contents specific
  tocOptions?: {
    title?: string;
    maxDepth?: number;
    numbered?: boolean;
  };
  // Elementor-style Link Settings
  url?: string;
  link?: string;
  openInNewTab?: boolean;
  addNofollow?: boolean;
  linkStyle?: "primary" | "secondary" | "outline" | "inline" | "deal" | "emerald" | "gradient";
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
    opacity?: string;
    width?: string;
    maxWidth?: string;
    height?: string;
    minHeight?: string;
    margin?: string;
  };
}

interface ElementorWidget {
  type: BlockType;
  label: string;
  icon: string;
  category: "basic" | "media" | "interactive" | "advanced";
  badge?: string;
  desc: string;
}

const ELEMENTOR_WIDGETS: ElementorWidget[] = [
  // 1. Basic Content
  { type: "heading", label: "Heading (H1-H6)", icon: "title", category: "basic", desc: "Add headlines with H1 to H6 levels." },
  { type: "text", label: "Text & Live Editor", icon: "text_fields", category: "basic", desc: "Paragraph with inline formatting & hyperlinks." },
  { type: "tags", label: "Tags & Topics", icon: "label", category: "basic", badge: "New", desc: "Dynamic article tags cloud with custom pill styles & links." },
  { type: "list", label: "List (OL / UL)", icon: "format_list_bulleted", category: "basic", desc: "Ordered numbers or bulleted lists." },
  { type: "table", label: "Data Table", icon: "table_chart", category: "basic", badge: "New", desc: "Interactive grid with rows, columns & headers." },
  { type: "table_of_contents", label: "Table of Contents", icon: "toc", category: "basic", badge: "Auto", desc: "Real-time automated index of all H1-H6 headlines." },
  { type: "image", label: "Image (Resizable)", icon: "image", category: "basic", desc: "Control width, height, opacity, and links." },
  { type: "video", label: "Video", icon: "videocam", category: "basic", desc: "Add YouTube, Vimeo, or self-hosted videos." },
  { type: "button", label: "Button", icon: "smart_button", category: "basic", badge: "Link", desc: "Create interactive buttons." },
  { type: "divider", label: "Divider", icon: "horizontal_rule", category: "basic", desc: "Separate content with a designed divider." },
  { type: "spacer", label: "Spacer", icon: "unfold_more", category: "basic", desc: "Add space between elements." },
  { type: "read_more", label: "Read More", icon: "read_more", category: "basic", desc: "Set the Read More cut-off for the excerpt in archive pages." },

  // 2. Media & Visuals
  { type: "image_box", label: "Image Box", icon: "featured_video", category: "media", desc: "A box with image, headline and text." },
  { type: "image_gallery", label: "Image Gallery", icon: "grid_view", category: "media", desc: "Display your images in a grid." },
  { type: "image_carousel", label: "Image Carousel", icon: "view_carousel", category: "media", desc: "Create rotating carousels or sliders for chosen images." },
  { type: "icon", label: "Icon", icon: "sentiment_satisfied", category: "media", desc: "Place one or more of 600+ icons available." },
  { type: "icon_box", label: "Icon Box", icon: "inventory_2", category: "media", desc: "An icon, headline, and text with one widget." },
  { type: "icon_list", label: "Icon List", icon: "checklist", category: "media", desc: "Use any icon to create a bullet list." },
  { type: "social_icons", label: "Social Icons", icon: "share", category: "media", desc: "Link to your social pages with the Facebook/X (formerly Twitter) icons." },

  // 3. Interactive & Dynamics
  { type: "link_bio", label: "Link in Bio", icon: "account_circle", category: "interactive", badge: "Pro", desc: "Build link in bio components to promote your business / services." },
  { type: "counter", label: "Counter", icon: "pin", category: "interactive", badge: "Pro", desc: "Show numbers in an escalating manner." },
  { type: "progress_bar", label: "Progress Bar", icon: "linear_scale", category: "interactive", desc: "Include an escalating progress bar." },
  { type: "nested_tabs", label: "Nested Tabs", icon: "tab", category: "interactive", badge: "Pro", desc: "Display content in vertical or horizontal tabs." },
  { type: "nested_accordion", label: "Nested Accordion", icon: "expand_circle_down", category: "interactive", badge: "Pro", desc: "Display any type of content in collapsible sections." },
  { type: "rating", label: "Rating", icon: "star", category: "interactive", desc: "Display how many stars (or another icon) other visitors gave." },
  { type: "testimonial", label: "Testimonials", icon: "format_quote", category: "interactive", desc: "Customer testimonials." },
  { type: "alert", label: "Alert", icon: "notification_important", category: "interactive", desc: "Include a colored alert box to draw visitor’s attention." },

  // 4. Advanced & Embeds
  { type: "html", label: "HTML", icon: "code", category: "advanced", desc: "Insert code into the page." },
  { type: "shortcode", label: "Shortcode", icon: "integration_instructions", category: "advanced", desc: "Insert shortcodes from any plugin into the page." },
  { type: "menu_anchor", label: "Menu Anchor", icon: "anchor", category: "advanced", desc: "Link any menu to this anchor." },
  { type: "sidebar", label: "Sidebar", icon: "view_sidebar", category: "advanced", desc: "Add sidebars onto the page." },
  { type: "google_maps", label: "Google Maps", icon: "map", category: "advanced", desc: "Embed maps into the page." },
  { type: "soundcloud", label: "SoundCloud", icon: "graphic_eq", category: "advanced", desc: "Add SoundCloud audio bits." },
  { type: "text_path", label: "Text Path", icon: "gesture", category: "advanced", desc: "Attach your text to a path." },
];

const PRESET_PORTAL_LINKS = [
  { label: "Loan Application", url: "/apply", desc: "Direct loan eligibility & application form" },
  { label: "Partner Banks", url: "/banks", desc: "Compare HDFC, IDFC, Axis & SBI rates" },
  { label: "EMI Calculator", url: "/emi-calculator", desc: "Interactive loan monthly repayment calculator" },
  { label: "Blog Hub", url: "/blog", desc: "Public education loan knowledge hub" },
  { label: "Contact Advisors", url: "/contact", desc: "Connect with a dedicated student counselor" },
  { label: "Home Page", url: "/", desc: "VidyaLoan main landing page" },
];

function parseHtmlOrTextToBlocks(rawContent: string): Block[] {
  if (!rawContent || !rawContent.trim()) return [];
  const trimmed = rawContent.trim();

  // 1. Embedded JSON blocks comment
  const match = trimmed.match(/<!--BLOCKS_JSON_START-->([\s\S]*?)<!--BLOCKS_JSON_END-->/);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
  }

  // 2. Direct JSON string array
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
  }

  // 3. HTML parsing via browser DOMParser
  if (typeof window !== "undefined" && typeof window.DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(trimmed, "text/html");
      const blocks: Block[] = [];
      let idCounter = 1;

      const processElement = (el: Element) => {
        const tag = el.tagName.toLowerCase();
        const blockId = `block-${Date.now()}-${idCounter++}`;

        if (/^h[1-6]$/.test(tag)) {
          const level = parseInt(tag.charAt(1), 10) as 1 | 2 | 3 | 4 | 5 | 6;
          const fontSizes: Record<number, string> = {
            1: "32px",
            2: "26px",
            3: "22px",
            4: "18px",
            5: "16px",
            6: "14px",
          };
          const aTag = el.querySelector("a");
          blocks.push({
            id: blockId,
            type: "heading",
            level,
            content: el.textContent?.trim() || "Headline",
            url: aTag?.getAttribute("href") || undefined,
            openInNewTab: aTag?.getAttribute("target") === "_blank",
            style: {
              fontSize: fontSizes[level] || "24px",
              fontWeight: "700",
              color: "#0f172a",
              width: "100%",
              padding: "8px 0",
            },
          });
        } else if (tag === "p") {
          const text = el.innerHTML?.trim() || el.textContent?.trim() || "";
          if (text) {
            blocks.push({
              id: blockId,
              type: "text",
              content: text,
              style: {
                fontSize: "15px",
                lineHeight: "1.7",
                color: "#334155",
                width: "100%",
                padding: "6px 0",
              },
            });
          }
        } else if (tag === "ul" || tag === "ol") {
          const listType = tag === "ol" ? "ordered" : "unordered";
          const items = Array.from(el.querySelectorAll("li"))
            .map((li, idx) => ({
              id: `${blockId}-${idx + 1}`,
              title: li.innerHTML?.trim() || li.textContent?.trim() || "",
            }))
            .filter((it) => it.title);

          if (items.length > 0) {
            blocks.push({
              id: blockId,
              type: "list",
              listType,
              listStyle: tag === "ol" ? "decimal" : "disc",
              content: items.map((i) => i.title).join("\n"),
              items,
              style: {
                fontSize: "14px",
                color: "#334155",
                width: "100%",
                padding: "8px 12px",
              },
            });
          }
        } else if (tag === "table") {
          const headerCells = Array.from(
            el.querySelectorAll("thead th, thead td, tr:first-child th")
          ).map((c) => c.textContent?.trim() || "");
          const rowEls = Array.from(
            el.querySelectorAll("tbody tr, tr:not(:first-child)")
          );
          const rows = rowEls
            .map((r) =>
              Array.from(r.querySelectorAll("td, th")).map(
                (c) => c.textContent?.trim() || ""
              )
            )
            .filter((r) => r.length > 0 && r.some((c) => c.length > 0));

          blocks.push({
            id: blockId,
            type: "table",
            title: "Data Table",
            content: "Loan Comparison Matrix",
            tableData: {
              headers:
                headerCells.length > 0 ? headerCells : ["Col 1", "Col 2"],
              rows: rows.length > 0 ? rows : [["Sample A", "Sample B"]],
              hasHeader: headerCells.length > 0,
              isStriped: true,
            },
            style: { width: "100%", padding: "8px 0" },
          });
        } else if (tag === "img") {
          const img = el as HTMLImageElement;
          blocks.push({
            id: blockId,
            type: "image",
            content: img.getAttribute("src") || "",
            title: img.getAttribute("alt") || "",
            style: {
              width: "100%",
              maxWidth: "100%",
              borderRadius: "12px",
              padding: "8px 0",
            },
          });
        } else if (tag === "blockquote") {
          blocks.push({
            id: blockId,
            type: "quote",
            content: el.textContent?.trim() || "",
            style: {
              fontSize: "16px",
              color: "#475569",
              width: "100%",
              padding: "12px 16px",
            },
          });
        } else if (tag === "pre" || tag === "code") {
          blocks.push({
            id: blockId,
            type: "code",
            content: el.textContent?.trim() || "",
            style: {
              fontSize: "13px",
              color: "#1e293b",
              backgroundColor: "#f8fafc",
              width: "100%",
              padding: "12px",
            },
          });
        } else if (tag === "hr") {
          blocks.push({
            id: blockId,
            type: "divider",
            content: "",
            style: { width: "100%", padding: "12px 0" },
          });
        } else if (tag === "iframe" || tag === "video") {
          const src = el.getAttribute("src") || "";
          blocks.push({
            id: blockId,
            type: "video",
            content: src,
            style: { width: "100%", padding: "8px 0" },
          });
        } else if (tag === "div" || tag === "section" || tag === "article") {
          if (el.children.length > 0) {
            Array.from(el.children).forEach(processElement);
          } else {
            const text = el.textContent?.trim() || "";
            if (text) {
              blocks.push({
                id: blockId,
                type: "text",
                content: text,
                style: {
                  fontSize: "15px",
                  color: "#334155",
                  width: "100%",
                  padding: "6px 0",
                },
              });
            }
          }
        } else {
          const text = el.textContent?.trim() || "";
          if (text) {
            blocks.push({
              id: blockId,
              type: "text",
              content: text,
              style: {
                fontSize: "15px",
                color: "#334155",
                width: "100%",
                padding: "6px 0",
              },
            });
          }
        }
      };

      Array.from(doc.body.children).forEach(processElement);
      if (blocks.length > 0) return blocks;
    } catch (e) {
      console.warn("DOMParser failed, falling back to plain text:", e);
    }
  }

  // 4. Plain text / Markdown fallback parser
  const paragraphs = trimmed
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length > 0) {
    return paragraphs.map((par, idx) => {
      const blockId = `block-text-${Date.now()}-${idx + 1}`;
      if (par.startsWith("# ")) {
        return {
          id: blockId,
          type: "heading",
          level: 1,
          content: par.replace(/^#\s+/, ""),
          style: {
            fontSize: "32px",
            fontWeight: "800",
            color: "#0f172a",
            width: "100%",
            padding: "8px 0",
          },
        };
      }
      if (par.startsWith("## ")) {
        return {
          id: blockId,
          type: "heading",
          level: 2,
          content: par.replace(/^##\s+/, ""),
          style: {
            fontSize: "26px",
            fontWeight: "700",
            color: "#0f172a",
            width: "100%",
            padding: "8px 0",
          },
        };
      }
      if (par.startsWith("### ")) {
        return {
          id: blockId,
          type: "heading",
          level: 3,
          content: par.replace(/^###\s+/, ""),
          style: {
            fontSize: "22px",
            fontWeight: "600",
            color: "#0f172a",
            width: "100%",
            padding: "8px 0",
          },
        };
      }
      if (par.startsWith("• ") || par.startsWith("- ") || par.startsWith("* ")) {
        const items = par
          .split("\n")
          .map((line) => line.replace(/^[\s•\-\*]+/, "").trim())
          .filter(Boolean)
          .map((line, i) => ({ id: `${blockId}-${i + 1}`, title: line }));
        return {
          id: blockId,
          type: "list",
          listType: "unordered",
          content: par,
          items,
          style: {
            fontSize: "14px",
            color: "#334155",
            width: "100%",
            padding: "8px 12px",
          },
        };
      }
      return {
        id: blockId,
        type: "text",
        content: par,
        style: {
          fontSize: "15px",
          lineHeight: "1.7",
          color: "#334155",
          width: "100%",
          padding: "6px 0",
        },
      };
    });
  }

  return [];
}

export default function ITBlogsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const action = searchParams.get("action");

  const [isCreating, setIsCreating] = useState(action === "create");
  const [blogs, setBlogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Form states
  const [blogTitle, setBlogTitle] = useState("");
  const [blogSlug, setBlogSlug] = useState("");
  const [blogSubtitle, setBlogSubtitle] = useState("");
  const [blogCategory, setBlogCategory] = useState("Loan Guidance");
  const [coverImage, setCoverImage] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [saving, setSaving] = useState(false);
  const [editingBlogId, setEditingBlogId] = useState<string | null>(null);

  // Tags System States
  const [blogTags, setBlogTags] = useState<string[]>(["EducationLoan", "StudyAbroad", "FintechGuidance"]);
  const [tagInput, setTagInput] = useState("");
  const [tagsManagerOpen, setTagsManagerOpen] = useState(false);

  // Saved Selection Range for Inline Formatting & Hyperlinks
  const savedSelectionRef = React.useRef<{ range: Range | null; text: string; blockId: string | null }>({
    range: null,
    text: "",
    blockId: null,
  });
  const [editorModes, setEditorModes] = useState<Record<string, "visual" | "html">>({});

  // Hyperlink & Selected Text Formatter States
  const [hyperlinkModalOpen, setHyperlinkModalOpen] = useState(false);
  const [hyperlinkTargetBlockId, setHyperlinkTargetBlockId] = useState<string | null>(null);
  const [hyperlinkUrl, setHyperlinkUrl] = useState("");
  const [hyperlinkText, setHyperlinkText] = useState("");
  const [hyperlinkTargetBlank, setHyperlinkTargetBlank] = useState(true);

  // Dynamic Highlight Picker & Text Settings States
  const [activeHighlightPicker, setActiveHighlightPicker] = useState<string | null>(null);
  const [activeTextSettings, setActiveTextSettings] = useState<string | null>(null);

  // Link & Elementor States
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [linkInspectorOpen, setLinkInspectorOpen] = useState(false);
  const [elementorCategoryTab, setElementorCategoryTab] = useState<"all" | "basic" | "media" | "interactive" | "advanced">("all");
  const [elementorInspectorTab, setElementorInspectorTab] = useState<"content" | "style" | "advanced">("content");

  // Blog Comparison States
  const [comparing, setComparing] = useState(false);
  const [selectedBlogIdsForCompare, setSelectedBlogIdsForCompare] = useState<string[]>([]);
  const [compareBlogIdA, setCompareBlogIdA] = useState<string | null>(null);
  const [compareBlogIdB, setCompareBlogIdB] = useState<string | null>(null);
  const [compareTab, setCompareTab] = useState<"overview" | "content" | "architecture">("overview");

  // Drag and Drop & Visual Editor States
  const [draggedType, setDraggedType] = useState<BlockType | null>(null);
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Visual Builder States
  const [viewMode, setViewMode] = useState<"edit" | "preview" | "mobile">("edit");
  const [leftDockTab, setLeftDockTab] = useState<"elements" | "templates" | "uploads">("elements");
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [dockSearch, setDockSearch] = useState("");
  const [savedDraftNotice, setSavedDraftNotice] = useState<{ title: string; savedAt: string } | null>(null);

  const loadBlogs = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await blogApi.getAdminAll(1, 100).catch(() => blogApi.getAll(1, 100)).catch(() => ({ data: [] }));
      setBlogs(res.data || []);
    } catch (e) {
      console.error("Failed to load blogs:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBlogs();
  }, [loadBlogs]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("it_blog_draft_backup");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.title || parsed.blocks?.length)) {
          setSavedDraftNotice({
            title: parsed.title || "Untitled Draft",
            savedAt: parsed.savedAt ? new Date(parsed.savedAt).toLocaleTimeString() : "recently",
          });
        }
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    const editId = searchParams.get("id");
    const editSlug = searchParams.get("slug");
    if (action === "create") {
      setIsCreating(true);
    } else if (action === "edit" || editId || editSlug) {
      if (editId) {
        blogApi.getById(editId).then((res: any) => {
          if (res?.data) handleEditBlog(res.data);
        }).catch(() => {});
      } else if (editSlug) {
        blogApi.getBySlug(editSlug).then((res: any) => {
          if (res?.data) handleEditBlog(res.data);
        }).catch(() => {});
      }
    }
  }, [action, searchParams]);

  const restoreDraft = () => {
    try {
      const raw = localStorage.getItem("it_blog_draft_backup");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.title) setBlogTitle(parsed.title);
        if (parsed.slug) setBlogSlug(parsed.slug);
        if (parsed.subtitle) setBlogSubtitle(parsed.subtitle);
        if (parsed.category) setBlogCategory(parsed.category);
        if (parsed.coverImage) setCoverImage(parsed.coverImage);
        if (Array.isArray(parsed.tags)) setBlogTags(parsed.tags);
        if (Array.isArray(parsed.blocks) && parsed.blocks.length > 0) setBlocks(parsed.blocks);
        setIsCreating(true);
        setSavedDraftNotice(null);
        alert("Draft successfully restored!");
      }
    } catch (_) {
      alert("Failed to restore draft");
    }
  };

  const dismissDraft = () => {
    localStorage.removeItem("it_blog_draft_backup");
    setSavedDraftNotice(null);
  };

  const saveLocalDraftManual = () => {
    try {
      localStorage.setItem(
        "it_blog_draft_backup",
        JSON.stringify({
          title: blogTitle,
          slug: blogSlug,
          subtitle: blogSubtitle,
          category: blogCategory,
          coverImage,
          tags: blogTags,
          blocks,
          savedAt: new Date().toISOString(),
        })
      );
      setSavedDraftNotice({
        title: blogTitle || "Current Draft",
        savedAt: new Date().toLocaleTimeString(),
      });
      alert("✅ Article draft with all widgets successfully backed up to browser storage!");
    } catch (_) {
      alert("Failed to save draft locally");
    }
  };

  // Auto-generate slug from title if not manually customized
  const handleTitleChange = (val: string) => {
    setBlogTitle(val);
    if (!editingBlogId || !blogSlug) {
      setBlogSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")
      );
    }
  };

  // Parse video source helper (supports local uploaded video files, YouTube, Vimeo, direct MP4)
  const parseVideoSource = (url?: string): { type: "video" | "iframe" | "empty"; src: string } => {
    if (!url || !url.trim()) return { type: "empty", src: "" };
    const trimmed = url.trim();

    if (
      trimmed.startsWith("data:video/") ||
      trimmed.startsWith("blob:") ||
      /\.(mp4|webm|ogg|mov)(\?|$)/i.test(trimmed)
    ) {
      return { type: "video", src: trimmed };
    }

    const ytMatch = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
    if (ytMatch && ytMatch[1]) {
      return { type: "iframe", src: `https://www.youtube.com/embed/${ytMatch[1]}` };
    }

    const vimeoMatch = trimmed.match(/vimeo\.com\/(?:video\/)?([0-9]+)/i);
    if (vimeoMatch && vimeoMatch[1]) {
      return { type: "iframe", src: `https://player.vimeo.com/video/${vimeoMatch[1]}` };
    }

    return { type: "video", src: trimmed };
  };

  // Create block helper with smart defaults for all widgets
  const createBlock = (type: BlockType, customContent?: string): Block => {
    const defaults: Record<BlockType, string> = {
      heading: "Add Eye-Catching Headline",
      image: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=800",
      text: "Enter your detailed article paragraph text here. Select any text to format with bold, italic, code or insert hyperlinks.",
      video: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      button: "Check Eligibility & Apply Now",
      table: "Loan Comparison Matrix",
      table_of_contents: "In this Article",
      divider: "",
      spacer: "32px",
      read_more: "Read More Cut-Off Point",
      image_box: "Collateral-Free Overseas Loans up to ₹75L",
      image_gallery: "Campus Life & University Admissions",
      image_carousel: "Top Global Universities",
      icon: "verified_user",
      icon_box: "Compare 15+ Partner Banks",
      icon_list: "Fast-track 3-day approval turnaround\nZero collateral required up to ₹75 Lakhs\nComplete tuition, living cost & travel coverage",
      social_icons: "Connect with VidyaLoan Across Official Platforms",
      link_bio: "VidyaLoan Education Advisor",
      counter: "75",
      progress_bar: "94",
      nested_tabs: "USA Loans",
      nested_accordion: "Frequently Asked Questions",
      rating: "4.9",
      testimonial: "VidyaLoan helped me secure a ₹65 Lakh collateral-free loan within 4 business days. The counsel on moratorium interest saved me lakhs!",
      alert: "Special Fall 2026 intake processing is live with 0.50% interest concession under partner schemes.",
      html: "<div style='padding: 16px; background: #EEF2FF; border-radius: 12px; border: 1px solid #C7D2FE;'><strong style='color: #4338CA;'>Special Rate Concession Active:</strong><p style='margin: 4px 0 0; color: #4B5563; font-size: 13px;'>Apply through VidyaLoan to get 0.5% waiver on bank processing fees.</p></div>",
      shortcode: "[vidyaloan_calculator max='75' default_rate='9.25']",
      menu_anchor: "eligibility-requirements",
      sidebar: "Study Abroad Resource Hub",
      google_maps: "Harvard University, Cambridge, MA, USA",
      soundcloud: "https://soundcloud.com/example/education-loan-podcast",
      text_path: "VidyaLoan • Study Abroad • Dream Higher • ",
      tags: "iPhoneAir, PriceDrop, AmazonDeals, TechNews, DealOffer",
      link: "Click here to view full partner bank interest rate matrix",
      cta: "Explore uncollateralized student loans up to ₹75 Lakhs with instant pre-approval and 0 upfront processing fees.",
      list: "• Unsecured Loans: Up to ₹75 Lakhs without collateral\n• Competitive Interest: Starting from 9.25% p.a.\n• Moratorium Period: Course Duration + 6 months\n• Repayment Tenure: Up to 15 years",
      quote: "Our mission is ensuring no ambitious student drops out due to financial constraints.",
      code: "// Sample Bank Rate Comparison Matrix\nBank           Max Unsecured    Rate Range\nHDFC Credila   ₹75 Lakhs        9.5% - 11.25%\nIDFC FIRST     ₹50 Lakhs        9.25% - 10.75%",
      container: "",
    };

    const block: Block = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
      type,
      content: customContent !== undefined ? customContent : defaults[type] || "",
      style: {
        textAlign: "left",
        color: "#1e293b",
        backgroundColor: "transparent",
        fontSize: type === "heading" ? "26px" : "14px",
        padding: "8px",
        width: "100%",
        maxWidth: "100%",
        height: "auto",
      },
    };

    // Smart initializers for interactive & complex widgets
    switch (type) {
      case "heading":
        block.level = 2;
        block.style = {
          ...(block.style || {}),
          fontSize: "26px",
          width: "100%",
        };
        break;
      case "list":
        block.listType = "unordered";
        block.listStyle = "disc";
        block.items = [
          { id: "1", title: "Unsecured Loans: Up to ₹75 Lakhs without collateral requirement" },
          { id: "2", title: "Competitive Interest: Starting from 8.5% p.a. with tax rebate under 80E" },
          { id: "3", title: "Moratorium Period: Course Duration + 6 to 12 months grace period" },
          { id: "4", title: "100% Comprehensive Coverage: Tuition, living costs, and flight tickets" },
        ];
        break;
      case "table":
        block.title = "Loan Comparison Matrix";
        block.tableData = {
          headers: ["Bank / Partner Lender", "Max Collateral-Free", "Interest Rate", "Processing Speed"],
          rows: [
            ["HDFC Credila", "Up to ₹75 Lakhs", "9.50% - 11.25%", "3 Business Days"],
            ["IDFC FIRST Bank", "Up to ₹50 Lakhs", "9.25% - 10.50%", "48 Hours Fast-Track"],
            ["State Bank of India (SBI)", "Up to ₹50 Lakhs", "8.15% - 9.15%", "7-10 Business Days"],
            ["ICICI Bank", "Up to ₹50 Lakhs", "9.75% - 11.50%", "3-4 Business Days"],
          ],
          hasHeader: true,
          isStriped: true,
        };
        block.style = {
          ...(block.style || {}),
          width: "100%",
          padding: "8px",
        };
        break;
      case "table_of_contents":
        block.title = "Table of Contents";
        block.tocOptions = {
          title: "Table of Contents",
          maxDepth: 6,
          numbered: true,
        };
        block.style = {
          ...(block.style || {}),
          width: "100%",
          padding: "8px",
        };
        break;
      case "button":
        block.url = "/apply";
        block.openInNewTab = true;
        break;
      case "link":
        block.url = "/apply";
        block.openInNewTab = true;
        break;
      case "cta":
        block.title = "Ready to Fund Your Studies Abroad?";
        block.buttonText = "Calculate Your Loan EMI & Apply";
        block.url = "/emi-calculator";
        block.openInNewTab = true;
        break;
      case "alert":
        block.title = "Important Notice";
        break;
      case "image_box":
        block.title = "Collateral-Free Overseas Loans";
        block.content = "Access up to ₹75 Lakhs without submitting physical property collateral. Fast approval in 72 hours.";
        block.url = "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=600";
        break;
      case "testimonial":
        block.title = "Aarav Sharma";
        block.subtitle = "MS in Computer Science, Columbia University";
        block.value = "5";
        block.url = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200";
        break;
      case "icon":
        block.iconName = "verified_user";
        block.title = "100% RBI & Bank Verified Partner";
        break;
      case "icon_box":
        block.iconName = "account_balance";
        block.title = "Compare 15+ Partner Banks";
        block.content = "Compare pre-negotiated interest rates from SBI, HDFC Credila, Axis, and ICICI.";
        block.url = "/banks";
        break;
      case "social_icons":
        block.items = [
          { id: "1", title: "Facebook", icon: "facebook", url: "https://facebook.com" },
          { id: "2", title: "X (Twitter)", icon: "chat", url: "https://twitter.com" },
          { id: "3", title: "LinkedIn", icon: "work", url: "https://linkedin.com" },
          { id: "4", title: "YouTube", icon: "smart_display", url: "https://youtube.com" },
        ];
        break;
      case "image_gallery":
        block.items = [
          { id: "1", title: "Campus Grounds", url: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=400" },
          { id: "2", title: "Graduation Hall", url: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=400" },
          { id: "3", title: "Student Library", url: "https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?q=80&w=400" },
        ];
        break;
      case "image_carousel":
        block.items = [
          { id: "1", title: "Harvard University", content: "Rank #1 Global • ₹80L+ Sanctions", url: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=800" },
          { id: "2", title: "Oxford University", content: "Top UK Destination • 0 Margin Money", url: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=800" },
        ];
        break;
      case "icon_list":
        block.items = [
          { id: "1", title: "Fast-track 3-day approval turnaround", icon: "check_circle" },
          { id: "2", title: "Zero collateral required up to ₹75 Lakhs", icon: "check_circle" },
          { id: "3", title: "Complete tuition, living cost & travel insurance coverage", icon: "check_circle" },
        ];
        break;
      case "counter":
        block.title = "Maximum Collateral-Free Sanction";
        block.value = "75";
        block.prefix = "₹";
        block.suffix = " Lakhs";
        break;
      case "progress_bar":
        block.title = "Loan Approval Success Rate";
        block.value = 94;
        block.suffix = "%";
        break;
      case "nested_tabs":
        block.title = "Destination Study Loan Breakdown";
        block.items = [
          { id: "tab1", title: "USA (F-1)", content: "Covers I-20 financial requirements, STEM OPT grace period, and up to ₹75L unsecured." },
          { id: "tab2", title: "UK (CAS)", content: "Meets UKVI living cost rules and visa financial threshold with 0 margin money." },
          { id: "tab3", title: "Canada (SDS)", content: "Supports SDS GIC account transfer, full tuition deposit sanction, and flexible moratorium." },
        ];
        break;
      case "nested_accordion":
        block.title = "Frequently Asked Questions";
        block.items = [
          { id: "acc1", title: "What is the minimum CIBIL score required?", content: "Most partner banks require a co-applicant CIBIL score of 685+ for collateral-free education loans." },
          { id: "acc2", title: "When does loan repayment start?", content: "Repayment begins after the moratorium period: Course duration + 6 to 12 months after graduation." },
          { id: "acc3", title: "Can living expenses be included in the loan?", content: "Yes, our partner banks cover 100% of costs including tuition, accommodation, books, and airfare." },
        ];
        break;
      case "rating":
        block.title = "4.9 / 5 Rating from 12,400+ Students";
        block.value = "4.9";
        block.subtitle = "Verified reviews on Google & Trustpilot";
        break;
      case "link_bio":
        block.title = "VidyaLoan Education Advisor";
        block.subtitle = "Guiding 50,000+ Students to Fund Their Studies Abroad";
        block.items = [
          { id: "1", title: "Apply for Study Abroad Loan", url: "/apply", badge: "Instant" },
          { id: "2", title: "Compare 15+ Partner Bank Rates", url: "/banks", badge: "Compare" },
          { id: "3", title: "Free EMI Repayment Calculator", url: "/emi-calculator", badge: "Tool" },
          { id: "4", title: "Talk to a Loan Specialist", url: "/contact", badge: "Free" },
        ];
        break;
      case "menu_anchor":
        block.title = "#eligibility-requirements";
        block.content = "eligibility-requirements";
        break;
      case "sidebar":
        block.title = "Student Advisor Resource Kit";
        block.content = "Instant loan pre-sanction, document checklist, and repayment guide.";
        break;
      case "google_maps":
        block.title = "University Campus Location";
        block.content = "Harvard University, Cambridge, MA, USA";
        break;
      case "soundcloud":
        block.title = "Episode #14: How to Negotiate Lower Student Loan Interest";
        block.content = "https://soundcloud.com/example/education-loan-podcast";
        break;
      case "text_path":
        block.title = "VidyaLoan • Study Abroad • Dream Higher • ";
        block.content = "Curved Typography Banner";
        break;
      case "spacer":
        block.value = "32";
        break;
      default:
        break;
    }

    return block;
  };

  const updateBlockStyle = (id: string, styleUpdates: Partial<NonNullable<Block["style"]>>) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, style: { ...(b.style || {}), ...styleUpdates } } : b))
    );
  };

  const updateBlockData = (id: string, updates: Partial<Block>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  };

  // Helper functions for Dynamic #Tags System
  const addTag = (tagToAdd: string) => {
    const clean = tagToAdd.trim().replace(/^#+/, "").replace(/[^a-zA-Z0-9_\-]/g, "");
    if (!clean) return;
    if (!blogTags.includes(clean)) {
      setBlogTags((prev) => [...prev, clean]);
    }
    setTagInput("");
  };

  const removeTag = (tagToRemove: string) => {
    setBlogTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  const addBlockTag = (blockId: string, tagToAdd: string) => {
    const clean = tagToAdd.trim().replace(/^#+/, "").replace(/[^a-zA-Z0-9_\-]/g, "");
    if (!clean) return;
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        const curTags = b.tags || [];
        if (!curTags.includes(clean)) {
          return { ...b, tags: [...curTags, clean] };
        }
        return b;
      })
    );
    if (!blogTags.includes(clean)) {
      setBlogTags((prev) => [...prev, clean]);
    }
  };

  const removeBlockTag = (blockId: string, tagToRemove: string) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        return { ...b, tags: (b.tags || []).filter((t) => t !== tagToRemove) };
      })
    );
  };

  // Helper functions for Table Widget
  const addTableRow = (blockId: string) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        const currentData = b.tableData || {
          headers: ["Header 1", "Header 2", "Header 3"],
          rows: [["Cell 1", "Cell 2", "Cell 3"]],
          hasHeader: true,
          isStriped: true,
        };
        const colCount = Math.max(currentData.headers.length, currentData.rows[0]?.length || 3);
        const newRow = Array(colCount).fill("New Data");
        return {
          ...b,
          tableData: {
            ...currentData,
            rows: [...currentData.rows, newRow],
          },
        };
      })
    );
  };

  const deleteTableRow = (blockId: string, rowIndex?: number) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId || !b.tableData) return b;
        if (b.tableData.rows.length <= 1) return b;
        const targetIndex = rowIndex !== undefined ? rowIndex : b.tableData.rows.length - 1;
        const newRows = b.tableData.rows.filter((_, i) => i !== targetIndex);
        return {
          ...b,
          tableData: {
            ...b.tableData,
            rows: newRows,
          },
        };
      })
    );
  };

  const addTableColumn = (blockId: string) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        const currentData = b.tableData || {
          headers: ["Header 1", "Header 2"],
          rows: [["Cell 1", "Cell 2"]],
          hasHeader: true,
          isStriped: true,
        };
        const newColNumber = currentData.headers.length + 1;
        const newHeaders = [...currentData.headers, `Col ${newColNumber}`];
        const newRows = currentData.rows.map((row) => [...row, "Cell"]);
        return {
          ...b,
          tableData: {
            ...currentData,
            headers: newHeaders,
            rows: newRows,
          },
        };
      })
    );
  };

  const deleteTableColumn = (blockId: string, colIndex?: number) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId || !b.tableData) return b;
        if (b.tableData.headers.length <= 1) return b;
        const targetCol = colIndex !== undefined ? colIndex : b.tableData.headers.length - 1;
        const newHeaders = b.tableData.headers.filter((_, i) => i !== targetCol);
        const newRows = b.tableData.rows.map((row) => row.filter((_, i) => i !== targetCol));
        return {
          ...b,
          tableData: {
            ...b.tableData,
            headers: newHeaders,
            rows: newRows,
          },
        };
      })
    );
  };

  const updateTableCell = (blockId: string, rowIndex: number, colIndex: number, val: string) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId || !b.tableData) return b;
        const newRows = b.tableData.rows.map((row, rIdx) => {
          if (rIdx !== rowIndex) return row;
          const updatedRow = [...row];
          updatedRow[colIndex] = val;
          return updatedRow;
        });
        return {
          ...b,
          tableData: {
            ...b.tableData,
            rows: newRows,
          },
        };
      })
    );
  };

  const updateTableHeader = (blockId: string, colIndex: number, val: string) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId || !b.tableData) return b;
        const newHeaders = [...b.tableData.headers];
        newHeaders[colIndex] = val;
        return {
          ...b,
          tableData: {
            ...b.tableData,
            headers: newHeaders,
          },
        };
      })
    );
  };

  const toggleTableHeader = (blockId: string) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId || !b.tableData) return b;
        return {
          ...b,
          tableData: {
            ...b.tableData,
            hasHeader: !b.tableData.hasHeader,
          },
        };
      })
    );
  };

  const toggleTableStriped = (blockId: string) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId || !b.tableData) return b;
        return {
          ...b,
          tableData: {
            ...b.tableData,
            isStriped: !b.tableData.isStriped,
          },
        };
      })
    );
  };

  // Helper functions for List Widget (Ordered / Unordered)
  const toggleListType = (blockId: string) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        const nextType = (b.listType || "unordered") === "ordered" ? "unordered" : "ordered";
        return { ...b, listType: nextType };
      })
    );
  };

  const addListItem = (blockId: string) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        const currentItems = b.items || [];
        const newItem: BlockItem = {
          id: Date.now().toString(),
          title: "New bullet point item",
        };
        return { ...b, items: [...currentItems, newItem] };
      })
    );
  };

  const removeListItem = (blockId: string, itemIdxOrId: string | number) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        const currentItems = b.items || [];
        return {
          ...b,
          items: currentItems.filter((it, idx) =>
            typeof itemIdxOrId === "number" ? idx !== itemIdxOrId : it.id !== itemIdxOrId
          ),
        };
      })
    );
  };

  const updateListItem = (blockId: string, itemIdxOrId: string | number, title: string) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        const currentItems = b.items || [];
        return {
          ...b,
          items: currentItems.map((it, idx) =>
            (typeof itemIdxOrId === "number" ? idx === itemIdxOrId : it.id === itemIdxOrId)
              ? { ...it, title }
              : it
          ),
        };
      })
    );
  };

  const deleteBlock = (blockId: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== blockId));
    if (selectedBlockId === blockId) {
      setSelectedBlockId(null);
    }
  };

  // Box Dimensions update helper
  const updateBlockDimensions = (
    blockId: string,
    updates: {
      width?: string;
      maxWidth?: string;
      height?: string;
      minHeight?: string;
      textAlign?: "left" | "center" | "right" | "justify";
      margin?: string;
    }
  ) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        const newStyle = { ...(b.style || {}), ...updates };
        if (updates.textAlign === "center") {
          newStyle.margin = "0 auto";
        } else if (updates.textAlign === "right") {
          newStyle.margin = "0 0 0 auto";
        } else if (updates.textAlign === "left") {
          newStyle.margin = "0 auto 0 0";
        }
        return { ...b, style: newStyle };
      })
    );
  };

  // Real-time Text Selection & Professional Formatting Helpers
  const handleTextSelectionChange = (blockId: string) => {
    if (typeof window === "undefined") return;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      const text = sel.toString().trim();
      savedSelectionRef.current = {
        range: sel.getRangeAt(0).cloneRange(),
        text,
        blockId,
      };
    }
  };

  const openHyperlinkDialog = (blockId: string, initialText?: string, initialUrl?: string) => {
    let textToUse = initialText || "";
    if (typeof window !== "undefined") {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().trim()) {
        textToUse = sel.toString().trim();
        savedSelectionRef.current = {
          range: sel.getRangeAt(0).cloneRange(),
          text: textToUse,
          blockId,
        };
      }
    }
    setHyperlinkTargetBlockId(blockId);
    setHyperlinkText(textToUse);
    setHyperlinkUrl(initialUrl || "https://");
    setHyperlinkTargetBlank(true);
    setHyperlinkModalOpen(true);
  };

  const applyHyperlink = () => {
    if (!hyperlinkTargetBlockId) return;
    const targetUrl = hyperlinkUrl.trim() || "/apply";
    const displayText = hyperlinkText.trim() || targetUrl;

    const saved = savedSelectionRef.current;
    if (saved && saved.range && saved.blockId === hyperlinkTargetBlockId && typeof window !== "undefined") {
      try {
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(saved.range);

          const a = document.createElement("a");
          a.href = targetUrl;
          if (hyperlinkTargetBlank) {
            a.target = "_blank";
            a.rel = "noopener noreferrer";
          }
          a.style.color = "#4f46e5";
          a.style.fontWeight = "700";
          a.style.textDecoration = "underline";
          a.textContent = displayText;

          saved.range.deleteContents();
          saved.range.insertNode(a);

          const el = document.getElementById(`editor-${hyperlinkTargetBlockId}`);
          if (el) {
            updateBlockContent(hyperlinkTargetBlockId, el.innerHTML);
            setHyperlinkModalOpen(false);
            savedSelectionRef.current = { range: null, text: "", blockId: null };
            return;
          }
        }
      } catch (err) {
        console.warn("DOM selection replacement fallback:", err);
      }
    }

    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== hyperlinkTargetBlockId) return b;
        const updated = {
          ...b,
          url: targetUrl,
          link: targetUrl,
          openInNewTab: hyperlinkTargetBlank,
        };
        const linkHtml = `<a href="${targetUrl}" ${
          hyperlinkTargetBlank ? 'target="_blank" rel="noopener noreferrer"' : ""
        } style="color: #4f46e5; font-weight: 700; text-decoration: underline;">${displayText}</a>`;

        if (b.type === "link" || b.type === "button") {
          updated.content = displayText;
        } else if (b.type === "text") {
          if (b.content.includes(displayText)) {
            updated.content = b.content.replace(displayText, linkHtml);
          } else {
            updated.content = `${b.content} ${linkHtml}`;
          }
        }
        return updated;
      })
    );

    setHyperlinkModalOpen(false);
    savedSelectionRef.current = { range: null, text: "", blockId: null };
  };

  const HIGHLIGHT_SWATCHES = [
    { name: "Yellow", bg: "#fef08a", text: "#854d0e", border: "#fde047" },
    { name: "Mint", bg: "#bbf7d0", text: "#14532d", border: "#86efac" },
    { name: "Sky", bg: "#bae6fd", text: "#0369a1", border: "#7dd3fc" },
    { name: "Pink", bg: "#fbcfe8", text: "#9d174d", border: "#f472b6" },
    { name: "Purple", bg: "#e9d5ff", text: "#6b21a8", border: "#d8b4fe" },
    { name: "Orange", bg: "#fed7aa", text: "#9a3412", border: "#fdba74" },
  ];

  const applyHighlight = (
    blockId: string,
    bg: string = "#fef08a",
    textColor: string = "#854d0e"
  ) => {
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
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
          const isSameColor =
            existingMark.style.backgroundColor === bg ||
            existingMark.getAttribute("data-color") === bg;
          if (isSameColor) {
            // Toggle off highlight
            const textNode = document.createTextNode(existingMark.textContent || "");
            existingMark.parentNode?.replaceChild(textNode, existingMark);
          } else {
            // Update color
            existingMark.style.backgroundColor = bg;
            existingMark.style.color = textColor;
            existingMark.setAttribute("data-color", bg);
          }
        } else {
          const mark = document.createElement("mark");
          mark.style.backgroundColor = bg;
          mark.style.color = textColor;
          mark.style.padding = "2px 6px";
          mark.style.borderRadius = "4px";
          mark.style.fontWeight = "600";
          mark.setAttribute("data-color", bg);

          try {
            range.surroundContents(mark);
          } catch {
            const fragment = range.extractContents();
            mark.appendChild(fragment);
            range.insertNode(mark);
          }
        }

        // Collapse selection so it doesn't remain trapped in blue browser selection
        sel.collapseToEnd();
      } catch (err) {
        console.warn("Highlight fallback", err);
        try {
          document.execCommand("hiliteColor", false, bg);
        } catch (_) {}
        sel?.collapseToEnd();
      }

      const el = document.getElementById(`editor-${blockId}`);
      if (el) {
        updateBlockContent(blockId, el.innerHTML);
      }
    } else {
      // Fallback: toggle full block highlight
      setBlocks((prev) =>
        prev.map((b) => {
          if (b.id !== blockId) return b;
          const text = b.content || "";
          if (text.includes("<mark")) {
            return {
              ...b,
              content: text.replace(/<mark[^>]*>([\s\S]*?)<\/mark>/gi, "$1"),
            };
          }
          return {
            ...b,
            content: `<mark style="background-color: ${bg}; color: ${textColor}; padding: 2px 6px; border-radius: 4px; font-weight: 600;">${text}</mark>`,
          };
        })
      );
    }

    // Always immediately close highlight picker
    setActiveHighlightPicker(null);
  };

  const removeHighlight = (blockId: string) => {
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
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
      } catch (_) {
        try {
          document.execCommand("hiliteColor", false, "transparent");
        } catch {}
        sel?.collapseToEnd();
      }

      const el = document.getElementById(`editor-${blockId}`);
      if (el) {
        updateBlockContent(blockId, el.innerHTML);
      }
    } else {
      setBlocks((prev) =>
        prev.map((b) => {
          if (b.id !== blockId) return b;
          return {
            ...b,
            content: (b.content || "").replace(/<mark[^>]*>([\s\S]*?)<\/mark>/gi, "$1"),
          };
        })
      );
    }

    // Always immediately close highlight picker
    setActiveHighlightPicker(null);
  };

  const applyTextPreset = (
    blockId: string,
    preset: "body" | "lead" | "editorial" | "tip" | "alert" | "card" | "footnote"
  ) => {
    let newStyle: Partial<Block["style"]> = {};

    switch (preset) {
      case "body":
        newStyle = {
          fontSize: "15px",
          lineHeight: "1.7",
          fontFamily: "inherit",
          color: "#1e293b",
          backgroundColor: "transparent",
          padding: "0px",
          borderRadius: "0px",
          textAlign: "left",
        };
        break;
      case "lead":
        newStyle = {
          fontSize: "19px",
          lineHeight: "1.75",
          fontFamily: "inherit",
          color: "#0f172a",
          fontWeight: "500",
          backgroundColor: "transparent",
          padding: "0px",
          borderRadius: "0px",
          textAlign: "left",
        };
        break;
      case "editorial":
        newStyle = {
          fontSize: "17px",
          lineHeight: "1.8",
          fontFamily: "'Merriweather', 'Georgia', serif",
          color: "#1e293b",
          backgroundColor: "transparent",
          padding: "0px",
          borderRadius: "0px",
          textAlign: "left",
        };
        break;
      case "tip":
        newStyle = {
          fontSize: "15px",
          lineHeight: "1.65",
          fontFamily: "inherit",
          color: "#064e3b",
          backgroundColor: "#f0fdf4",
          padding: "16px 20px",
          borderRadius: "0 12px 12px 0",
          textAlign: "left",
        };
        break;
      case "alert":
        newStyle = {
          fontSize: "15px",
          lineHeight: "1.65",
          fontFamily: "inherit",
          color: "#78350f",
          backgroundColor: "#fffbeb",
          padding: "16px 20px",
          borderRadius: "0 12px 12px 0",
          textAlign: "left",
        };
        break;
      case "card":
        newStyle = {
          fontSize: "15px",
          lineHeight: "1.65",
          fontFamily: "inherit",
          color: "#334155",
          backgroundColor: "#f8fafc",
          padding: "18px 20px",
          borderRadius: "14px",
          textAlign: "left",
        };
        break;
      case "footnote":
        newStyle = {
          fontSize: "12px",
          lineHeight: "1.5",
          fontFamily: "inherit",
          color: "#64748b",
          backgroundColor: "transparent",
          padding: "4px 0",
          borderRadius: "0px",
          textAlign: "left",
        };
        break;
    }

    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        return {
          ...b,
          style: {
            ...b.style,
            ...newStyle,
          },
        };
      })
    );
  };

  const applyFormatToSelection = (
    blockId: string,
    format: "bold" | "italic" | "underline" | "code" | "highlight" | "strike"
  ) => {
    if (format === "highlight") {
      applyHighlight(blockId);
      return;
    }

    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      if (format === "bold") {
        document.execCommand("bold", false);
      } else if (format === "italic") {
        document.execCommand("italic", false);
      } else if (format === "underline") {
        document.execCommand("underline", false);
      } else if (format === "strike") {
        document.execCommand("strikeThrough", false);
      } else if (format === "code") {
        try {
          const range = sel.getRangeAt(0);
          const codeEl = document.createElement("code");
          codeEl.style.backgroundColor = "#f1f5f9";
          codeEl.style.color = "#0f766e";
          codeEl.style.padding = "2px 5px";
          codeEl.style.borderRadius = "4px";
          codeEl.style.fontFamily = "monospace";
          codeEl.style.fontSize = "0.9em";
          range.surroundContents(codeEl);
        } catch (_) {}
      }

      const el = document.getElementById(`editor-${blockId}`);
      if (el) {
        updateBlockContent(blockId, el.innerHTML);
      }
      return;
    }

    // Fallback: format full block content
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        const text = b.content || "";
        if (!text) return b;
        let newContent = text;
        if (format === "bold") newContent = `<strong>${text}</strong>`;
        else if (format === "italic") newContent = `<em>${text}</em>`;
        else if (format === "underline") newContent = `<u>${text}</u>`;
        else if (format === "strike") newContent = `<s>${text}</s>`;
        else if (format === "code")
          newContent = `<code style="background:#f1f5f9;color:#0f766e;padding:2px 5px;border-radius:4px;font-family:monospace;">${text}</code>`;
        return { ...b, content: newContent };
      })
    );
  };

  const copyToClipboard = async (text: string, label: string = "Link") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLink(label);
      setTimeout(() => setCopiedLink(null), 2400);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopiedLink(label);
      setTimeout(() => setCopiedLink(null), 2400);
    }
  };

  const applyTemplate = (templateKey: string) => {
    let tBlocks: Block[] = [];
    if (templateKey === "education_guide") {
      tBlocks = [
        createBlock("heading", "Complete Guide to Education Loans for Abroad Studies (2026)"),
        createBlock(
          "text",
          "Securing an education loan is one of the most critical steps when planning to study abroad. This comprehensive guide breaks down interest rates, top bank offerings, collateral requirements, and step-by-step application tips to get approved fast."
        ),
        createBlock("image", "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1200"),
        createBlock("alert", "Special 2026 Fall intake loan sanction processing is currently open with expedited 3-day approvals."),
        createBlock("heading", "Key Highlights & Eligibility Checklist"),
        createBlock(
          "list",
          "• Unsecured Loans: Available up to ₹75 Lakhs without collateral\n• Interest Rates: Competitive rates starting from 9.5% p.a.\n• Moratorium Grace: Course duration + 6 to 12 months moratorium\n• Flexible Repayment: Tenure options extending up to 15 years"
        ),
        createBlock(
          "quote",
          "Pro Tip: Applying with a financial co-applicant (father/mother) with a stable income significantly boosts your loan approval speed and gets you lower interest rates."
        ),
        createBlock("divider", ""),
        {
          ...createBlock("cta", "Compare customized offers from 15+ partner banks and secure your sanction letter within 72 hours."),
          title: "Get Sanctioned Before Visa Appointment",
          buttonText: "Start Free Eligibility Check →",
          url: "/apply",
          openInNewTab: true,
        },
      ];
    } else if (templateKey === "bank_review") {
      tBlocks = [
        createBlock("heading", "HDFC Credila vs. IDFC FIRST Bank: Detailed Comparison"),
        createBlock(
          "text",
          "Choosing between a dedicated NBFC like HDFC Credila and a premier private bank like IDFC FIRST Bank depends on your university tier, loan amount, and collateral status."
        ),
        createBlock("image", "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?q=80&w=1200"),
        createBlock("heading", "Feature Breakdown"),
        createBlock(
          "code",
          "// HDFC Credila vs IDFC First Comparison Matrix\nFeature             HDFC Credila       IDFC First\nMax Unsecured Loan  ₹75 Lakhs          ₹50 Lakhs\nProcessing Fee      1.0% - 1.5%        1.0%\nApproval Speed      3-5 Days           4-7 Days\nMoratorium Grace    Yes                Yes"
        ),
        createBlock("link", "Explore complete bank rate comparison matrix and partner discounts"),
        createBlock("button", "Apply With Partner Rate Discount"),
      ];
    } else if (templateKey === "iphone_deal") {
      setBlogTitle("Apple iPhone Air price drops by over Rs 30,000 after recent price hike: Check platform and deal");
      setBlogSubtitle("Following official price hikes in India, Amazon has rolled out limited-time massive discounts of nearly ₹50,000 off revised retail prices.");
      setBlogCategory("Tech Deals");
      setCoverImage("https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?q=80&w=1200");
      setBlogTags(["iPhoneAir", "AppleIndia", "AmazonDeals", "PriceDrop", "FestiveSale", "Smartphones"]);
      tBlocks = [
        createBlock("table_of_contents"),
        createBlock("alert", "Limited-Time Flash Deal: Amazon India has dropped prices by over ₹30,000 below original launch levels with instant bank card discounts while stocks last."),
        createBlock("heading", "Apple iPhone Air: Price Drop & Deal Breakdown"),
        createBlock(
          "text",
          "Following the launch of Apple's latest generation flagship devices, retail prices in India saw sharp revisions. The <strong>iPhone Air</strong>, which saw one of the steepest hikes, had its official retail price raised by <strong>Rs 30,000</strong>, reaching <strong>Rs 1,49,900</strong> for the base variant. However, in a surprising festive concession, e-commerce giant <mark style=\"background-color: #fef08a; color: #854d0e; padding: 2px 6px; border-radius: 4px; font-weight: 600;\">Amazon has dropped the price by over Rs 30,000</mark>, bringing the net deal price to just <strong>Rs 99,990</strong>!"
        ),
        createBlock("image", "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?q=80&w=1200"),
        createBlock("heading", "Official MRP vs. Amazon Deal Price Comparison"),
        {
          ...createBlock("table"),
          tableData: {
            headers: ["Platform / Offer Type", "Official Listed MRP", "Deal Effective Price", "Total Savings"],
            rows: [
              ["Official Apple Store India", "₹1,49,900", "₹1,49,900", "Standard Official MRP"],
              ["Amazon India Flash Deal", "₹1,49,900", "₹99,990", "₹49,910 Flat Price Drop"],
              ["Select Bank Credit Cards", "₹99,990", "₹96,990", "Extra ₹3,000 Instant Off"],
              ["Old Device Trade-In (Max)", "₹96,990", "Up to ₹63,790", "Up to ₹33,200 Exchange Value"],
            ],
            hasHeader: true,
            isStriped: true,
          }
        },
        createBlock("heading", "Why Did the Price Spike & What Prompted the Discount?"),
        createBlock(
          "text",
          "The initial price surge was driven by rising global component costs, especially high-bandwidth memory chips and camera optics, compounded by import duties. Nevertheless, strong festive competition between Amazon and Flipkart has motivated aggressive promotional subsidies to retain premium smartphone buyers."
        ),
        {
          ...createBlock("icon_list"),
          title: "Key Deal Takeaways & Buying Advice",
          items: [
            { id: "1", title: "Flat price reduction of nearly ₹50,000 below revised retail MRP on Amazon", icon: "check_circle" },
            { id: "2", title: "Additional ₹3,000 instant discount on select HDFC, ICICI & SBI cards", icon: "credit_card" },
            { id: "3", title: "Exchange trade-in bonuses available up to ₹33,200 for eligible phones", icon: "swap_horiz" },
            { id: "4", title: "No-cost EMI plans available for up to 12 months with ₹0 down payment", icon: "payments" },
          ]
        },
        {
          ...createBlock("cta", "E-commerce platform inventory fluctuates rapidly during flash promotions. Secure your order before pricing reverts to standard retail rates."),
          title: "Ready to Claim the iPhone Air Deal?",
          buttonText: "Check Live Deal on Amazon ↗",
          url: "https://www.amazon.in",
          openInNewTab: true,
        },
        {
          ...createBlock("sidebar"),
          title: "Study Abroad Tech & Device Financing",
          content: "Heading abroad for your degree? VidyaLoan provides zero-collateral student technology grants and living allowance financing.",
        },
        {
          ...createBlock("tags"),
          title: "Article Tags & Topics",
          tags: ["iPhoneAir", "AppleIndia", "AmazonDeals", "PriceDrop", "FestiveSale", "Smartphones2026"],
        }
      ];
    } else if (templateKey === "visa_checklist") {
      tBlocks = [
        createBlock("heading", "F-1 Student Visa Interview Preparation & Mandatory Checklist"),
        createBlock(
          "text",
          "Passing your US F-1 student visa interview requires clean documentation and confidence. Ensure you carry original physical copies of every document below."
        ),
        createBlock(
          "list",
          "1. Valid Passport (Minimum 6 months validity)\n2. Form I-20 and SEVIS Fee (I-901) Payment Receipt\n3. Official Bank Loan Sanction Letter\n4. DS-160 Confirmation Page & Interview Appointment Confirmation\n5. Academic Transcripts & Standardized Test Scores (GRE/TOEFL)"
        ),
        createBlock("alert", "Consular Officers prioritize clear evidence of financial capability to cover Year 1 tuition & living expenses."),
        createBlock("button", "Download Printable Checklist PDF"),
      ];
    }
    setBlocks(tBlocks);
    if (tBlocks.length > 0) setSelectedBlockId(tBlocks[0].id);
  };

  // Drag-and-drop handlers
  const handlePaletteDragStart = (e: React.DragEvent, type: BlockType) => {
    setDraggedType(type);
    e.dataTransfer.effectAllowed = "copy";
  };

  const handlePaletteDragEnd = () => {
    setDraggedType(null);
    setDragOverIndex(null);
  };

  const handleBlockDragStart = (e: React.DragEvent, blockId: string) => {
    setDraggingBlockId(blockId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleBlockDragEnd = () => {
    setDraggingBlockId(null);
    setDragOverIndex(null);
  };

  const handleCanvasDragOver = (e: React.DragEvent, index?: number) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) {
      setIsDraggingFile(true);
    }
    e.dataTransfer.dropEffect = draggedType ? "copy" : "move";
    setDragOverIndex(index !== undefined ? index : blocks.length);
  };

  const handleCanvasDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
  };

  const handleCanvasDrop = (e: React.DragEvent, index?: number) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const dropIndex = index !== undefined ? index : blocks.length;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      const mediaFiles = files.filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
      if (mediaFiles.length > 0) {
        mediaFiles.forEach((file, i) => {
          const isVideo = file.type.startsWith("video/");
          if (isVideo && file.size > 50 * 1024 * 1024) {
            alert("Video file exceeds 50MB. For larger videos, please paste a YouTube or Vimeo link.");
            return;
          }
          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            if (dataUrl) {
              const newBlock = createBlock(isVideo ? "video" : "image", dataUrl);
              setBlocks((prev) => {
                const next = [...prev];
                next.splice(dropIndex + i, 0, newBlock);
                return next;
              });
            }
          };
          reader.readAsDataURL(file);
        });
        setDraggedType(null);
        setDraggingBlockId(null);
        setDragOverIndex(null);
        return;
      }
    }

    if (draggedType) {
      const newBlock = createBlock(draggedType);
      const newBlocks = [...blocks];
      newBlocks.splice(dropIndex, 0, newBlock);
      setBlocks(newBlocks);
      setSelectedBlockId(newBlock.id);
    } else if (draggingBlockId) {
      const fromIndex = blocks.findIndex((b) => b.id === draggingBlockId);
      if (fromIndex !== -1 && fromIndex !== dropIndex) {
        const newBlocks = [...blocks];
        const [removed] = newBlocks.splice(fromIndex, 1);
        const adjustedIndex = dropIndex > fromIndex ? dropIndex - 1 : dropIndex;
        newBlocks.splice(adjustedIndex, 0, removed);
        setBlocks(newBlocks);
      }
    }

    setDraggedType(null);
    setDraggingBlockId(null);
    setDragOverIndex(null);
  };

  const addBlock = (type: BlockType) => {
    const newBlock = createBlock(type);
    setBlocks((prev) => [...prev, newBlock]);
    setSelectedBlockId(newBlock.id);
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const duplicateBlock = (id: string) => {
    const index = blocks.findIndex((b) => b.id === id);
    if (index !== -1) {
      const blockToDup = blocks[index];
      const duplicated: Block = {
        ...blockToDup,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
      };
      const newBlocks = [...blocks];
      newBlocks.splice(index + 1, 0, duplicated);
      setBlocks(newBlocks);
      setSelectedBlockId(duplicated.id);
    }
  };

  const updateBlockContent = (id: string, content: string) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, content } : b)));
  };

  const handleSaveBlog = async (publishStatus: boolean = false) => {
    if (!blogTitle.trim()) {
      alert("Please enter a blog title.");
      return;
    }

    setSaving(true);
    try {
      const finalSlug =
        blogSlug.trim() ||
        blogTitle
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");

      const payload = {
        title: blogTitle,
        slug: finalSlug,
        subtitle: blogSubtitle,
        category: blogCategory,
        coverImage,
        blocks,
        tags: blogTags,
        published: publishStatus,
        authorName: user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : "IT Staff",
      };

      if (editingBlogId) {
        await blogApi.update(editingBlogId, payload);
        alert("Blog article updated successfully!");
      } else {
        await blogApi.create(payload);
        alert("Blog article created successfully!");
      }

      // Clear local backup on successful server save
      localStorage.removeItem("it_blog_draft_backup");
      setSavedDraftNotice(null);

      setBlogTitle("");
      setBlogSlug("");
      setBlogSubtitle("");
      setCoverImage("");
      setBlocks([]);
      setBlogTags(["EducationLoan", "StudyAbroad", "FintechGuidance"]);
      setEditingBlogId(null);
      handleBackToList();
      loadBlogs();
    } catch (e: any) {
      // Safely preserve draft locally in browser storage so nothing is lost
      try {
        localStorage.setItem(
          "it_blog_draft_backup",
          JSON.stringify({
            title: blogTitle,
            slug: blogSlug,
            subtitle: blogSubtitle,
            category: blogCategory,
            coverImage,
            tags: blogTags,
            blocks,
            savedAt: new Date().toISOString(),
          })
        );
        setSavedDraftNotice({
          title: blogTitle || "Current Draft",
          savedAt: new Date().toLocaleTimeString(),
        });
      } catch (_) {}

      const errMsg = e?.message || String(e || "");
      if (
        errMsg.includes("401") ||
        errMsg.toLowerCase().includes("token") ||
        errMsg.toLowerCase().includes("unauthorized") ||
        errMsg.toLowerCase().includes("expired")
      ) {
        alert(
          "⚠️ Login Session Expired\n\nDon't worry! Your article draft with all 30 widgets has been safely saved to your browser storage.\n\nPlease log in again at /staff/login in a new tab, then return here and click 'Publish' or 'Save Draft' again."
        );
      } else if (
        errMsg.includes("Can't reach database") ||
        errMsg.includes("database server") ||
        errMsg.includes("Connection terminated")
      ) {
        alert(
          "⚠️ Database Connection Notice\n\nThe cloud database is currently reconnecting or warming up, but YOUR WORK IS SAFE in your browser storage.\n\nPlease wait 10-15 seconds and click Save again."
        );
      } else {
        alert(`Failed to save blog post: ${errMsg}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleBackToList = () => {
    setIsCreating(false);
    setEditingBlogId(null);
    router.replace("/it/blogs");
  };

  const handleDeleteBlog = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      await blogApi.delete(id);
      alert("Blog deleted successfully.");
      loadBlogs();
    } catch (e: any) {
      alert("Failed to delete blog: " + e.message);
    }
  };

  function getBlogBlocks(blog: any): Block[] {
    if (!blog) return [];
    if (Array.isArray(blog.blocks) && blog.blocks.length > 0) return blog.blocks;
    if (typeof blog.blocks === "string") {
      try {
        const parsed = JSON.parse(blog.blocks);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    const rawContent = blog.content || "";
    if (rawContent) {
      const parsed = parseHtmlOrTextToBlocks(rawContent);
      if (parsed.length > 0) return parsed;
    }
    return [];
  };

  const getBlogWordCount = (blog: any) => {
    if (!blog) return 0;
    const bBlocks = getBlogBlocks(blog);
    if (bBlocks.length > 0) {
      const text = bBlocks.map((b) => `${b.title || ""} ${b.content || ""} ${b.subtitle || ""}`).join(" ");
      return text.trim() ? text.trim().split(/\s+/).length : 0;
    }
    const clean = (blog.content || "").replace(/<[^>]*>/g, " ");
    return clean.trim() ? clean.trim().split(/\s+/).length : 0;
  };

  const getBlogReadingTime = (blog: any) => {
    return Math.max(1, Math.ceil(getBlogWordCount(blog) / 200));
  };

  const handleToggleSelectBlogForCompare = (id: string) => {
    setSelectedBlogIdsForCompare((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= 2) {
        return [prev[1], id];
      }
      return [...prev, id];
    });
  };

  const handleOpenCompare = (idA?: string, idB?: string) => {
    const firstId = idA || selectedBlogIdsForCompare[0] || (blogs[0]?.id || blogs[0]?._id) || null;
    let secondId = idB || selectedBlogIdsForCompare[1] || null;
    if (!secondId && blogs.length > 1) {
      const alt = blogs.find((b) => (b.id || b._id) !== firstId);
      secondId = alt?.id || alt?._id || null;
    }
    setCompareBlogIdA(firstId);
    setCompareBlogIdB(secondId || firstId);
    setComparing(true);
  };

  async function handleEditBlog(blog: any) {
    let fullBlog = blog;
    const id = fullBlog.id || fullBlog._id;
    // If full content is not present, fetch complete blog from API
    if (!fullBlog.content && (!fullBlog.blocks || fullBlog.blocks.length === 0)) {
      try {
        if (id) {
          const res: any = await blogApi.getById(id).catch(() => null);
          if (res?.data) {
            fullBlog = { ...fullBlog, ...res.data };
          }
        }
      } catch (err) {
        console.warn("Could not fetch full blog by ID:", err);
      }
    }

    setEditingBlogId(id || null);
    setBlogTitle(fullBlog.title || "");
    setBlogSlug(fullBlog.slug || "");
    setBlogSubtitle(fullBlog.subtitle || fullBlog.excerpt || "");
    setBlogCategory(fullBlog.category || "Loan Guidance");
    setCoverImage(fullBlog.coverImage || fullBlog.featuredImage || "");
    const rawTags = Array.isArray(fullBlog.tags)
      ? fullBlog.tags.map((t: any) => (typeof t === "string" ? t : t?.name || t?.tag?.name || "")).filter(Boolean)
      : [];
    setBlogTags(rawTags.length > 0 ? rawTags : ["EducationLoan", "StudyAbroad", "FintechGuidance"]);
    const parsedBlocks = getBlogBlocks(fullBlog);
    setBlocks(parsedBlocks);
    setIsCreating(true);
  }

  const filteredBlogs = blogs.filter((b) => {
    const matchesSearch =
      !searchQuery ||
      b.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.slug?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.authorName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = categoryFilter === "all" || b.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId);

  return (
    <div className={isCreating ? "h-[calc(100vh-3rem)] md:h-[calc(100vh-4rem)] flex flex-col overflow-hidden" : "max-w-[1440px] mx-auto space-y-6 animate-fade-in pb-16"}>
      {/* Toast feedback for copied links */}
      {copiedLink && (
        <div className="fixed top-5 right-5 z-[300] bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-top-4 duration-200">
          <span className="material-symbols-outlined text-emerald-400 text-lg">check_circle</span>
          <span className="text-xs font-bold font-sans">
            Copied {copiedLink} to clipboard!
          </span>
        </div>
      )}

      {/* Top Header - Shown ONLY in Blogs List View */}
      {!isCreating && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-2xl text-indigo-600">newspaper</span>
              <h2 className="text-2xl font-black tracking-tight text-[#0A2540]">
                IT Blog CMS & Publishing
              </h2>
              {/* WordPress Elementor Reference Badge */}
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-[#E21B5A] border border-rose-200 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">extension</span>
                WordPress Elementor Engine
              </span>
            </div>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              Elementor drag-and-drop page builder with deep link management, custom widgets, and responsive preview
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => handleOpenCompare()}
              disabled={blogs.length === 0}
              className="px-4 py-2.5 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              title="Compare blog content, reading time, and widget architecture side-by-side"
            >
              <span className="material-symbols-outlined text-[18px] text-indigo-600">compare</span>
              <span>Compare Blogs</span>
              {selectedBlogIdsForCompare.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-indigo-600 text-white text-[10px] font-black">
                  {selectedBlogIdsForCompare.length}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setEditingBlogId(null);
                setBlogTitle("");
                setBlogSlug("");
                setBlogSubtitle("");
                setCoverImage("");
                setBlocks([]);
                setIsCreating(true);
              }}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              + Create Blog (Elementor Mode)
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. BLOGS LIST VIEW WITH DEDICATED LINK ACTIONS                            */}
      {/* ========================================================================= */}
      {!isCreating ? (
        <div className="space-y-6">
          {/* Unsaved Local Draft Recovery Banner */}
          {savedDraftNotice && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                  <span className="material-symbols-outlined text-[22px]">history_edu</span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-amber-950">
                    Unsaved Local Draft Found: &ldquo;{savedDraftNotice.title || "Untitled Article"}&rdquo;
                  </h4>
                  <p className="text-[11px] text-amber-800">
                    Backed up at {savedDraftNotice.savedAt}. Don&apos;t lose your work!
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={restoreDraft}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">restore</span>
                  Resume Editing Draft
                </button>
                <button
                  type="button"
                  onClick={dismissDraft}
                  className="px-3 py-2 text-slate-500 hover:text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3 flex-1 max-w-md">
              <div className="relative w-full">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search articles by title, slug, or author..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer"
              >
                <option value="all">All Categories</option>
                <option value="Loan Guidance">Loan Guidance</option>
                <option value="Bank Reviews">Bank Reviews</option>
                <option value="Student Life">Student Life</option>
                <option value="Visa & Admissions">Visa & Admissions</option>
              </select>

              <button
                onClick={loadBlogs}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer shadow-2xs"
              >
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                Refresh
              </button>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-100 overflow-hidden shadow-sm bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 text-xs uppercase tracking-wider font-sans font-extrabold text-left">
                  <tr>
                    <th className="pl-6 pr-2 py-4 w-10 text-center">
                      <span className="material-symbols-outlined text-[16px] text-slate-400">compare</span>
                    </th>
                    <th className="px-4 py-4">Article & Public Link</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Author</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-center">Actions & Links</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-8 py-20 text-center text-slate-400">
                        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        <p className="text-xs font-bold">Loading blog articles...</p>
                      </td>
                    </tr>
                  ) : filteredBlogs.length > 0 ? (
                    filteredBlogs.map((blog: any) => {
                      const slug = blog.slug || blog.id || blog._id;
                      const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/blog/${slug}` : `/blog/${slug}`;
                      const isSelectedForCompare = selectedBlogIdsForCompare.includes(blog.id || blog._id);

                      return (
                        <tr key={blog.id || blog._id} className="hover:bg-slate-50/40 transition-colors group">
                          <td className="pl-6 pr-2 py-4 text-center">
                            <input
                              type="checkbox"
                              checked={isSelectedForCompare}
                              onChange={() => handleToggleSelectBlogForCompare(blog.id || blog._id)}
                              className="rounded text-indigo-600 cursor-pointer accent-indigo-600 w-4 h-4"
                              title="Select for comparison"
                            />
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-start gap-3">
                              {blog.coverImage || blog.featuredImage ? (
                                <img
                                  src={blog.coverImage || blog.featuredImage}
                                  alt={blog.title}
                                  className="w-14 h-12 object-cover rounded-xl shrink-0 border border-slate-200 mt-0.5"
                                />
                              ) : (
                                <div className="w-14 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500 shrink-0 mt-0.5">
                                  <span className="material-symbols-outlined text-[20px]">article</span>
                                </div>
                              )}
                              <div className="min-w-0 space-y-1">
                                <Link
                                  href={`/blog/${slug}`}
                                  target="_blank"
                                  className="text-[14px] font-bold text-slate-900 hover:text-indigo-600 transition-colors block truncate max-w-[360px]"
                                >
                                  {blog.title || "Untitled Blog"}
                                </Link>
                                {/* Public Link Pill & Copy Action */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-[10px] font-mono font-bold text-slate-600 hover:text-indigo-600 truncate max-w-[280px]">
                                    <span className="material-symbols-outlined text-[12px] text-indigo-600">link</span>
                                    /blog/{slug}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(publicUrl, `Public Link for "${blog.title}"`)}
                                    className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-md transition-all flex items-center gap-0.5 cursor-pointer"
                                    title="Copy full shareable URL"
                                  >
                                    <span className="material-symbols-outlined text-[12px]">content_copy</span>
                                    Copy Link
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold">
                              {blog.category || "General"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-semibold text-slate-700">
                              {blog.authorName || "IT Staff"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                                blog.published
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}
                            >
                              {blog.published ? "Published" : "Draft"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Quick Compare action */}
                              <button
                                type="button"
                                onClick={() => handleOpenCompare(blog.id || blog._id)}
                                className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-xl transition-all border border-purple-200 cursor-pointer flex items-center gap-1 shadow-2xs"
                                title="Compare this blog with another"
                              >
                                <span className="material-symbols-outlined text-[14px]">compare</span>
                                Compare
                              </button>
                              {/* Open live link */}
                              <Link
                                href={`/blog/${slug}`}
                                target="_blank"
                                className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-all border border-slate-200"
                                title="Open Live Blog Page"
                              >
                                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                              </Link>
                              <button
                                onClick={() => handleEditBlog(blog)}
                                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition-all border border-indigo-200 cursor-pointer flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-[14px]">edit</span>
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteBlog(blog.id || blog._id, blog.title)}
                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition-all border border-rose-200 cursor-pointer flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-[14px]">delete</span>
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-8 py-20 text-center text-slate-400">
                        <span className="material-symbols-outlined text-4xl mb-2">newspaper</span>
                        <p className="text-xs font-bold uppercase tracking-wider">No Blog Articles Found</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* BLOG COMPARISON MODAL & SIDE-BY-SIDE ANALYZER                             */}
          {/* ========================================================================= */}
          {comparing && (
            <div className="fixed inset-0 z-[200] bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-7xl max-h-[92vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
                {/* Modal Top Header Bar */}
                <div className="bg-slate-900 text-white p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md">
                      <span className="material-symbols-outlined text-xl">compare</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-black tracking-tight text-white flex items-center gap-2">
                        Blog Content & SEO Comparator
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                          Side-by-Side Analysis
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-400">Compare layout widgets, readability, word counts, and content flow</p>
                    </div>
                  </div>

                  {/* Selector Pills: Blog A vs Blog B */}
                  <div className="flex items-center gap-2 flex-wrap bg-slate-800/80 p-1.5 rounded-2xl border border-slate-700">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase text-indigo-400 px-1.5 py-0.5 bg-indigo-950/70 rounded">Blog A</span>
                      <select
                        value={compareBlogIdA || ""}
                        onChange={(e) => setCompareBlogIdA(e.target.value)}
                        className="bg-slate-900 border border-slate-700 text-white rounded-lg text-xs font-semibold px-2 py-1 max-w-[160px] truncate"
                      >
                        {blogs.map((b) => (
                          <option key={b.id || b._id} value={b.id || b._id}>
                            {b.title || "Untitled"}
                          </option>
                        ))}
                      </select>
                    </div>

                    <span className="text-xs font-black text-rose-400 px-1">VS</span>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase text-purple-400 px-1.5 py-0.5 bg-purple-950/70 rounded">Blog B</span>
                      <select
                        value={compareBlogIdB || ""}
                        onChange={(e) => setCompareBlogIdB(e.target.value)}
                        className="bg-slate-900 border border-slate-700 text-white rounded-lg text-xs font-semibold px-2 py-1 max-w-[160px] truncate"
                      >
                        {blogs.map((b) => (
                          <option key={b.id || b._id} value={b.id || b._id}>
                            {b.title || "Untitled"}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Tabs & Close */}
                  <div className="flex items-center gap-2">
                    <div className="flex bg-slate-800 p-0.5 rounded-xl border border-slate-700 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setCompareTab("overview")}
                        className={`px-3 py-1 rounded-lg transition-all ${
                          compareTab === "overview" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        Metrics & Stats
                      </button>
                      <button
                        type="button"
                        onClick={() => setCompareTab("content")}
                        className={`px-3 py-1 rounded-lg transition-all ${
                          compareTab === "content" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        Content Preview
                      </button>
                      <button
                        type="button"
                        onClick={() => setCompareTab("architecture")}
                        className={`px-3 py-1 rounded-lg transition-all ${
                          compareTab === "architecture" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        Widget Architecture
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setComparing(false)}
                      className="p-1.5 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
                      title="Close Comparison"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-50 min-h-0">
                  {(() => {
                    const bA = blogs.find((b) => (b.id || b._id) === compareBlogIdA) || blogs[0] || null;
                    const bB = blogs.find((b) => (b.id || b._id) === compareBlogIdB) || blogs[1] || blogs[0] || null;

                    if (!bA || !bB) {
                      return (
                        <div className="py-20 text-center text-slate-400">
                          <span className="material-symbols-outlined text-4xl mb-2">compare_arrows</span>
                          <p className="text-sm font-bold">Please select at least two blogs to compare</p>
                        </div>
                      );
                    }

                    const wordsA = getBlogWordCount(bA);
                    const wordsB = getBlogWordCount(bB);
                    const timeA = getBlogReadingTime(bA);
                    const timeB = getBlogReadingTime(bB);
                    const blocksA = getBlogBlocks(bA);
                    const blocksB = getBlogBlocks(bB);

                    return (
                      <div className="space-y-6">
                        {/* TAB 1: METRICS & STATS */}
                        {compareTab === "overview" && (
                          <div className="space-y-6">
                            {/* 4 Comparative Metric Cards */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Estimated Word Count</span>
                                <div className="flex items-center justify-between mt-2">
                                  <div>
                                    <span className="text-[10px] font-bold text-indigo-600">Blog A:</span>
                                    <p className="text-xl font-black text-slate-900 font-mono">{wordsA} words</p>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-[10px] font-bold text-purple-600">Blog B:</span>
                                    <p className="text-xl font-black text-slate-900 font-mono">{wordsB} words</p>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Reading Time</span>
                                <div className="flex items-center justify-between mt-2">
                                  <div>
                                    <span className="text-[10px] font-bold text-indigo-600">Blog A:</span>
                                    <p className="text-xl font-black text-slate-900 font-mono">{timeA} mins</p>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-[10px] font-bold text-purple-600">Blog B:</span>
                                    <p className="text-xl font-black text-slate-900 font-mono">{timeB} mins</p>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Widgets Used</span>
                                <div className="flex items-center justify-between mt-2">
                                  <div>
                                    <span className="text-[10px] font-bold text-indigo-600">Blog A:</span>
                                    <p className="text-xl font-black text-slate-900 font-mono">{blocksA.length} widgets</p>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-[10px] font-bold text-purple-600">Blog B:</span>
                                    <p className="text-xl font-black text-slate-900 font-mono">{blocksB.length} widgets</p>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Publish Status</span>
                                <div className="flex items-center justify-between mt-2">
                                  <div>
                                    <span className="text-[10px] font-bold text-indigo-600">Blog A:</span>
                                    <span className={`block text-xs font-black uppercase px-2 py-0.5 rounded-full mt-1 ${bA.published ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                                      {bA.published ? "Published" : "Draft"}
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-[10px] font-bold text-purple-600">Blog B:</span>
                                    <span className={`block text-xs font-black uppercase px-2 py-0.5 rounded-full mt-1 ${bB.published ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                                      {bB.published ? "Published" : "Draft"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Detailed Side-by-Side Metadata Table */}
                            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
                              <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-600">
                                  <tr>
                                    <th className="p-4 w-1/4">Comparison Metric</th>
                                    <th className="p-4 w-3/8 text-indigo-950 bg-indigo-50/40 border-r border-slate-200">
                                      Blog A: {bA.title || "Untitled"}
                                    </th>
                                    <th className="p-4 w-3/8 text-purple-950 bg-purple-50/40">
                                      Blog B: {bB.title || "Untitled"}
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs">
                                  <tr>
                                    <td className="p-4 font-bold text-slate-500">Cover Image</td>
                                    <td className="p-4 border-r border-slate-200 bg-indigo-50/10">
                                      {bA.coverImage || bA.featuredImage ? (
                                        <img src={bA.coverImage || bA.featuredImage} alt="A" className="h-20 w-36 object-cover rounded-xl border border-slate-200" />
                                      ) : (
                                        <span className="text-slate-400 italic">No Cover Image</span>
                                      )}
                                    </td>
                                    <td className="p-4 bg-purple-50/10">
                                      {bB.coverImage || bB.featuredImage ? (
                                        <img src={bB.coverImage || bB.featuredImage} alt="B" className="h-20 w-36 object-cover rounded-xl border border-slate-200" />
                                      ) : (
                                        <span className="text-slate-400 italic">No Cover Image</span>
                                      )}
                                    </td>
                                  </tr>
                                  <tr>
                                    <td className="p-4 font-bold text-slate-500">Category</td>
                                    <td className="p-4 border-r border-slate-200 font-bold text-indigo-900 bg-indigo-50/10">{bA.category || "General"}</td>
                                    <td className="p-4 font-bold text-purple-900 bg-purple-50/10">{bB.category || "General"}</td>
                                  </tr>
                                  <tr>
                                    <td className="p-4 font-bold text-slate-500">Author</td>
                                    <td className="p-4 border-r border-slate-200 text-slate-800 bg-indigo-50/10">{bA.authorName || "IT Staff"}</td>
                                    <td className="p-4 text-slate-800 bg-purple-50/10">{bB.authorName || "IT Staff"}</td>
                                  </tr>
                                  <tr>
                                    <td className="p-4 font-bold text-slate-500">Slug & Public URL</td>
                                    <td className="p-4 border-r border-slate-200 font-mono text-[11px] text-indigo-700 bg-indigo-50/10 truncate max-w-xs">
                                      /blog/{bA.slug || bA.id}
                                    </td>
                                    <td className="p-4 font-mono text-[11px] text-purple-700 bg-purple-50/10 truncate max-w-xs">
                                      /blog/{bB.slug || bB.id}
                                    </td>
                                  </tr>
                                  <tr>
                                    <td className="p-4 font-bold text-slate-500">Total Views</td>
                                    <td className="p-4 border-r border-slate-200 font-mono font-bold text-slate-800 bg-indigo-50/10">{bA.views || 0} views</td>
                                    <td className="p-4 font-mono font-bold text-slate-800 bg-purple-50/10">{bB.views || 0} views</td>
                                  </tr>
                                  <tr>
                                    <td className="p-4 font-bold text-slate-500">Actions</td>
                                    <td className="p-4 border-r border-slate-200 bg-indigo-50/10">
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setComparing(false);
                                            handleEditBlog(bA);
                                          }}
                                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1"
                                        >
                                          <span className="material-symbols-outlined text-[14px]">edit</span>
                                          Edit Blog A
                                        </button>
                                        <Link
                                          href={`/blog/${bA.slug || bA.id}`}
                                          target="_blank"
                                          className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-xs"
                                        >
                                          View Live ↗
                                        </Link>
                                      </div>
                                    </td>
                                    <td className="p-4 bg-purple-50/10">
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setComparing(false);
                                            handleEditBlog(bB);
                                          }}
                                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1"
                                        >
                                          <span className="material-symbols-outlined text-[14px]">edit</span>
                                          Edit Blog B
                                        </button>
                                        <Link
                                          href={`/blog/${bB.slug || bB.id}`}
                                          target="_blank"
                                          className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-xs"
                                        >
                                          View Live ↗
                                        </Link>
                                      </div>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* TAB 2: SIDE-BY-SIDE CONTENT PREVIEW */}
                        {compareTab === "content" && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Blog A Preview */}
                            <div className="bg-white rounded-3xl p-6 border-2 border-indigo-200 shadow-sm space-y-4">
                              <div className="flex items-center justify-between pb-3 border-b border-indigo-100">
                                <div>
                                  <span className="text-[10px] font-black uppercase text-indigo-600 px-2 py-0.5 bg-indigo-50 rounded-full">Blog A</span>
                                  <h4 className="text-base font-extrabold text-slate-900 mt-1">{bA.title}</h4>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setComparing(false);
                                    handleEditBlog(bA);
                                  }}
                                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold"
                                >
                                  Edit A
                                </button>
                              </div>
                              {(bA.coverImage || bA.featuredImage) && (
                                <img src={bA.coverImage || bA.featuredImage} alt="Cover" className="w-full max-h-52 object-cover rounded-2xl" />
                              )}
                              <div className="space-y-3">
                                {blocksA.length > 0 ? (
                                  blocksA.map((blk, idx) => (
                                    <div key={blk.id || idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                                      <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">#{idx + 1} {blk.type}</span>
                                      {blk.title && <p className="font-bold text-slate-900 mb-1">{blk.title}</p>}
                                      <p className="text-slate-700 whitespace-pre-wrap">{blk.content}</p>
                                    </div>
                                  ))
                                ) : (
                                  <div
                                    className="prose prose-sm max-w-none text-slate-700"
                                    dangerouslySetInnerHTML={{ __html: bA.content || "<p class='italic text-slate-400'>No content available</p>" }}
                                  />
                                )}
                              </div>
                            </div>

                            {/* Blog B Preview */}
                            <div className="bg-white rounded-3xl p-6 border-2 border-purple-200 shadow-sm space-y-4">
                              <div className="flex items-center justify-between pb-3 border-b border-purple-100">
                                <div>
                                  <span className="text-[10px] font-black uppercase text-purple-600 px-2 py-0.5 bg-purple-50 rounded-full">Blog B</span>
                                  <h4 className="text-base font-extrabold text-slate-900 mt-1">{bB.title}</h4>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setComparing(false);
                                    handleEditBlog(bB);
                                  }}
                                  className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-bold"
                                >
                                  Edit B
                                </button>
                              </div>
                              {(bB.coverImage || bB.featuredImage) && (
                                <img src={bB.coverImage || bB.featuredImage} alt="Cover" className="w-full max-h-52 object-cover rounded-2xl" />
                              )}
                              <div className="space-y-3">
                                {blocksB.length > 0 ? (
                                  blocksB.map((blk, idx) => (
                                    <div key={blk.id || idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                                      <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">#{idx + 1} {blk.type}</span>
                                      {blk.title && <p className="font-bold text-slate-900 mb-1">{blk.title}</p>}
                                      <p className="text-slate-700 whitespace-pre-wrap">{blk.content}</p>
                                    </div>
                                  ))
                                ) : (
                                  <div
                                    className="prose prose-sm max-w-none text-slate-700"
                                    dangerouslySetInnerHTML={{ __html: bB.content || "<p class='italic text-slate-400'>No content available</p>" }}
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* TAB 3: WIDGET ARCHITECTURE DIFF */}
                        {compareTab === "architecture" && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Blog A Architecture */}
                            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-3">
                              <h4 className="text-xs font-black uppercase tracking-wider text-indigo-700 flex items-center justify-between">
                                <span>Blog A Block Architecture</span>
                                <span className="font-mono text-slate-400">{blocksA.length} total blocks</span>
                              </h4>
                              <div className="space-y-2">
                                {blocksA.map((blk, i) => (
                                  <div key={blk.id || i} className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                      <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-mono font-bold flex items-center justify-center text-[10px]">
                                        {i + 1}
                                      </span>
                                      <span className="font-bold text-slate-800 capitalize">{blk.type}</span>
                                    </div>
                                    <span className="text-[11px] text-slate-500 font-mono truncate max-w-[200px]">
                                      {blk.title || blk.content || "Empty"}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Blog B Architecture */}
                            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-3">
                              <h4 className="text-xs font-black uppercase tracking-wider text-purple-700 flex items-center justify-between">
                                <span>Blog B Block Architecture</span>
                                <span className="font-mono text-slate-400">{blocksB.length} total blocks</span>
                              </h4>
                              <div className="space-y-2">
                                {blocksB.map((blk, i) => (
                                  <div key={blk.id || i} className="p-3 rounded-xl bg-purple-50/50 border border-purple-100 flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                      <span className="w-6 h-6 rounded-lg bg-purple-600 text-white font-mono font-bold flex items-center justify-center text-[10px]">
                                        {i + 1}
                                      </span>
                                      <span className="font-bold text-slate-800 capitalize">{blk.type}</span>
                                    </div>
                                    <span className="text-[11px] text-slate-500 font-mono truncate max-w-[200px]">
                                      {blk.title || blk.content || "Empty"}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* 2. ELEMENTOR-INSPIRED VISUAL PAGE BUILDER                                  */
        /* ========================================================================= */
        <div className="flex-1 h-full flex flex-col bg-white rounded-2xl border border-slate-200/90 shadow-xl overflow-hidden animate-in fade-in duration-200 min-h-0 space-y-0">
          {/* TOP ELEMENTOR HEADER BAR (FIXED AT TOP) */}
          <div className="bg-[#1E1E24] text-white px-4 py-2.5 flex items-center justify-between gap-3 border-b border-slate-800 shrink-0 z-20">
            <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
              {/* Short Back Button on the Left */}
              <button
                type="button"
                onClick={handleBackToList}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-700 flex items-center gap-1 cursor-pointer shrink-0 shadow-xs group"
                title="Back to Blog List"
              >
                <span className="material-symbols-outlined text-[17px] transition-transform group-hover:-translate-x-0.5">arrow_back</span>
                <span>Back</span>
              </button>

              {/* Elementor Iconic Badge & Status */}
              <div className="flex items-center gap-2 shrink-0">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm"
                  style={{ backgroundColor: "#E21B5A" }}
                  title="WordPress Elementor Visual Engine"
                >
                  <span className="material-symbols-outlined text-lg font-black">widgets</span>
                </div>
                {editingBlogId ? (
                  <span className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Editing Mode
                  </span>
                ) : (
                  <span className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    New Article
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <input
                  type="text"
                  value={blogTitle}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Enter Article Title Here..."
                  className="w-full bg-transparent text-sm md:text-base font-black text-white placeholder-slate-400 focus:outline-none focus:border-b focus:border-rose-400 pb-0.5"
                />
                {/* Live Permalink Display & Link Manager */}
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400 font-medium flex-wrap">
                  <span className="text-slate-500">Permalink:</span>
                  <span className="font-mono text-slate-300">/blog/</span>
                  <input
                    type="text"
                    value={blogSlug}
                    onChange={(e) => setBlogSlug(e.target.value)}
                    placeholder="custom-slug"
                    className="bg-slate-800 text-rose-300 px-2 py-0.5 rounded border border-slate-700 font-mono text-[11px] focus:outline-none focus:border-rose-400 max-w-[150px]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const fullUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/blog/${blogSlug || "post"}`;
                      copyToClipboard(fullUrl, "Article Live Link");
                    }}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] font-bold border border-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span className="material-symbols-outlined text-[12px]">content_copy</span>
                    Copy Link
                  </button>
                  <span className="text-slate-600">|</span>
                  <span>Category:</span>
                  <select
                    value={blogCategory}
                    onChange={(e) => setBlogCategory(e.target.value)}
                    className="bg-slate-800 text-slate-200 px-2 py-0.5 rounded border border-slate-700 text-[11px] font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="Loan Guidance">Loan Guidance</option>
                    <option value="Bank Reviews">Bank Reviews</option>
                    <option value="Student Life">Student Life</option>
                    <option value="Visa & Admissions">Visa & Admissions</option>
                  </select>
                </div>
              </div>
            </div>

            {/* View Mode (Responsive Switcher like Elementor) */}
            <div className="hidden sm:flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 select-none shrink-0">
              <button
                type="button"
                onClick={() => setViewMode("edit")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === "edit" ? "bg-[#E21B5A] text-white shadow-sm" : "text-slate-400 hover:text-white"
                }`}
                title="Elementor Canvas"
              >
                <span className="material-symbols-outlined text-[15px]">draw</span>
                <span>Canvas</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("preview")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === "preview" ? "bg-[#E21B5A] text-white shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">visibility</span>
                <span>Preview</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("mobile")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === "mobile" ? "bg-[#E21B5A] text-white shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">smartphone</span>
                <span>Mobile</span>
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={saveLocalDraftManual}
                title="Backup article draft to local browser storage"
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white text-xs font-semibold rounded-xl transition-all border border-slate-700 cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <span className="material-symbols-outlined text-[15px] text-amber-400">cloud_sync</span>
                <span className="hidden sm:inline">Backup</span>
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveBlog(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 hover:text-white text-xs font-bold rounded-xl transition-all border border-slate-700 cursor-pointer shadow-2xs"
              >
                {saving ? "Saving..." : "Save Draft"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveBlog(true)}
                className="px-4 py-1.5 bg-gradient-to-r from-[#E21B5A] to-rose-600 hover:from-[#c9144d] hover:to-rose-700 active:scale-95 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-rose-900/30 cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">{editingBlogId ? "update" : "publish"}</span>
                {saving ? (editingBlogId ? "Updating..." : "Publishing...") : (editingBlogId ? "Update Live" : "Publish Live")}
              </button>
            </div>
          </div>

          {/* CONTEXTUAL ELEMENTOR 3-TAB INSPECTOR BAR */}
          <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-4 overflow-x-auto shadow-xs shrink-0 z-10">
            {selectedBlock ? (
              <div className="flex items-center gap-4 w-full justify-between select-none">
                {/* 3 Tabs: Content | Style | Advanced */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setElementorInspectorTab("content")}
                      className={`px-3 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 ${
                        elementorInspectorTab === "content" ? "bg-white text-indigo-700 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">tune</span>
                      Content & Link
                    </button>
                    <button
                      type="button"
                      onClick={() => setElementorInspectorTab("style")}
                      className={`px-3 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 ${
                        elementorInspectorTab === "style" ? "bg-white text-indigo-700 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">palette</span>
                      Style & Dimensions
                    </button>
                    <button
                      type="button"
                      onClick={() => setElementorInspectorTab("advanced")}
                      className={`px-3 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 ${
                        elementorInspectorTab === "advanced" ? "bg-white text-indigo-700 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">settings</span>
                      Advanced
                    </button>
                  </div>

                  {/* TAB 1: CONTENT & LINK SETTINGS */}
                  {elementorInspectorTab === "content" && (
                    <div className="flex items-center gap-2.5 border-l border-slate-200 pl-3 flex-wrap">
                      {/* Contextual: Heading Level Selector (H1-H6) & Anchor */}
                      {selectedBlock.type === "heading" && (
                        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 mr-2">
                          <span className="text-[10px] font-bold text-slate-500 px-1">Heading:</span>
                          {([1, 2, 3, 4, 5, 6] as const).map((lvl) => {
                            const isCurrent = (selectedBlock.level || 2) === lvl;
                            return (
                              <button
                                key={lvl}
                                type="button"
                                onClick={() => {
                                  const fontSizes: Record<number, string> = {
                                    1: "32px",
                                    2: "26px",
                                    3: "22px",
                                    4: "18px",
                                    5: "16px",
                                    6: "14px",
                                  };
                                  updateBlockData(selectedBlock.id, {
                                    level: lvl,
                                    style: { ...(selectedBlock.style || {}), fontSize: fontSizes[lvl] },
                                  });
                                }}
                                className={`px-2 py-0.5 rounded text-xs font-black transition-all cursor-pointer ${
                                  isCurrent
                                    ? "bg-[#E21B5A] text-white shadow-xs"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                                }`}
                              >
                                H{lvl}
                              </button>
                            );
                          })}
                          <span className="text-[10px] font-mono text-slate-400 border-l border-slate-200 pl-1.5 pr-1">
                            #{(selectedBlock.content || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `heading-${selectedBlock.level || 2}`}
                          </span>
                        </div>
                      )}

                      {/* Contextual: Image Source Tools */}
                      {selectedBlock.type === "image" && (
                        <div className="flex items-center gap-2 mr-2">
                          <label className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer">
                            <span className="material-symbols-outlined text-[14px]">upload_file</span>
                            <span>Upload Image</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (evt) => {
                                    const dataUrl = evt.target?.result as string;
                                    if (dataUrl) updateBlockContent(selectedBlock.id, dataUrl);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </label>
                          <input
                            type="text"
                            value={selectedBlock.content.startsWith("data:") ? "[Local Image File]" : selectedBlock.content}
                            onChange={(e) => updateBlockContent(selectedBlock.id, e.target.value)}
                            placeholder="Image URL (https://...)"
                            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 w-40 font-mono text-slate-700"
                          />
                          {selectedBlock.content && (
                            <button
                              type="button"
                              onClick={() => updateBlockContent(selectedBlock.id, "")}
                              className="px-2 py-1 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded border border-rose-200 cursor-pointer"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      )}

                      {/* Contextual: Video Source Tools */}
                      {selectedBlock.type === "video" && (
                        <div className="flex items-center gap-2 mr-2">
                          <input
                            type="text"
                            value={selectedBlock.content.startsWith("data:") ? "[Local Video File]" : selectedBlock.content}
                            onChange={(e) => updateBlockContent(selectedBlock.id, e.target.value)}
                            placeholder="YouTube, Vimeo or MP4 URL..."
                            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 w-44 font-mono text-slate-700"
                          />
                        </div>
                      )}

                      {/* Contextual: Icon Widget Tools */}
                      {(selectedBlock.type === "icon" || selectedBlock.type === "icon_box") && (
                        <div className="flex items-center gap-1.5 mr-2">
                          <span className="text-[10px] font-bold text-slate-500">Icon:</span>
                          <input
                            type="text"
                            value={selectedBlock.iconName || "verified_user"}
                            onChange={(e) => updateBlockData(selectedBlock.id, { iconName: e.target.value })}
                            className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono w-28 text-slate-700"
                            placeholder="Icon name"
                          />
                        </div>
                      )}

                      {/* Contextual: Button / CTA Tools */}
                      {(selectedBlock.type === "button" || selectedBlock.type === "cta") && (
                        <div className="flex items-center gap-1.5 mr-2">
                          <span className="text-[10px] font-bold text-slate-500">Text:</span>
                          <input
                            type="text"
                            value={selectedBlock.content || selectedBlock.buttonText || ""}
                            onChange={(e) => updateBlockContent(selectedBlock.id, e.target.value)}
                            placeholder="Button Text..."
                            className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs w-28 text-slate-700"
                          />
                        </div>
                      )}

                      {/* Contextual: List Widget Toggle */}
                      {selectedBlock.type === "list" && (
                        <div className="flex items-center gap-1.5 mr-2">
                          <button
                            type="button"
                            onClick={() => toggleListType(selectedBlock.id)}
                            className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[14px]">format_list_numbered</span>
                            Type: {selectedBlock.listType === "ordered" ? "Ordered (1.2.3)" : "Unordered (•)"}
                          </button>
                          <button
                            type="button"
                            onClick={() => addListItem(selectedBlock.id)}
                            className="px-2.5 py-1 bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            + Item
                          </button>
                        </div>
                      )}

                      {/* Contextual: Table Widget Tools */}
                      {selectedBlock.type === "table" && (
                        <div className="flex items-center gap-1 mr-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => addTableRow(selectedBlock.id)}
                            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-bold text-[11px] border border-slate-200 cursor-pointer"
                          >
                            + Row
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteTableRow(selectedBlock.id)}
                            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-rose-700 rounded font-bold text-[11px] border border-slate-200 cursor-pointer"
                          >
                            - Row
                          </button>
                          <button
                            type="button"
                            onClick={() => addTableColumn(selectedBlock.id)}
                            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-bold text-[11px] border border-slate-200 cursor-pointer"
                          >
                            + Col
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteTableColumn(selectedBlock.id)}
                            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-rose-700 rounded font-bold text-[11px] border border-slate-200 cursor-pointer"
                          >
                            - Col
                          </button>
                        </div>
                      )}

                      {/* Link URL Quick Input */}
                      <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl">
                        <span className="material-symbols-outlined text-indigo-600 text-[16px]">link</span>
                        <input
                          type="text"
                          value={selectedBlock.url || selectedBlock.link || ""}
                          onChange={(e) => updateBlockData(selectedBlock.id, { url: e.target.value, link: e.target.value })}
                          placeholder="Link URL (/apply or https://...)"
                          className="text-xs bg-transparent border-none focus:outline-none w-48 font-mono font-medium text-slate-800"
                        />
                      </div>

                      {/* Open Link Inspector Details Modal */}
                      <button
                        type="button"
                        onClick={() => openHyperlinkDialog(selectedBlock.id, selectedBlock.content?.slice(0, 30), selectedBlock.url || selectedBlock.link)}
                        className={`px-3 py-1 text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer ${
                          selectedBlock.url || selectedBlock.link
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                        }`}
                        title="Hyperlink Modal & Preset Selector"
                      >
                        <span className="material-symbols-outlined text-[14px]">link</span>
                        <span>Hyperlink Dialog</span>
                        {selectedBlock.url && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-0.5" />}
                      </button>

                      {/* Open in new tab checkbox */}
                      <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!selectedBlock.openInNewTab}
                          onChange={(e) => updateBlockData(selectedBlock.id, { openInNewTab: e.target.checked })}
                          className="rounded text-indigo-600 cursor-pointer"
                        />
                        <span>New Window</span>
                      </label>
                    </div>
                  )}

                  {/* TAB 2: STYLE (TYPOGRAPHY, BOX DIMENSIONS & ALIGNMENT) */}
                  {elementorInspectorTab === "style" && (
                    <div className="flex items-center gap-3 border-l border-slate-200 pl-3 flex-wrap">
                      {/* Contextual: Heading Level Selector (H1-H6) in Style Tab */}
                      {selectedBlock.type === "heading" && (
                        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-500 px-1">Level:</span>
                          {([1, 2, 3, 4, 5, 6] as const).map((lvl) => {
                            const isCurrent = (selectedBlock.level || 2) === lvl;
                            return (
                              <button
                                key={lvl}
                                type="button"
                                onClick={() => {
                                  const fontSizes: Record<number, string> = {
                                    1: "32px",
                                    2: "26px",
                                    3: "22px",
                                    4: "18px",
                                    5: "16px",
                                    6: "14px",
                                  };
                                  updateBlockData(selectedBlock.id, {
                                    level: lvl,
                                    style: { ...(selectedBlock.style || {}), fontSize: fontSizes[lvl] },
                                  });
                                }}
                                className={`px-2 py-0.5 rounded text-xs font-black transition-all cursor-pointer ${
                                  isCurrent
                                    ? "bg-[#E21B5A] text-white shadow-xs"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                                }`}
                              >
                                H{lvl}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Font Size */}
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold text-slate-400">Size:</span>
                        <select
                          value={selectedBlock.style?.fontSize || "16px"}
                          onChange={(e) => updateBlockStyle(selectedBlock.id, { fontSize: e.target.value })}
                          className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer"
                        >
                          <option value="12px">12px Small</option>
                          <option value="14px">14px Body</option>
                          <option value="16px">16px Regular</option>
                          <option value="18px">18px Large</option>
                          <option value="20px">20px Subtitle</option>
                          <option value="24px">24px H3</option>
                          <option value="28px">28px H2</option>
                          <option value="32px">32px H1</option>
                          <option value="40px">40px Hero</option>
                        </select>
                      </div>

                      {/* Font Weight */}
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold text-slate-400">Weight:</span>
                        <select
                          value={selectedBlock.style?.fontWeight || "normal"}
                          onChange={(e) => updateBlockStyle(selectedBlock.id, { fontWeight: e.target.value })}
                          className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer"
                        >
                          <option value="400">Normal</option>
                          <option value="500">Medium</option>
                          <option value="600">Semibold</option>
                          <option value="700">Bold</option>
                          <option value="900">Black</option>
                        </select>
                      </div>

                      {/* Box Width Presets */}
                      <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                        <span className="text-[10px] font-bold text-slate-400">Width:</span>
                        {(["25%", "33%", "50%", "75%", "100%"] as const).map((w) => (
                          <button
                            key={w}
                            type="button"
                            onClick={() => updateBlockDimensions(selectedBlock.id, { width: w, maxWidth: w })}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-black cursor-pointer transition-all ${
                              (selectedBlock.style?.width || "100%") === w
                                ? "bg-[#E21B5A] text-white shadow-xs"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            {w}
                          </button>
                        ))}
                      </div>

                      {/* Box Height Presets */}
                      <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                        <span className="text-[10px] font-bold text-slate-400">Height:</span>
                        {[
                          { label: "Auto", val: "auto" },
                          { label: "160px", val: "160px" },
                          { label: "280px", val: "280px" },
                          { label: "420px", val: "420px" },
                        ].map((h) => (
                          <button
                            key={h.val}
                            type="button"
                            onClick={() => updateBlockDimensions(selectedBlock.id, { height: h.val })}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-black cursor-pointer transition-all ${
                              (selectedBlock.style?.height || "auto") === h.val
                                ? "bg-indigo-600 text-white shadow-xs"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            {h.label}
                          </button>
                        ))}
                      </div>

                      {/* Text Alignment */}
                      <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                        {(["left", "center", "right", "justify"] as const).map((align) => (
                          <button
                            key={align}
                            type="button"
                            onClick={() => updateBlockDimensions(selectedBlock.id, { textAlign: align })}
                            className={`p-1 rounded-md text-slate-600 transition-all cursor-pointer ${
                              (selectedBlock.style?.textAlign || "left") === align
                                ? "bg-white text-indigo-600 shadow-2xs font-bold"
                                : "hover:bg-slate-200/50"
                            }`}
                            title={`Align ${align}`}
                          >
                            <span className="material-symbols-outlined text-[16px]">format_align_{align}</span>
                          </button>
                        ))}
                      </div>

                      {/* Text Colors */}
                      <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                        <span className="text-[10px] font-bold text-slate-400">Color:</span>
                        {[
                          { name: "Slate", color: "#1e293b" },
                          { name: "Indigo", color: "#4f46e5" },
                          { name: "Emerald", color: "#059669" },
                          { name: "Rose", color: "#e11d48" },
                          { name: "Amber", color: "#d97706" },
                        ].map((c) => (
                          <button
                            key={c.name}
                            type="button"
                            onClick={() => updateBlockStyle(selectedBlock.id, { color: c.color })}
                            className={`w-5 h-5 rounded-full border transition-transform hover:scale-110 cursor-pointer ${
                              (selectedBlock.style?.color || "#1e293b") === c.color
                                ? "ring-2 ring-indigo-500 ring-offset-1 border-white"
                                : "border-slate-200"
                            }`}
                            style={{ backgroundColor: c.color }}
                            title={c.name}
                          />
                        ))}
                        <label className="w-5 h-5 rounded-full border border-slate-200 overflow-hidden cursor-pointer relative hover:scale-110 transition-transform" title="Custom color">
                          <input
                            type="color"
                            value={selectedBlock.style?.color || "#1e293b"}
                            onChange={(e) => updateBlockStyle(selectedBlock.id, { color: e.target.value })}
                            className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
                          />
                          <span className="w-full h-full block bg-gradient-to-tr from-rose-500 via-emerald-500 to-indigo-500" />
                        </label>
                      </div>

                      {/* Background Color */}
                      <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                        <span className="text-[10px] font-bold text-slate-400">Bg:</span>
                        {[
                          { name: "None", color: "transparent" },
                          { name: "White", color: "#ffffff" },
                          { name: "Light Slate", color: "#f8fafc" },
                          { name: "Indigo Tint", color: "#eef2ff" },
                          { name: "Rose Tint", color: "#fff1f2" },
                        ].map((bg) => (
                          <button
                            key={bg.name}
                            type="button"
                            onClick={() => updateBlockStyle(selectedBlock.id, { backgroundColor: bg.color })}
                            className={`w-4 h-4 rounded border text-[9px] flex items-center justify-center transition-transform hover:scale-110 cursor-pointer ${
                              (selectedBlock.style?.backgroundColor || "transparent") === bg.color
                                ? "ring-2 ring-indigo-500 border-white"
                                : "border-slate-300"
                            }`}
                            style={{ backgroundColor: bg.color === "transparent" ? "#ffffff" : bg.color }}
                            title={bg.name}
                          >
                            {bg.color === "transparent" && <span className="text-slate-400 text-[10px]">✕</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: ADVANCED (MARGINS, PADDING, NOFOLLOW) */}
                  {elementorInspectorTab === "advanced" && (
                    <div className="flex items-center gap-3 border-l border-slate-200 pl-3 text-xs font-semibold text-slate-600">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!selectedBlock.addNofollow}
                          onChange={(e) => updateBlockData(selectedBlock.id, { addNofollow: e.target.checked })}
                          className="rounded text-indigo-600 cursor-pointer"
                        />
                        <span>Add rel="nofollow" (SEO)</span>
                      </label>
                      <span className="text-slate-300">|</span>
                      <span>Padding:</span>
                      <select
                        value={selectedBlock.style?.padding || "8px"}
                        onChange={(e) => updateBlockStyle(selectedBlock.id, { padding: e.target.value })}
                        className="px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-xs"
                      >
                        <option value="4px">Compact (4px)</option>
                        <option value="8px">Normal (8px)</option>
                        <option value="16px">Spacious (16px)</option>
                        <option value="24px">Extra Large (24px)</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Block Quick Actions */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openHyperlinkDialog(selectedBlock.id, selectedBlock.content?.slice(0, 30), selectedBlock.url || selectedBlock.link)}
                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer border border-indigo-200"
                    title="Add / Edit Link"
                  >
                    <span className="material-symbols-outlined text-[14px]">link</span>
                    Link
                  </button>
                  <button
                    type="button"
                    onClick={() => duplicateBlock(selectedBlock.id)}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">content_copy</span>
                    Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      removeBlock(selectedBlock.id);
                      setSelectedBlockId(null);
                    }}
                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 py-0.5">
                <span className="material-symbols-outlined text-[#E21B5A] text-[18px]">touch_app</span>
                Select any widget on the canvas to configure Elementor links, styles, typography, and target URLs.
              </div>
            )}
          </div>

          {/* DEDICATED ELEMENTOR LINK SETTINGS DROPDOWN / INSPECTOR MODAL */}
          {linkInspectorOpen && selectedBlock && (
            <div className="bg-slate-900 text-white p-4 border-b border-slate-800 shadow-2xl animate-in slide-in-from-top-2 duration-150 shrink-0 z-20 max-h-72 overflow-y-auto custom-scrollbar">
              <div className="max-w-4xl mx-auto space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#E21B5A]">link</span>
                    <h5 className="text-sm font-black uppercase tracking-wider text-white">
                      WordPress Elementor Link Settings for [{selectedBlock.type}]
                    </h5>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLinkInspectorOpen(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left: Custom URL & Options */}
                  <div className="space-y-3 bg-slate-800/80 p-4 rounded-2xl border border-slate-700">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                        Destination URL
                      </label>
                      <input
                        type="text"
                        value={selectedBlock.url || selectedBlock.link || ""}
                        onChange={(e) => updateBlockData(selectedBlock.id, { url: e.target.value, link: e.target.value })}
                        placeholder="https://example.com/page or /apply"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-rose-300 focus:outline-none focus:border-rose-400"
                      />
                    </div>

                    <div className="flex items-center gap-4 pt-1">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!selectedBlock.openInNewTab}
                          onChange={(e) => updateBlockData(selectedBlock.id, { openInNewTab: e.target.checked })}
                          className="rounded text-rose-500 cursor-pointer"
                        />
                        <span>Open in new window (target="_blank")</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!selectedBlock.addNofollow}
                          onChange={(e) => updateBlockData(selectedBlock.id, { addNofollow: e.target.checked })}
                          className="rounded text-rose-500 cursor-pointer"
                        />
                        <span>Add nofollow (rel="nofollow")</span>
                      </label>
                    </div>
                  </div>

                  {/* Right: Quick Preset Routes for Fast Linking */}
                  <div className="space-y-2 bg-slate-800/80 p-4 rounded-2xl border border-slate-700">
                    <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                      Quick Portal Route Shortcuts (Click to set link)
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {PRESET_PORTAL_LINKS.map((preset) => (
                        <button
                          key={preset.url}
                          type="button"
                          onClick={() => updateBlockData(selectedBlock.id, { url: preset.url, link: preset.url })}
                          className={`p-2 rounded-xl text-left transition-all cursor-pointer border ${
                            selectedBlock.url === preset.url
                              ? "bg-rose-950/80 border-rose-500 text-rose-200"
                              : "bg-slate-900/80 hover:bg-slate-700 border-slate-700 text-slate-300"
                          }`}
                        >
                          <div className="text-xs font-bold">{preset.label}</div>
                          <div className="text-[10px] font-mono text-slate-400">{preset.url}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-400">
                    * Elementor links will render as valid search-engine compliant hyperlinks in the published post.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      updateBlockData(selectedBlock.id, { url: "", link: "" });
                      setLinkInspectorOpen(false);
                    }}
                    className="px-3 py-1 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 rounded-lg text-xs font-bold"
                  >
                    Clear Link
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MAIN CANVAS BODY: LEFT DOCK (FIXED WIDTH, INDEPENDENT SCROLL) + CENTER EDITING CANVAS (SCROLLS ONLY) */}
          <div className="flex-1 flex flex-col md:flex-row items-stretch overflow-hidden min-h-0 bg-slate-100">
            {/* LEFT ELEMENTOR WIDGET DOCK (FIXED WIDTH, INDEPENDENT SCROLL) */}
            <div className="w-full md:w-72 lg:w-80 bg-white border-r border-slate-200 flex flex-col shrink-0 h-full overflow-hidden">
              {/* Dock Tab Selector */}
              <div className="flex border-b border-slate-200 bg-slate-50 shrink-0">
                <button
                  type="button"
                  onClick={() => setLeftDockTab("elements")}
                  className={`flex-1 py-3 text-xs font-black transition-all flex items-center justify-center gap-1.5 border-b-2 cursor-pointer ${
                    leftDockTab === "elements"
                      ? "border-[#E21B5A] text-[#E21B5A] bg-white"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">widgets</span>
                  Widgets
                </button>
                <button
                  type="button"
                  onClick={() => setLeftDockTab("templates")}
                  className={`flex-1 py-3 text-xs font-black transition-all flex items-center justify-center gap-1.5 border-b-2 cursor-pointer ${
                    leftDockTab === "templates"
                      ? "border-[#E21B5A] text-[#E21B5A] bg-white"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                  Templates
                </button>
                <button
                  type="button"
                  onClick={() => setLeftDockTab("uploads")}
                  className={`flex-1 py-3 text-xs font-black transition-all flex items-center justify-center gap-1.5 border-b-2 cursor-pointer ${
                    leftDockTab === "uploads"
                      ? "border-[#E21B5A] text-[#E21B5A] bg-white"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
                  Uploads
                </button>
              </div>

              {/* Elementor Search & Category Filter */}
              {leftDockTab === "elements" && (
                <div className="p-3 border-b border-slate-100 space-y-2 shrink-0">
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">
                      search
                    </span>
                    <input
                      type="text"
                      value={dockSearch}
                      onChange={(e) => setDockSearch(e.target.value)}
                      placeholder="Search Elementor widgets..."
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                    />
                  </div>
                  {/* Category Pill Switcher */}
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[9px] font-black overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setElementorCategoryTab("all")}
                      className={`px-2 py-1 rounded-md transition-all shrink-0 ${
                        elementorCategoryTab === "all" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500"
                      }`}
                    >
                      All (30)
                    </button>
                    <button
                      type="button"
                      onClick={() => setElementorCategoryTab("basic")}
                      className={`px-2 py-1 rounded-md transition-all shrink-0 ${
                        elementorCategoryTab === "basic" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500"
                      }`}
                    >
                      Basic
                    </button>
                    <button
                      type="button"
                      onClick={() => setElementorCategoryTab("media")}
                      className={`px-2 py-1 rounded-md transition-all shrink-0 ${
                        elementorCategoryTab === "media" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500"
                      }`}
                    >
                      Media
                    </button>
                    <button
                      type="button"
                      onClick={() => setElementorCategoryTab("interactive")}
                      className={`px-2 py-1 rounded-md transition-all shrink-0 ${
                        elementorCategoryTab === "interactive" ? "bg-white text-rose-600 shadow-2xs" : "text-slate-500"
                      }`}
                    >
                      Interactive
                    </button>
                    <button
                      type="button"
                      onClick={() => setElementorCategoryTab("advanced")}
                      className={`px-2 py-1 rounded-md transition-all shrink-0 ${
                        elementorCategoryTab === "advanced" ? "bg-white text-indigo-600 shadow-2xs" : "text-slate-500"
                      }`}
                    >
                      Advanced
                    </button>
                  </div>
                </div>
              )}

              {/* Dock Content Body: SCROLLS FREELY TO SEE ALL BUTTONS AND OPTIONS */}
              <div className="flex-1 p-3 overflow-y-auto custom-scrollbar space-y-3 min-h-0">
                {/* TAB A: ELEMENTOR WIDGETS PALETTE */}
                {leftDockTab === "elements" && (
                  <div className="grid grid-cols-2 gap-2">
                    {ELEMENTOR_WIDGETS.filter((w) => {
                      const matchCat = elementorCategoryTab === "all" || w.category === elementorCategoryTab;
                      const matchQuery =
                        !dockSearch ||
                        w.label.toLowerCase().includes(dockSearch.toLowerCase()) ||
                        w.desc.toLowerCase().includes(dockSearch.toLowerCase());
                      return matchCat && matchQuery;
                    }).map((elem) => (
                      <div
                        key={elem.type}
                        draggable
                        onDragStart={(e) => handlePaletteDragStart(e, elem.type)}
                        onDragEnd={handlePaletteDragEnd}
                        onClick={() => addBlock(elem.type)}
                        className="p-3 bg-slate-50 hover:bg-rose-50/50 border border-slate-200 hover:border-rose-400 rounded-xl transition-all cursor-grab active:cursor-grabbing select-none group text-left flex flex-col justify-between min-h-[90px] shadow-2xs relative"
                      >
                        {elem.badge && (
                          <span
                            className={`absolute top-2 right-2 text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                              elem.badge === "Link"
                                ? "bg-indigo-100 text-indigo-700"
                                : "bg-rose-100 text-rose-700"
                            }`}
                          >
                            {elem.badge}
                          </span>
                        )}
                        <div className="flex items-center justify-between">
                          <span
                            className="material-symbols-outlined text-xl transition-transform group-hover:scale-110"
                            style={{ color: elem.badge === "Link" ? "#4F46E5" : "#E21B5A" }}
                          >
                            {elem.icon}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800 group-hover:text-rose-950">
                            {elem.label}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium truncate">{elem.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* TAB B: TEMPLATES */}
                {leftDockTab === "templates" && (
                  <div className="space-y-3">
                    <div
                      onClick={() => applyTemplate("iphone_deal")}
                      className="p-3.5 bg-gradient-to-br from-rose-50 via-amber-50 to-orange-50 border border-rose-200 hover:border-rose-500 rounded-2xl cursor-pointer transition-all hover:shadow-md group"
                    >
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-[#E21B5A] text-white rounded">
                        Hot Deal Kit
                      </span>
                      <h5 className="text-xs font-bold text-slate-900 mt-1.5 group-hover:text-rose-600">
                        Apple iPhone Air Price Drop Deal
                      </h5>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Breakdown + Pricing Table + Amazon Live CTA + Dynamic Tags
                      </p>
                    </div>

                    <div
                      onClick={() => applyTemplate("education_guide")}
                      className="p-3.5 bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 hover:border-indigo-500 rounded-2xl cursor-pointer transition-all hover:shadow-md group"
                    >
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-indigo-600 text-white rounded">
                        Elementor Kit
                      </span>
                      <h5 className="text-xs font-bold text-indigo-950 mt-1.5 group-hover:text-indigo-600">
                        Education Loan Master Guide
                      </h5>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Title + Intro + Image + Highlights + Pro Tip Quote + Apply CTA
                      </p>
                    </div>

                    <div
                      onClick={() => applyTemplate("bank_review")}
                      className="p-3.5 bg-gradient-to-br from-purple-50 to-slate-50 border border-purple-200 hover:border-purple-500 rounded-2xl cursor-pointer transition-all hover:shadow-md group"
                    >
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-[#E21B5A] text-white rounded">
                        Comparison Kit
                      </span>
                      <h5 className="text-xs font-bold text-slate-900 mt-1.5 group-hover:text-rose-600">
                        Bank Comparison Review
                      </h5>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Head-to-head analysis + Comparison Table Code + Apply Button
                      </p>
                    </div>

                    <div
                      onClick={() => applyTemplate("visa_checklist")}
                      className="p-3.5 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 hover:border-emerald-500 rounded-2xl cursor-pointer transition-all hover:shadow-md group"
                    >
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-emerald-600 text-white rounded">
                        Checklist Kit
                      </span>
                      <h5 className="text-xs font-bold text-emerald-950 mt-1.5 group-hover:text-emerald-700">
                        F-1 Visa Checklist
                      </h5>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Title + Step-by-Step Document List + Quote + Download CTA
                      </p>
                    </div>
                  </div>
                )}

                {/* TAB C: UPLOADS (IMAGES & VIDEOS) */}
                {leftDockTab === "uploads" && (
                  <div className="space-y-3">
                    {/* Upload Image from File */}
                    <label className="p-4 border-2 border-dashed border-rose-300 hover:border-rose-500 bg-rose-50/20 hover:bg-rose-50/40 rounded-2xl block cursor-pointer transition-all text-center group">
                      <div className="w-10 h-10 rounded-xl bg-rose-100 group-hover:scale-105 text-[#E21B5A] flex items-center justify-center mx-auto mb-1.5 transition-transform shadow-2xs">
                        <span className="material-symbols-outlined text-2xl">add_photo_alternate</span>
                      </div>
                      <p className="text-xs font-bold text-slate-900 group-hover:text-rose-950">Upload Image File</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, WEBP, GIF, SVG</p>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            const reader = new FileReader();
                            reader.onload = (evt) => {
                              const dataUrl = evt.target?.result as string;
                              if (dataUrl) {
                                const newImgBlock = createBlock("image", dataUrl);
                                setBlocks((prev) => [...prev, newImgBlock]);
                                setSelectedBlockId(newImgBlock.id);
                              }
                            };
                            reader.readAsDataURL(e.target.files[0]);
                          }
                        }}
                      />
                    </label>

                    {/* Upload Video from File */}
                    <label className="p-4 border-2 border-dashed border-indigo-300 hover:border-indigo-500 bg-indigo-50/20 hover:bg-indigo-50/40 rounded-2xl block cursor-pointer transition-all text-center group">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 group-hover:scale-105 text-indigo-600 flex items-center justify-center mx-auto mb-1.5 transition-transform shadow-2xs">
                        <span className="material-symbols-outlined text-2xl">video_file</span>
                      </div>
                      <p className="text-xs font-bold text-slate-900 group-hover:text-indigo-950">Upload Video File</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">MP4, WebM, MOV (Up to 50MB)</p>
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            const file = e.target.files[0];
                            if (file.size > 50 * 1024 * 1024) {
                              alert("Video exceeds 50MB. For larger videos, please paste a YouTube or Vimeo link.");
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = (evt) => {
                              const dataUrl = evt.target?.result as string;
                              if (dataUrl) {
                                const newVidBlock = createBlock("video", dataUrl);
                                setBlocks((prev) => [...prev, newVidBlock]);
                                setSelectedBlockId(newVidBlock.id);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* CENTER CANVAS STAGE (ELEMENTOR DIGITAL PAPER - ONLY THIS AREA SCROLLS) */}
            <div className="flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar flex justify-center min-h-0 bg-slate-100/90 select-none">
              <div
                onDragOver={(e) => handleCanvasDragOver(e)}
                onDragLeave={handleCanvasDragLeave}
                onDrop={(e) => handleCanvasDrop(e)}
                className={`w-full transition-all duration-300 bg-white shadow-xl rounded-2xl p-6 md:p-12 border border-slate-200 flex flex-col relative h-fit min-h-[500px] ${
                  viewMode === "mobile" ? "max-w-[420px]" : "max-w-[840px]"
                } ${isDraggingFile || draggedType ? "ring-4 ring-rose-500/50 bg-rose-50/10" : ""}`}
              >
                {/* Saved Draft Recovery Banner */}
                {savedDraftNotice && (
                  <div className="mb-6 bg-amber-50 border border-amber-300 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950 shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-amber-600 text-[22px] shrink-0">restore_page</span>
                      <div>
                        <p className="font-bold">Unsaved draft recovered: &ldquo;{savedDraftNotice.title || "Untitled Article"}&rdquo;</p>
                        <p className="text-[11px] text-amber-700">Locally backed up at {savedDraftNotice.savedAt}. Restore it to resume editing or discard.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={restoreDraft}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold rounded-lg shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[15px]">settings_backup_restore</span>
                        Restore Draft
                      </button>
                      <button
                        type="button"
                        onClick={dismissDraft}
                        className="px-2.5 py-1.5 text-slate-500 hover:text-slate-800 hover:bg-amber-100/60 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                      >
                        Discard
                      </button>
                    </div>
                  </div>
                )}

                {/* Canvas Header Watermark */}
                <div className="border-b border-slate-100 pb-4 mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold">
                    <span className="material-symbols-outlined text-[16px] text-[#E21B5A]">draw</span>
                    <span>{blogCategory || "Loan Guidance"}</span>
                    <span>•</span>
                    <span className="font-mono text-indigo-600">/blog/{blogSlug || "slug"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer px-2 py-0.5 rounded-md hover:bg-indigo-50 transition-colors">
                      <span className="material-symbols-outlined text-[14px]">add_photo_alternate</span>
                      <span>{coverImage ? "Change Cover" : "+ Cover Image"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (evt) => {
                              const dataUrl = evt.target?.result as string;
                              if (dataUrl) setCoverImage(dataUrl);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2 py-0.5 bg-slate-100 rounded">
                      {viewMode === "mobile" ? "Mobile View" : "Elementor Canvas Stage"}
                    </span>
                  </div>
                </div>

                {/* Cover Image */}
                {coverImage && (
                  <div className="mb-6 rounded-xl overflow-hidden max-h-64 border border-slate-200 shadow-sm relative group/cover">
                    <img src={coverImage} alt="Cover" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setCoverImage("")}
                      className="absolute top-2 right-2 p-1.5 bg-slate-900/80 hover:bg-rose-600 text-white rounded-lg text-xs font-bold opacity-0 group-hover/cover:opacity-100 transition-opacity cursor-pointer"
                      title="Remove Cover Image"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                )}

                {/* Editable Article Header Section on Canvas */}
                <div className="mb-6 space-y-3">
                  <div>
                    <input
                      type="text"
                      value={blogTitle}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      placeholder="Enter Article Headline..."
                      className="w-full bg-transparent text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-0 border-b-2 border-transparent hover:border-slate-200 focus:border-[#E21B5A] pb-1 transition-colors tracking-tight leading-tight"
                    />
                  </div>

                  <div>
                    <textarea
                      rows={2}
                      value={blogSubtitle}
                      onChange={(e) => setBlogSubtitle(e.target.value)}
                      placeholder="Add an engaging excerpt or summary for readers and search engines..."
                      className="w-full bg-transparent text-sm sm:text-base font-medium text-slate-600 placeholder:text-slate-300 focus:outline-none focus:ring-0 border-b border-transparent hover:border-slate-200 focus:border-indigo-400 resize-none pb-1 transition-colors leading-relaxed italic"
                    />
                  </div>

                  {/* Metadata Byline */}
                  <div className="flex items-center gap-3 text-xs text-slate-400 pt-1 pb-3 border-b border-slate-100 flex-wrap">
                    <span className="flex items-center gap-1 font-bold text-slate-700">
                      <span className="material-symbols-outlined text-[15px] text-[#E21B5A]">edit_note</span>
                      {user?.firstName ? `${user.firstName} ${user.lastName || ""}` : "VidyaLoan IT Editor"}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-semibold text-slate-600">
                      <span className="material-symbols-outlined text-[15px] text-indigo-500">label</span>
                      {blogCategory}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-semibold text-slate-600">
                      <span className="material-symbols-outlined text-[15px] text-amber-500">timer</span>
                      {Math.max(1, Math.ceil(blocks.reduce((acc, b) => acc + (b.content?.split(/\s+/).length || 0), 0) / 200))} min read
                    </span>
                    <span>•</span>
                    <span className="font-mono text-indigo-600 text-[11px] font-bold">
                      {blocks.length} {blocks.length === 1 ? "widget" : "widgets"} in canvas
                    </span>
                  </div>
                </div>

                {/* Canvas Blocks Container */}
                <div className="space-y-4 flex-1">
                  {blocks.length === 0 ? (
                    <div className="py-14 px-6 text-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 my-auto">
                      <div
                        className="w-14 h-14 rounded-2xl text-white flex items-center justify-center mx-auto mb-3 shadow-md ring-4 ring-rose-50"
                        style={{ backgroundColor: "#E21B5A" }}
                      >
                        <span className="material-symbols-outlined text-3xl">post_add</span>
                      </div>
                      <h4 className="text-base font-black text-slate-800 mb-1">
                        Start Building Your Article Content
                      </h4>
                      <p className="text-xs text-slate-500 max-w-md mx-auto mb-6 leading-relaxed">
                        Add a block below to start writing, or drag any of the 30+ widgets from the left library.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto mb-6 text-left">
                        <button
                          type="button"
                          onClick={() => {
                            const newB = createBlock("heading");
                            setBlocks([newB]);
                            setSelectedBlockId(newB.id);
                          }}
                          className="p-3 bg-white hover:bg-slate-50 border border-slate-200 hover:border-[#E21B5A] rounded-xl text-left transition-all group shadow-2xs cursor-pointer"
                        >
                          <div className="w-7 h-7 rounded-lg bg-rose-50 text-[#E21B5A] flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                            <span className="material-symbols-outlined text-[17px]">title</span>
                          </div>
                          <div className="text-xs font-bold text-slate-800">Add Headline</div>
                          <div className="text-[10px] text-slate-400">H1-H6 heading</div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const newB = createBlock("text");
                            setBlocks([newB]);
                            setSelectedBlockId(newB.id);
                          }}
                          className="p-3 bg-white hover:bg-slate-50 border border-slate-200 hover:border-indigo-500 rounded-xl text-left transition-all group shadow-2xs cursor-pointer"
                        >
                          <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                            <span className="material-symbols-outlined text-[17px]">text_fields</span>
                          </div>
                          <div className="text-xs font-bold text-slate-800">Add Paragraph</div>
                          <div className="text-[10px] text-slate-400">Rich text & links</div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const newB = createBlock("table");
                            setBlocks([newB]);
                            setSelectedBlockId(newB.id);
                          }}
                          className="p-3 bg-white hover:bg-slate-50 border border-slate-200 hover:border-emerald-500 rounded-xl text-left transition-all group shadow-2xs cursor-pointer"
                        >
                          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                            <span className="material-symbols-outlined text-[17px]">table_chart</span>
                          </div>
                          <div className="text-xs font-bold text-slate-800">Loan Table</div>
                          <div className="text-[10px] text-slate-400">Rates & terms grid</div>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => applyTemplate("education_guide")}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-xs font-bold hover:from-indigo-700 hover:to-purple-700 shadow-md cursor-pointer transition-all"
                      >
                        <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                        <span>Load Education Guide Starter Kit</span>
                      </button>
                    </div>
                  ) : (
                    blocks.map((block, index) => {
                      const isSelected = selectedBlockId === block.id;
                      const hasLink = !!(block.url || block.link);

                      return (
                        <React.Fragment key={block.id}>
                          {dragOverIndex === index && (
                            <div className="h-2 bg-[#E21B5A] rounded-full animate-pulse my-1" />
                          )}

                          <div
                            draggable={viewMode === "edit"}
                            onClick={() => {
                              setSelectedBlockId(block.id);
                              setElementorInspectorTab("style");
                            }}
                            onDragStart={(e) => handleBlockDragStart(e, block.id)}
                            onDragEnd={handleBlockDragEnd}
                            onDragOver={(e) => handleCanvasDragOver(e, index)}
                            onDrop={(e) => handleCanvasDrop(e, index)}
                            className={`group relative rounded-xl p-3 transition-all cursor-pointer ${
                              isSelected
                                ? "ring-2 ring-[#E21B5A] ring-offset-2 bg-rose-50/10 shadow-sm"
                                : "hover:ring-1 hover:ring-slate-300"
                            }`}
                            style={{
                              color: block.style?.color || "#1e293b",
                              backgroundColor: block.style?.backgroundColor || "transparent",
                              textAlign: block.style?.textAlign || "left",
                              fontSize: block.style?.fontSize,
                              fontWeight: block.style?.fontWeight,
                              borderRadius: block.style?.borderRadius,
                              padding: block.style?.padding,
                              width: block.style?.width || "100%",
                              maxWidth: block.style?.maxWidth || "100%",
                              height: block.style?.height || "auto",
                              minHeight: block.style?.minHeight || "auto",
                              margin: block.style?.margin || (block.style?.textAlign === "center" ? "0 auto" : block.style?.textAlign === "right" ? "0 0 0 auto" : "0 auto 0 0"),
                            }}
                          >
                            {/* Hover Elementor Handle Badge */}
                            {viewMode === "edit" && (
                              <div className="absolute -top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm flex items-center gap-1 z-10 cursor-grab">
                                <span className="material-symbols-outlined text-[12px]">drag_indicator</span>
                                #{index + 1} {block.type}
                              </div>
                            )}

                            {/* Active Link Pill Indicator on Block */}
                            {hasLink && (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedBlockId(block.id);
                                  setLinkInspectorOpen(true);
                                }}
                                className="absolute -top-3 right-3 bg-indigo-600 text-white text-[9px] font-mono font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1 z-10 cursor-pointer hover:bg-indigo-700"
                                title="Click to edit link destination"
                              >
                                <span className="material-symbols-outlined text-[11px]">link</span>
                                {block.url || block.link} {block.openInNewTab ? "↗" : ""}
                              </div>
                            )}

                            {/* BLOCK TYPE: HEADING */}
                            {block.type === "heading" ? (
                              <div className="w-full">
                                <input
                                  type="text"
                                  value={block.content}
                                  onChange={(e) => updateBlockContent(block.id, e.target.value)}
                                  className={`w-full bg-transparent border-none focus:outline-none placeholder:text-slate-300 transition-all ${
                                    (block.level || 2) === 1
                                      ? "text-2xl md:text-3xl font-black"
                                      : (block.level || 2) === 2
                                      ? "text-xl md:text-2xl font-extrabold"
                                      : (block.level || 2) === 3
                                      ? "text-lg md:text-xl font-bold"
                                      : (block.level || 2) === 4
                                      ? "text-base font-bold text-slate-800"
                                      : (block.level || 2) === 5
                                      ? "text-sm font-semibold text-slate-800"
                                      : "text-xs font-semibold text-slate-700 uppercase tracking-wider"
                                  }`}
                                  style={{
                                    fontSize: block.style?.fontSize,
                                    fontWeight: block.style?.fontWeight,
                                    color: block.style?.color,
                                    textAlign: block.style?.textAlign,
                                  }}
                                  placeholder={`Enter Heading ${block.level || 2} text...`}
                                />
                              </div>
                            ) : /* BLOCK TYPE: DEDICATED HYPERLINK WIDGET */
                            block.type === "link" ? (
                              <div className="p-3 my-1 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 flex-1">
                                  <span className="material-symbols-outlined text-indigo-600">link</span>
                                  <input
                                    type="text"
                                    value={block.content}
                                    onChange={(e) => updateBlockContent(block.id, e.target.value)}
                                    className="font-bold text-indigo-700 hover:underline bg-transparent border-none focus:outline-none flex-1 text-sm"
                                    placeholder="Anchor link label..."
                                  />
                                </div>
                                <span className="text-xs font-mono font-bold text-indigo-500 bg-white px-2 py-0.5 rounded border border-indigo-200">
                                  {block.url || "/apply"} &rarr;
                                </span>
                              </div>
                            ) : /* BLOCK TYPE: DEDICATED TAGS / TOPICS WIDGET */
                            block.type === "tags" ? (
                              <div className="p-4 my-2 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
                                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2 flex-wrap gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[18px] text-[#E21B5A]">label</span>
                                    <input
                                      type="text"
                                      value={block.title || "Related Topics & Keywords"}
                                      onChange={(e) => updateBlockData(block.id, { title: e.target.value })}
                                      className="font-black text-xs text-slate-800 bg-transparent border-none focus:outline-none"
                                      placeholder="Widget Title (e.g. Tags & Topics)..."
                                    />
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[10px]">
                                    <span className="text-slate-400 font-semibold font-mono">{(block.tags || []).length} tags</span>
                                  </div>
                                </div>

                                {/* Interactive Tag Pills */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  {(block.tags || []).map((tag, tagIdx) => (
                                    <span
                                      key={tag + tagIdx}
                                      className="inline-flex items-center gap-1 px-3 py-1 bg-white hover:bg-slate-100 text-slate-800 rounded-full text-xs font-bold border border-slate-200 shadow-2xs transition-all group/tag"
                                    >
                                      <span className="text-indigo-600 font-black">#</span>
                                      <span>{tag}</span>
                                      <button
                                        type="button"
                                        onClick={() => removeBlockTag(block.id, tag)}
                                        className="w-3.5 h-3.5 rounded-full hover:bg-rose-500 hover:text-white flex items-center justify-center text-[10px] text-slate-400 transition-colors cursor-pointer ml-0.5"
                                        title="Remove tag"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ))}

                                  {/* Add new tag inline */}
                                  <div className="inline-flex items-center gap-1 bg-white border border-dashed border-slate-300 rounded-full px-2.5 py-0.5 focus-within:border-indigo-500">
                                    <span className="text-indigo-400 text-xs font-bold">#</span>
                                    <input
                                      type="text"
                                      placeholder="Add tag & Enter..."
                                      className="bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none w-28 py-0.5"
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === ",") {
                                          e.preventDefault();
                                          const val = e.currentTarget.value.trim();
                                          if (val) {
                                            addBlockTag(block.id, val);
                                            e.currentTarget.value = "";
                                          }
                                        }
                                      }}
                                    />
                                  </div>
                                </div>

                                {/* Popular Tag Suggestions */}
                                <div className="pt-1 flex items-center gap-1.5 text-[10px] text-slate-500 flex-wrap">
                                  <span className="font-bold text-[9px] uppercase tracking-wider text-slate-400">Suggestions:</span>
                                  {[
                                    "iPhoneAir",
                                    "AppleIndia",
                                    "AmazonDeals",
                                    "PriceDrop",
                                    "TechNews",
                                    "EducationLoan",
                                    "StudyAbroad",
                                    "Smartphones2026",
                                  ].map((preset) => {
                                    const hasIt = (block.tags || []).includes(preset);
                                    return (
                                      <button
                                        key={preset}
                                        type="button"
                                        onClick={() => (hasIt ? removeBlockTag(block.id, preset) : addBlockTag(block.id, preset))}
                                        className={`px-2 py-0.5 rounded-md font-semibold text-[10px] transition-all cursor-pointer ${
                                          hasIt
                                            ? "bg-indigo-100 text-indigo-700 border border-indigo-300"
                                            : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
                                        }`}
                                      >
                                        {hasIt ? "✓" : "+"} #{preset}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : /* BLOCK TYPE: BUTTON WITH LINK (FULLY DYNAMIC) */
                            block.type === "button" ? (
                              <div className="my-2 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                                  <input
                                    type="text"
                                    value={block.content || ""}
                                    onChange={(e) => updateBlockContent(block.id, e.target.value)}
                                    placeholder="Button Label (e.g. Check Live Deal on Amazon)..."
                                    className="flex-1 font-bold text-xs text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500"
                                  />
                                  <input
                                    type="text"
                                    value={block.url || ""}
                                    onChange={(e) => updateBlockData(block.id, { url: e.target.value, link: e.target.value })}
                                    placeholder="https://... or /apply"
                                    className="w-full sm:w-48 font-mono text-xs text-indigo-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
                                  />
                                </div>
                                <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
                                  <div className="flex items-center gap-2">
                                    <label className="flex items-center gap-1 font-medium text-slate-600 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={block.openInNewTab !== false}
                                        onChange={(e) => updateBlockData(block.id, { openInNewTab: e.target.checked })}
                                        className="rounded text-indigo-600 cursor-pointer"
                                      />
                                      <span>Open in new tab (↗)</span>
                                    </label>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-slate-400 font-bold uppercase text-[9px]">Style:</span>
                                    {[
                                      { key: "gradient", label: "Gradient", cls: "bg-gradient-to-r from-indigo-600 to-purple-600 text-white" },
                                      { key: "deal", label: "Deal Flash", cls: "bg-gradient-to-r from-[#E21B5A] to-rose-600 text-white" },
                                      { key: "emerald", label: "Emerald", cls: "bg-emerald-600 text-white" },
                                      { key: "outline", label: "Outline", cls: "border-2 border-indigo-600 text-indigo-600 bg-transparent" },
                                    ].map((st) => (
                                      <button
                                        key={st.key}
                                        type="button"
                                        onClick={() => updateBlockData(block.id, { linkStyle: st.key as any })}
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all ${
                                          (block.linkStyle || "gradient") === st.key ? "ring-2 ring-indigo-500 font-black shadow-2xs" : "opacity-70 hover:opacity-100"
                                        } ${st.cls}`}
                                      >
                                        {st.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                {/* Live Preview of the Button */}
                                <div className="pt-1 flex items-center justify-start">
                                  <a
                                    href={block.url || "#"}
                                    target={block.openInNewTab !== false ? "_blank" : "_self"}
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.preventDefault()}
                                    className={`px-6 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all inline-flex items-center gap-1.5 cursor-pointer ${
                                      block.linkStyle === "deal"
                                        ? "bg-gradient-to-r from-[#E21B5A] to-rose-600 text-white hover:from-rose-600 hover:to-rose-700"
                                        : block.linkStyle === "emerald"
                                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                        : block.linkStyle === "outline"
                                        ? "border-2 border-indigo-600 text-indigo-600 bg-white hover:bg-indigo-50"
                                        : "bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700"
                                    }`}
                                  >
                                    <span>{block.content || "Click Here"}</span>
                                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                                  </a>
                                </div>
                              </div>
                            ) : /* BLOCK TYPE: CALL TO ACTION (CTA CARD) */
                            block.type === "cta" ? (
                              <div className="p-6 my-2 bg-gradient-to-r from-indigo-50 via-purple-50 to-rose-50 border border-indigo-200 rounded-2xl shadow-xs space-y-3">
                                <input
                                  type="text"
                                  value={block.title || "Ready to Apply?"}
                                  onChange={(e) => updateBlockData(block.id, { title: e.target.value })}
                                  className="text-lg font-black text-indigo-950 bg-transparent border-none focus:outline-none w-full"
                                  placeholder="CTA Headline..."
                                />
                                <textarea
                                  value={block.content}
                                  onChange={(e) => updateBlockContent(block.id, e.target.value)}
                                  rows={2}
                                  className="w-full text-xs text-slate-600 bg-transparent border-none focus:outline-none resize-y leading-relaxed"
                                  placeholder="CTA Description..."
                                />
                                <div className="flex items-center gap-3 pt-1">
                                  <button
                                    type="button"
                                    className="px-5 py-2.5 bg-indigo-600 text-white font-black text-xs rounded-xl shadow-md cursor-pointer hover:bg-indigo-700"
                                  >
                                    {block.buttonText || "Apply Now &rarr;"}
                                  </button>
                                  <span className="text-[10px] font-mono text-indigo-600 font-semibold">
                                    🔗 {block.url || "/apply"}
                                  </span>
                                </div>
                              </div>
                            ) : /* BLOCK TYPE: NOTICE / ALERT BOX */
                            block.type === "alert" ? (
                              <div className="p-4 my-2 rounded-xl border border-amber-200 bg-amber-50/80 text-amber-950 flex items-start gap-3">
                                <span className="material-symbols-outlined text-amber-600 text-lg shrink-0 mt-0.5">
                                  notification_important
                                </span>
                                <div className="flex-1 space-y-1">
                                  <input
                                    type="text"
                                    value={block.title || "Important Note"}
                                    onChange={(e) => updateBlockData(block.id, { title: e.target.value })}
                                    className="font-black text-xs text-amber-950 bg-transparent border-none focus:outline-none w-full"
                                  />
                                  <textarea
                                    value={block.content}
                                    onChange={(e) => updateBlockContent(block.id, e.target.value)}
                                    rows={2}
                                    className="text-xs text-amber-900 bg-transparent border-none focus:outline-none w-full resize-y"
                                  />
                                </div>
                              </div>
                            ) : /* BLOCK TYPE: IMAGE */
                            block.type === "image" ? (
                              <div
                                className="space-y-2.5"
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const file = e.dataTransfer.files?.[0];
                                  if (file && file.type.startsWith("image/")) {
                                    const reader = new FileReader();
                                    reader.onload = (evt) => {
                                      const dataUrl = evt.target?.result as string;
                                      if (dataUrl) updateBlockContent(block.id, dataUrl);
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              >
                                {block.content ? (
                                  <div className="relative group/img rounded-xl overflow-hidden border border-slate-200 shadow-xs bg-slate-50">
                                    <img
                                      src={block.content}
                                      alt="Blog asset"
                                      className="max-h-80 w-full object-cover rounded-xl"
                                    />
                                    {/* Quick floating actions on hover */}
                                    <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover/img:opacity-100 transition-opacity bg-slate-900/85 backdrop-blur-xs p-1 rounded-xl shadow-lg z-10">
                                      <label
                                        className="px-2 py-1 hover:bg-slate-700 text-white rounded-lg cursor-pointer flex items-center gap-1 text-[11px] font-bold transition-colors"
                                        title="Replace image from file"
                                      >
                                        <span className="material-symbols-outlined text-[14px]">upload_file</span>
                                        <span>Replace</span>
                                        <input
                                          type="file"
                                          accept="image/*"
                                          className="hidden"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                              const reader = new FileReader();
                                              reader.onload = (evt) => {
                                                const dataUrl = evt.target?.result as string;
                                                if (dataUrl) updateBlockContent(block.id, dataUrl);
                                              };
                                              reader.readAsDataURL(file);
                                            }
                                          }}
                                        />
                                      </label>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          updateBlockContent(block.id, "");
                                        }}
                                        className="p-1 hover:bg-rose-600/80 text-white rounded-lg cursor-pointer flex items-center transition-colors"
                                        title="Remove image"
                                      >
                                        <span className="material-symbols-outlined text-[14px]">delete</span>
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  /* Empty Image Dropzone with File Upload & Link Upload */
                                  <div className="p-6 border-2 border-dashed border-rose-300 hover:border-rose-500 rounded-2xl bg-rose-50/20 text-center transition-all">
                                    <div className="w-12 h-12 rounded-xl bg-rose-100 text-[#E21B5A] flex items-center justify-center mx-auto mb-2 shadow-xs">
                                      <span className="material-symbols-outlined text-2xl">image</span>
                                    </div>
                                    <p className="text-xs font-bold text-slate-800">Add Image to Block</p>
                                    <p className="text-[11px] text-slate-400 mb-3">Upload a file from your computer or paste an image link</p>
                                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2 max-w-lg mx-auto">
                                      <label className="w-full sm:w-auto px-4 py-2 bg-[#E21B5A] hover:bg-[#C9134D] text-white text-xs font-bold rounded-xl cursor-pointer shadow-sm flex items-center justify-center gap-1.5 transition-all shrink-0">
                                        <span className="material-symbols-outlined text-[16px]">upload_file</span>
                                        <span>Upload File</span>
                                        <input
                                          type="file"
                                          accept="image/*"
                                          className="hidden"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                              const reader = new FileReader();
                                              reader.onload = (evt) => {
                                                const dataUrl = evt.target?.result as string;
                                                if (dataUrl) updateBlockContent(block.id, dataUrl);
                                              };
                                              reader.readAsDataURL(file);
                                            }
                                          }}
                                        />
                                      </label>
                                      <span className="text-xs text-slate-400 font-semibold">or</span>
                                      <div className="flex items-center gap-1 w-full sm:flex-1">
                                        <input
                                          type="text"
                                          id={`img-url-input-${block.id}`}
                                          placeholder="Paste image URL (https://...)"
                                          className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:border-rose-400"
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                              const val = (e.target as HTMLInputElement).value.trim();
                                              if (val) updateBlockContent(block.id, val);
                                            }
                                          }}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const input = document.getElementById(`img-url-input-${block.id}`) as HTMLInputElement | null;
                                            if (input && input.value.trim()) {
                                              updateBlockContent(block.id, input.value.trim());
                                            }
                                          }}
                                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold cursor-pointer"
                                        >
                                          Apply
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : /* BLOCK TYPE: VIDEO (FILE UPLOAD OR YOUTUBE / VIMEO / LINK) */
                            block.type === "video" ? (
                              <div
                                className="space-y-2.5"
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const file = e.dataTransfer.files?.[0];
                                  if (file && file.type.startsWith("video/")) {
                                    if (file.size > 50 * 1024 * 1024) {
                                      alert("Video exceeds 50MB. For larger videos, please paste a YouTube or Vimeo link.");
                                      return;
                                    }
                                    const reader = new FileReader();
                                    reader.onload = (evt) => {
                                      const dataUrl = evt.target?.result as string;
                                      if (dataUrl) updateBlockContent(block.id, dataUrl);
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              >
                                {(() => {
                                  const parsed = parseVideoSource(block.content);
                                  if (parsed.type === "video" && parsed.src) {
                                    return (
                                      <div className="relative group/vid rounded-xl overflow-hidden border border-slate-200 shadow-xs bg-black">
                                        <video
                                          controls
                                          src={parsed.src}
                                          className="w-full max-h-80 object-contain rounded-xl"
                                        />
                                        <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover/vid:opacity-100 transition-opacity bg-slate-900/85 backdrop-blur-xs p-1 rounded-xl shadow-lg z-10">
                                          <label
                                            className="px-2 py-1 hover:bg-slate-700 text-white rounded-lg cursor-pointer flex items-center gap-1 text-[11px] font-bold transition-colors"
                                            title="Replace video file"
                                          >
                                            <span className="material-symbols-outlined text-[14px]">upload_file</span>
                                            <span>Replace</span>
                                            <input
                                              type="file"
                                              accept="video/*"
                                              className="hidden"
                                              onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                  if (file.size > 50 * 1024 * 1024) {
                                                    alert("Video exceeds 50MB. For larger videos, please paste a YouTube or Vimeo link.");
                                                    return;
                                                  }
                                                  const reader = new FileReader();
                                                  reader.onload = (evt) => {
                                                    const dataUrl = evt.target?.result as string;
                                                    if (dataUrl) updateBlockContent(block.id, dataUrl);
                                                  };
                                                  reader.readAsDataURL(file);
                                                }
                                              }}
                                            />
                                          </label>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              updateBlockContent(block.id, "");
                                            }}
                                            className="p-1 hover:bg-rose-600/80 text-white rounded-lg cursor-pointer flex items-center transition-colors"
                                            title="Remove video"
                                          >
                                            <span className="material-symbols-outlined text-[14px]">delete</span>
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  } else if (parsed.type === "iframe" && parsed.src) {
                                    return (
                                      <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black shadow-xs border border-slate-200 group/vid">
                                        <iframe
                                          src={parsed.src}
                                          className="w-full h-full"
                                          allowFullScreen
                                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        />
                                        <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover/vid:opacity-100 transition-opacity bg-slate-900/85 backdrop-blur-xs p-1 rounded-xl shadow-lg z-10">
                                          <label
                                            className="px-2 py-1 hover:bg-slate-700 text-white rounded-lg cursor-pointer flex items-center gap-1 text-[11px] font-bold transition-colors"
                                            title="Upload video from file"
                                          >
                                            <span className="material-symbols-outlined text-[14px]">upload_file</span>
                                            <span>Upload File</span>
                                            <input
                                              type="file"
                                              accept="video/*"
                                              className="hidden"
                                              onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                  if (file.size > 50 * 1024 * 1024) {
                                                    alert("Video exceeds 50MB. For larger videos, please paste a YouTube or Vimeo link.");
                                                    return;
                                                  }
                                                  const reader = new FileReader();
                                                  reader.onload = (evt) => {
                                                    const dataUrl = evt.target?.result as string;
                                                    if (dataUrl) updateBlockContent(block.id, dataUrl);
                                                  };
                                                  reader.readAsDataURL(file);
                                                }
                                              }}
                                            />
                                          </label>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              updateBlockContent(block.id, "");
                                            }}
                                            className="p-1 hover:bg-rose-600/80 text-white rounded-lg cursor-pointer flex items-center transition-colors"
                                            title="Remove video"
                                          >
                                            <span className="material-symbols-outlined text-[14px]">delete</span>
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  } else {
                                    /* Empty Video Dropzone */
                                    return (
                                      <div className="p-6 border-2 border-dashed border-indigo-300 hover:border-indigo-500 rounded-2xl bg-indigo-50/20 text-center transition-all">
                                        <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-2 shadow-xs">
                                          <span className="material-symbols-outlined text-2xl">videocam</span>
                                        </div>
                                        <p className="text-xs font-bold text-slate-800">Add Video to Block</p>
                                        <p className="text-[11px] text-slate-400 mb-3">Upload a video file from your computer or paste a video link</p>
                                        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 max-w-lg mx-auto">
                                          <label className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-sm flex items-center justify-center gap-1.5 transition-all shrink-0">
                                            <span className="material-symbols-outlined text-[16px]">upload_file</span>
                                            <span>Upload Video File</span>
                                            <input
                                              type="file"
                                              accept="video/*"
                                              className="hidden"
                                              onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                  if (file.size > 50 * 1024 * 1024) {
                                                    alert("Video exceeds 50MB. For larger videos, please paste a YouTube or Vimeo link.");
                                                    return;
                                                  }
                                                  const reader = new FileReader();
                                                  reader.onload = (evt) => {
                                                    const dataUrl = evt.target?.result as string;
                                                    if (dataUrl) updateBlockContent(block.id, dataUrl);
                                                  };
                                                  reader.readAsDataURL(file);
                                                }
                                              }}
                                            />
                                          </label>
                                          <span className="text-xs text-slate-400 font-semibold">or</span>
                                          <div className="flex items-center gap-1 w-full sm:flex-1">
                                            <input
                                              type="text"
                                              id={`vid-url-input-${block.id}`}
                                              placeholder="YouTube / Vimeo / MP4 URL"
                                              className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-400"
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                  const val = (e.target as HTMLInputElement).value.trim();
                                                  if (val) updateBlockContent(block.id, val);
                                                }
                                              }}
                                            />
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const input = document.getElementById(`vid-url-input-${block.id}`) as HTMLInputElement | null;
                                                if (input && input.value.trim()) {
                                                  updateBlockContent(block.id, input.value.trim());
                                                }
                                              }}
                                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold cursor-pointer"
                                            >
                                              Apply
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  }
                                })()}
                              </div>
                            ) : /* BLOCK TYPE: DIVIDER */
                            block.type === "divider" ? (
                              <hr className="border-t-2 border-slate-300 my-2" />
                            ) : /* BLOCK TYPE: BLOCKQUOTE */
                            block.type === "quote" ? (
                              <div className="border-l-4 border-[#E21B5A] pl-4 py-2 bg-rose-50/30 rounded-r-xl my-2">
                                <textarea
                                  value={block.content}
                                  onChange={(e) => updateBlockContent(block.id, e.target.value)}
                                  rows={2}
                                  className="w-full font-semibold italic text-slate-900 bg-transparent border-none focus:outline-none resize-y text-sm"
                                />
                              </div>
                            ) : /* BLOCK TYPE: CODE */
                            block.type === "code" ? (
                              <div className="bg-slate-900 text-emerald-400 p-3.5 rounded-xl font-mono text-xs my-2">
                                <textarea
                                  value={block.content}
                                  onChange={(e) => updateBlockContent(block.id, e.target.value)}
                                  rows={3}
                                  className="w-full bg-transparent text-emerald-400 border-none focus:outline-none font-mono text-xs resize-y"
                                />
                              </div>
                            ) : /* BLOCK TYPE: SPACER */
                            block.type === "spacer" ? (
                              <div
                                className="py-2 flex items-center justify-center border border-dashed border-slate-300 rounded-lg bg-slate-50/50 text-slate-400 text-xs font-mono select-none"
                                style={{ height: `${Number(block.value) || 32}px` }}
                              >
                                <span className="material-symbols-outlined text-[14px] mr-1">unfold_more</span>
                                Spacer ({block.value || "32"}px)
                              </div>
                            ) : /* BLOCK TYPE: READ MORE */
                            block.type === "read_more" ? (
                              <div className="my-3 flex items-center gap-3 select-none">
                                <div className="flex-1 border-t-2 border-dashed border-rose-300" />
                                <span className="px-3 py-1 bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-black uppercase tracking-wider rounded-full shadow-2xs flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[13px]">read_more</span>
                                  Read More Archive Cut-off
                                </span>
                                <div className="flex-1 border-t-2 border-dashed border-rose-300" />
                              </div>
                            ) : /* BLOCK TYPE: IMAGE BOX */
                            block.type === "image_box" ? (
                              <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
                                {block.url ? (
                                  <div className="relative rounded-xl overflow-hidden max-h-56 bg-slate-100 border border-slate-200">
                                    <img src={block.url} alt={block.title || "Image Box"} className="w-full h-full object-cover" />
                                    <button
                                      type="button"
                                      onClick={() => updateBlockData(block.id, { url: "" })}
                                      className="absolute top-2 right-2 p-1 bg-slate-900/80 hover:bg-rose-600 text-white rounded-lg text-xs"
                                    >
                                      <span className="material-symbols-outlined text-xs">close</span>
                                    </button>
                                  </div>
                                ) : (
                                  <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl text-center">
                                    <label className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer flex items-center justify-center gap-1">
                                      <span className="material-symbols-outlined text-[16px]">upload_file</span>
                                      Choose Image File or Enter URL
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                          const f = e.target.files?.[0];
                                          if (f) {
                                            const r = new FileReader();
                                            r.onload = (ev) => updateBlockData(block.id, { url: ev.target?.result as string });
                                            r.readAsDataURL(f);
                                          }
                                        }}
                                      />
                                    </label>
                                  </div>
                                )}
                                <input
                                  type="text"
                                  value={block.title || ""}
                                  onChange={(e) => updateBlockData(block.id, { title: e.target.value })}
                                  placeholder="Image Box Title..."
                                  className="text-base font-bold text-slate-900 bg-transparent border-none focus:outline-none w-full"
                                />
                                <textarea
                                  value={block.content}
                                  onChange={(e) => updateBlockContent(block.id, e.target.value)}
                                  rows={2}
                                  placeholder="Image Box Description text..."
                                  className="text-xs text-slate-600 bg-transparent border-none focus:outline-none w-full resize-y"
                                />
                              </div>
                            ) : /* BLOCK TYPE: TESTIMONIAL */
                            block.type === "testimonial" ? (
                              <div className="p-5 bg-gradient-to-br from-purple-50/50 to-indigo-50/40 border border-purple-100 rounded-2xl space-y-3 shadow-xs">
                                <div className="flex items-center gap-1 text-amber-400">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <span key={star} className="material-symbols-outlined text-lg fill-current">star</span>
                                  ))}
                                </div>
                                <textarea
                                  value={block.content}
                                  onChange={(e) => updateBlockContent(block.id, e.target.value)}
                                  rows={3}
                                  placeholder="Customer testimonial quote..."
                                  className="w-full text-xs font-medium text-slate-700 italic bg-transparent border-none focus:outline-none resize-y leading-relaxed"
                                />
                                <div className="flex items-center gap-3 pt-2 border-t border-purple-100/80">
                                  <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                                    {(block.title || "A")[0]}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <input
                                      type="text"
                                      value={block.title || ""}
                                      onChange={(e) => updateBlockData(block.id, { title: e.target.value })}
                                      placeholder="Student / Reviewer Name..."
                                      className="text-xs font-bold text-slate-900 bg-transparent border-none focus:outline-none w-full"
                                    />
                                    <input
                                      type="text"
                                      value={block.subtitle || ""}
                                      onChange={(e) => updateBlockData(block.id, { subtitle: e.target.value })}
                                      placeholder="Program / University (e.g. MS in CS, Columbia)..."
                                      className="text-[11px] text-slate-500 bg-transparent border-none focus:outline-none w-full"
                                    />
                                  </div>
                                </div>
                              </div>
                            ) : /* BLOCK TYPE: ICON */
                            block.type === "icon" ? (
                              <div className="p-4 my-1 flex flex-col items-center justify-center text-center space-y-2 bg-slate-50/60 border border-slate-200/80 rounded-2xl">
                                <span className="material-symbols-outlined text-4xl text-[#E21B5A]">
                                  {block.iconName || "verified_user"}
                                </span>
                                <input
                                  type="text"
                                  value={block.title || ""}
                                  onChange={(e) => updateBlockData(block.id, { title: e.target.value })}
                                  placeholder="Icon Title / Description..."
                                  className="text-xs font-bold text-slate-800 text-center bg-transparent border-none focus:outline-none w-full"
                                />
                                </div>
                            ) : /* BLOCK TYPE: ICON BOX */
                            block.type === "icon_box" ? (
                              <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs flex items-start gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                                  <span className="material-symbols-outlined text-2xl">{block.iconName || "account_balance"}</span>
                                </div>
                                <div className="flex-1 space-y-1">
                                  <input
                                    type="text"
                                    value={block.title || ""}
                                    onChange={(e) => updateBlockData(block.id, { title: e.target.value })}
                                    placeholder="Icon Box Heading..."
                                    className="text-sm font-bold text-slate-900 bg-transparent border-none focus:outline-none w-full"
                                  />
                                  <textarea
                                    value={block.content}
                                    onChange={(e) => updateBlockContent(block.id, e.target.value)}
                                    rows={2}
                                    placeholder="Icon Box description..."
                                    className="text-xs text-slate-600 bg-transparent border-none focus:outline-none w-full resize-y"
                                  />
                                </div>
                              </div>
                            ) : /* BLOCK TYPE: SOCIAL ICONS (DYNAMIC) */
                            block.type === "social_icons" ? (
                              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                                  <input
                                    type="text"
                                    value={block.title || "Follow Us & Share"}
                                    onChange={(e) => updateBlockData(block.id, { title: e.target.value })}
                                    className="text-xs font-bold text-slate-800 bg-transparent border-none focus:outline-none"
                                    placeholder="Section Title..."
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = [...(block.items || []), { id: Date.now().toString(), title: "X (Twitter)", url: "https://x.com", icon: "share" }];
                                      updateBlockData(block.id, { items: next });
                                    }}
                                    className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                  >
                                    + Add Platform
                                  </button>
                                </div>
                                <div className="space-y-2">
                                  {(block.items || [
                                    { id: "1", title: "X (Twitter)", url: "https://x.com", icon: "share" },
                                    { id: "2", title: "LinkedIn", url: "https://linkedin.com", icon: "share" }
                                  ]).map((item, i) => (
                                    <div key={item.id || i} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
                                      <span className="material-symbols-outlined text-[16px] text-indigo-600 shrink-0">{item.icon || "share"}</span>
                                      <input
                                        type="text"
                                        value={item.title}
                                        onChange={(e) => {
                                          const next = [...(block.items || [])];
                                          next[i] = { ...next[i], title: e.target.value };
                                          updateBlockData(block.id, { items: next });
                                        }}
                                        className="font-bold text-xs text-slate-800 bg-transparent border-none focus:outline-none w-28"
                                        placeholder="Platform Name..."
                                      />
                                      <input
                                        type="text"
                                        value={item.url || ""}
                                        onChange={(e) => {
                                          const next = [...(block.items || [])];
                                          next[i] = { ...next[i], url: e.target.value };
                                          updateBlockData(block.id, { items: next });
                                        }}
                                        className="flex-1 font-mono text-[11px] text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-100 focus:outline-none"
                                        placeholder="Profile or Page URL..."
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const next = (block.items || []).filter((_, idx) => idx !== i);
                                          updateBlockData(block.id, { items: next });
                                        }}
                                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                                      >
                                        <span className="material-symbols-outlined text-[14px]">close</span>
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : /* BLOCK TYPE: IMAGE GALLERY */
                            block.type === "image_gallery" ? (
                              <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-3">
                                <div className="flex items-center justify-between">
                                  <input
                                    type="text"
                                    value={block.title || "Image Gallery"}
                                    onChange={(e) => updateBlockData(block.id, { title: e.target.value })}
                                    className="text-xs font-bold text-slate-800 bg-transparent border-none focus:outline-none"
                                  />
                                  <label className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[14px]">add_photo_alternate</span>
                                    Add Photo
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          const reader = new FileReader();
                                          reader.onload = (evt) => {
                                            const url = evt.target?.result as string;
                                            if (url) {
                                              const newItems = [...(block.items || []), { id: Date.now().toString(), title: "Photo", url }];
                                              updateBlockData(block.id, { items: newItems });
                                            }
                                          };
                                          reader.readAsDataURL(file);
                                        }
                                      }}
                                    />
                                  </label>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                                  {(block.items || []).map((it, i) => (
                                    <div key={it.id || i} className="relative group/gal rounded-xl overflow-hidden aspect-4/3 bg-slate-200">
                                      <img src={it.url} alt={it.title} className="w-full h-full object-cover" />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updated = (block.items || []).filter((_, idx) => idx !== i);
                                          updateBlockData(block.id, { items: updated });
                                        }}
                                        className="absolute top-1.5 right-1.5 p-1 bg-slate-900/80 text-white rounded-md opacity-0 group-hover/gal:opacity-100 transition-opacity"
                                      >
                                        <span className="material-symbols-outlined text-xs">close</span>
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : /* BLOCK TYPE: IMAGE CAROUSEL (FULLY DYNAMIC) */
                            block.type === "image_carousel" ? (
                              <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3 shadow-md">
                                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                                  <div className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[16px] text-rose-400">view_carousel</span>
                                    <input
                                      type="text"
                                      value={block.title || "Rotating Image Carousel"}
                                      onChange={(e) => updateBlockData(block.id, { title: e.target.value })}
                                      className="font-bold text-xs text-white bg-transparent border-none focus:outline-none"
                                    />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const curItems = block.items && block.items.length > 0 ? block.items : [{ id: "1", title: "Slide 1", content: "Details", url: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=800" }];
                                        const next = [...curItems, { id: Date.now().toString(), title: `Slide ${curItems.length + 1}`, content: "Description", url: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=800" }];
                                        updateBlockData(block.id, { items: next, activeSlideIndex: next.length - 1 });
                                      }}
                                      className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold cursor-pointer"
                                    >
                                      + Add Slide
                                    </button>
                                  </div>
                                </div>

                                {(() => {
                                  const slides = (block.items && block.items.length > 0) ? block.items : [
                                    { id: "1", title: "Global Campus View", content: "World-class university infrastructure", url: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=800" },
                                    { id: "2", title: "Advanced Research Labs", content: "Cutting edge technology facilities", url: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=800" }
                                  ];
                                  const curIdx = Math.min(Math.max(0, block.activeSlideIndex || 0), slides.length - 1);
                                  const curSlide = slides[curIdx];

                                  return (
                                    <div className="space-y-3">
                                      <div className="relative rounded-xl overflow-hidden aspect-21/9 bg-slate-800">
                                        <img src={curSlide.url} alt={curSlide.title} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent flex items-end justify-between p-4">
                                          <div className="flex-1 mr-4">
                                            <input
                                              type="text"
                                              value={curSlide.title}
                                              onChange={(e) => {
                                                const next = [...slides];
                                                next[curIdx] = { ...next[curIdx], title: e.target.value };
                                                updateBlockData(block.id, { items: next });
                                              }}
                                              className="text-sm font-bold text-white bg-transparent border-none focus:outline-none w-full mb-1"
                                              placeholder="Slide Headline..."
                                            />
                                            <input
                                              type="text"
                                              value={curSlide.content || ""}
                                              onChange={(e) => {
                                                const next = [...slides];
                                                next[curIdx] = { ...next[curIdx], content: e.target.value };
                                                updateBlockData(block.id, { items: next });
                                              }}
                                              className="text-xs text-slate-300 bg-transparent border-none focus:outline-none w-full"
                                              placeholder="Slide Subtitle..."
                                            />
                                          </div>
                                          {/* Slide Controls */}
                                          <div className="flex items-center gap-1.5 shrink-0 bg-black/40 backdrop-blur-xs p-1 rounded-xl">
                                            <button
                                              type="button"
                                              onClick={() => updateBlockData(block.id, { activeSlideIndex: (curIdx - 1 + slides.length) % slides.length })}
                                              className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/40 flex items-center justify-center cursor-pointer transition-colors"
                                              title="Previous Slide"
                                            >
                                              <span className="material-symbols-outlined text-sm">arrow_back</span>
                                            </button>
                                            <span className="text-[10px] font-mono px-1 font-bold">{curIdx + 1} / {slides.length}</span>
                                            <button
                                              type="button"
                                              onClick={() => updateBlockData(block.id, { activeSlideIndex: (curIdx + 1) % slides.length })}
                                              className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/40 flex items-center justify-center cursor-pointer transition-colors"
                                              title="Next Slide"
                                            >
                                              <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                            </button>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Slide Image URL & Delete controls */}
                                      <div className="flex items-center gap-2 text-xs">
                                        <input
                                          type="text"
                                          value={curSlide.url}
                                          onChange={(e) => {
                                            const next = [...slides];
                                            next[curIdx] = { ...next[curIdx], url: e.target.value };
                                            updateBlockData(block.id, { items: next });
                                          }}
                                          className="flex-1 font-mono text-[11px] px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 focus:outline-none"
                                          placeholder="Image URL for this slide..."
                                        />
                                        {slides.length > 1 && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const next = slides.filter((_, i) => i !== curIdx);
                                              updateBlockData(block.id, { items: next, activeSlideIndex: Math.max(0, curIdx - 1) });
                                            }}
                                            className="px-2 py-1 bg-rose-600/30 hover:bg-rose-600 text-rose-200 hover:text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                                          >
                                            Delete Slide
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            ) : /* BLOCK TYPE: ICON LIST */
                            block.type === "icon_list" ? (
                              <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2">
                                <input
                                  type="text"
                                  value={block.title || "Key Highlights"}
                                  onChange={(e) => updateBlockData(block.id, { title: e.target.value })}
                                  className="text-xs font-bold text-slate-700 bg-transparent border-none focus:outline-none"
                                />
                                <div className="space-y-1.5">
                                  {(block.items || []).map((it, i) => (
                                    <div key={it.id || i} className="flex items-center gap-2 text-xs text-slate-700 font-medium">
                                      <span className="material-symbols-outlined text-[16px] text-emerald-600 shrink-0">
                                        {it.icon || "check_circle"}
                                      </span>
                                      <input
                                        type="text"
                                        value={it.title}
                                        onChange={(e) => {
                                          const nextItems = [...(block.items || [])];
                                          nextItems[i] = { ...nextItems[i], title: e.target.value };
                                          updateBlockData(block.id, { items: nextItems });
                                        }}
                                        className="flex-1 bg-transparent border-none focus:outline-none text-xs text-slate-800"
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : /* BLOCK TYPE: COUNTER */
                            block.type === "counter" ? (
                              <div className="p-5 bg-gradient-to-br from-indigo-50 to-slate-50 border border-indigo-200 rounded-2xl text-center space-y-1">
                                <div className="text-3xl md:text-4xl font-black text-indigo-700 font-mono tracking-tight flex items-center justify-center gap-0.5">
                                  <span>{block.prefix || ""}</span>
                                  <input
                                    type="text"
                                    value={block.value !== undefined ? String(block.value) : "75"}
                                    onChange={(e) => updateBlockData(block.id, { value: e.target.value })}
                                    className="w-20 text-center font-black bg-transparent border-none focus:outline-none text-indigo-700"
                                  />
                                  <span>{block.suffix || ""}</span>
                                </div>
                                <input
                                  type="text"
                                  value={block.title || "Counter Metric"}
                                  onChange={(e) => updateBlockData(block.id, { title: e.target.value })}
                                  className="text-xs font-bold text-slate-700 text-center bg-transparent border-none focus:outline-none w-full"
                                />
                              </div>
                            ) : /* BLOCK TYPE: PROGRESS BAR */
                            block.type === "progress_bar" ? (
                              <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2">
                                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                                  <input
                                    type="text"
                                    value={block.title || "Approval Rate"}
                                    onChange={(e) => updateBlockData(block.id, { title: e.target.value })}
                                    className="bg-transparent border-none focus:outline-none font-bold"
                                  />
                                  <span className="font-mono text-indigo-600">{block.value || 94}%</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                                  <div
                                    className="bg-gradient-to-r from-indigo-600 to-[#E21B5A] h-full rounded-full transition-all"
                                    style={{ width: `${Math.min(100, Math.max(0, Number(block.value) || 94))}%` }}
                                  />
                                </div>
                                {isSelected && (
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={Number(block.value) || 94}
                                    onChange={(e) => updateBlockData(block.id, { value: Number(e.target.value) })}
                                    className="w-full accent-indigo-600 cursor-pointer"
                                  />
                                )}
                              </div>
                            ) : /* BLOCK TYPE: NESTED TABS (FULLY DYNAMIC) */
                            block.type === "nested_tabs" ? (
                              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                                {(() => {
                                  const tabs = (block.items && block.items.length > 0) ? block.items : [
                                    { id: "1", title: "Overview", content: "Comprehensive overview of the deal structure and bank rate terms." },
                                    { id: "2", title: "Eligibility", content: "Minimum qualification, co-applicant documentation and approval process." }
                                  ];
                                  const activeIdx = Math.min(Math.max(0, Number(block.value) || 0), tabs.length - 1);

                                  return (
                                    <>
                                      <div className="flex items-center justify-between border-b border-slate-200 pb-2 gap-2 flex-wrap">
                                        <div className="flex items-center gap-1.5 overflow-x-auto flex-1">
                                          {tabs.map((tab, idx) => (
                                            <button
                                              key={tab.id || idx}
                                              type="button"
                                              onClick={() => updateBlockData(block.id, { value: idx, items: tabs })}
                                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                                                activeIdx === idx
                                                  ? "bg-indigo-600 text-white shadow-xs"
                                                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                                              }`}
                                            >
                                              {tab.title}
                                            </button>
                                          ))}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const next = [...tabs, { id: Date.now().toString(), title: `Tab ${tabs.length + 1}`, content: "New tab content..." }];
                                              updateBlockData(block.id, { items: next, value: next.length - 1 });
                                            }}
                                            className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold cursor-pointer"
                                          >
                                            + Add Tab
                                          </button>
                                          {tabs.length > 1 && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const next = tabs.filter((_, i) => i !== activeIdx);
                                                updateBlockData(block.id, { items: next, value: Math.max(0, activeIdx - 1) });
                                              }}
                                              className="px-2 py-1 bg-rose-50 text-rose-600 border border-rose-200 rounded text-[10px] font-bold hover:bg-rose-100 cursor-pointer"
                                            >
                                              Delete Tab
                                            </button>
                                          )}
                                        </div>
                                      </div>

                                      <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                                        <div className="flex items-center gap-2 border-b border-slate-100 pb-1.5">
                                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tab Title:</span>
                                          <input
                                            type="text"
                                            value={tabs[activeIdx]?.title || ""}
                                            onChange={(e) => {
                                              const next = [...tabs];
                                              next[activeIdx] = { ...next[activeIdx], title: e.target.value };
                                              updateBlockData(block.id, { items: next });
                                            }}
                                            className="font-bold text-xs text-indigo-700 bg-transparent border-none focus:outline-none flex-1"
                                          />
                                        </div>
                                        <textarea
                                          value={tabs[activeIdx]?.content || ""}
                                          onChange={(e) => {
                                            const next = [...tabs];
                                            next[activeIdx] = { ...next[activeIdx], content: e.target.value };
                                            updateBlockData(block.id, { items: next });
                                          }}
                                          rows={3}
                                          className="w-full text-xs text-slate-700 bg-transparent border-none focus:outline-none resize-y leading-relaxed"
                                          placeholder="Enter tab description content..."
                                        />
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            ) : /* BLOCK TYPE: NESTED ACCORDION (DYNAMIC) */
                            block.type === "nested_accordion" ? (
                              <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                  <input
                                    type="text"
                                    value={block.title || "Frequently Asked Questions"}
                                    onChange={(e) => updateBlockData(block.id, { title: e.target.value })}
                                    className="text-xs font-bold text-slate-800 bg-transparent border-none focus:outline-none flex-1"
                                    placeholder="Accordion Section Title..."
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const curItems = block.items && block.items.length > 0 ? block.items : [
                                        { id: "1", title: "Is this deal available on all colors?", content: "Yes, standard titanium and silver variants qualify for the instant bank discount." }
                                      ];
                                      const next = [...curItems, { id: Date.now().toString(), title: "New Question / Topic", content: "Detailed explanation or answer..." }];
                                      updateBlockData(block.id, { items: next });
                                    }}
                                    className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold cursor-pointer"
                                  >
                                    + Add Item
                                  </button>
                                </div>
                                <div className="space-y-2">
                                  {((block.items && block.items.length > 0) ? block.items : [
                                    { id: "1", title: "How long is this limited deal active?", content: "The flash pricing is subject to stock quotas on Amazon India and may conclude without advance notice." },
                                    { id: "2", title: "Can I combine credit card discounts with exchange?", content: "Yes, Amazon allows combining select bank card instant discounts with eligible exchange bonuses." }
                                  ]).map((acc, idx) => (
                                    <div key={acc.id || idx} className="border border-slate-200 rounded-xl bg-slate-50/50 p-2.5 space-y-1.5">
                                      <div className="flex items-center justify-between gap-2">
                                        <input
                                          type="text"
                                          value={acc.title}
                                          onChange={(e) => {
                                            const items = block.items || [];
                                            const next = [...items];
                                            next[idx] = { ...next[idx], title: e.target.value };
                                            updateBlockData(block.id, { items: next });
                                          }}
                                          className="font-bold text-xs text-slate-900 bg-transparent border-none focus:outline-none flex-1"
                                          placeholder="Question title..."
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const items = block.items || [];
                                            const next = items.filter((_, i) => i !== idx);
                                            updateBlockData(block.id, { items: next });
                                          }}
                                          className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                                        >
                                          <span className="material-symbols-outlined text-[13px]">close</span>
                                        </button>
                                      </div>
                                      <textarea
                                        value={acc.content || ""}
                                        onChange={(e) => {
                                          const items = block.items || [];
                                          const next = [...items];
                                          next[idx] = { ...next[idx], content: e.target.value };
                                          updateBlockData(block.id, { items: next });
                                        }}
                                        rows={2}
                                        className="w-full bg-white p-2 rounded-lg border border-slate-200 text-xs text-slate-700 resize-y focus:outline-none focus:border-indigo-400"
                                        placeholder="Answer content..."
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : /* BLOCK TYPE: RATING */
                            block.type === "rating" ? (
                              <div className="p-4 bg-amber-50/40 border border-amber-200 rounded-2xl text-center space-y-1">
                                <div className="flex items-center justify-center gap-1 text-amber-500">
                                  {[1, 2, 3, 4, 5].map((s) => (
                                    <span key={s} className="material-symbols-outlined text-2xl fill-current">star</span>
                                  ))}
                                </div>
                                <input
                                  type="text"
                                  value={block.title || "4.9 / 5 Rating"}
                                  onChange={(e) => updateBlockData(block.id, { title: e.target.value })}
                                  className="text-sm font-bold text-slate-900 text-center bg-transparent border-none focus:outline-none w-full"
                                />
                                <input
                                  type="text"
                                  value={block.subtitle || "Based on 12,400+ Verified Student Loan Reviews"}
                                  onChange={(e) => updateBlockData(block.id, { subtitle: e.target.value })}
                                  className="text-xs text-slate-500 text-center bg-transparent border-none focus:outline-none w-full"
                                />
                              </div>
                            ) : /* BLOCK TYPE: HTML */
                            block.type === "html" ? (
                              <div className="p-3 bg-slate-900 rounded-2xl space-y-2 border border-slate-800">
                                <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-400">
                                  <span>&lt;HTML Code /&gt;</span>
                                  <span className="text-[10px] text-emerald-400">Live Embed</span>
                                </div>
                                <textarea
                                  value={block.content}
                                  onChange={(e) => updateBlockContent(block.id, e.target.value)}
                                  rows={3}
                                  className="w-full bg-slate-950 p-2.5 rounded-xl text-emerald-400 font-mono text-xs border border-slate-800 focus:outline-none resize-y"
                                  placeholder="<div>Custom HTML</div>"
                                />
                              </div>
                            ) : /* BLOCK TYPE: SHORTCODE */
                            block.type === "shortcode" ? (
                              <div className="p-3 bg-indigo-50/50 border border-indigo-200 rounded-2xl flex items-center gap-3">
                                <span className="material-symbols-outlined text-indigo-600 text-xl">integration_instructions</span>
                                <input
                                  type="text"
                                  value={block.content}
                                  onChange={(e) => updateBlockContent(block.id, e.target.value)}
                                  placeholder='[plugin_shortcode id="..."]'
                                  className="flex-1 font-mono text-xs font-bold text-indigo-900 bg-transparent border-none focus:outline-none"
                                />
                              </div>
                            ) : /* BLOCK TYPE: MENU ANCHOR */
                            block.type === "menu_anchor" ? (
                              <div className="py-2 px-3 bg-slate-100 border border-dashed border-slate-300 rounded-xl flex items-center gap-2 text-slate-600 text-xs font-mono font-bold select-none">
                                <span className="material-symbols-outlined text-[16px] text-indigo-600">anchor</span>
                                <span>#{block.content || "menu-anchor"}</span>
                              </div>
                            ) : /* BLOCK TYPE: SIDEBAR (DYNAMIC) */
                            block.type === "sidebar" ? (
                              <div className="p-4 bg-gradient-to-br from-indigo-50/60 to-purple-50/40 border border-indigo-200 rounded-2xl space-y-3">
                                <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                                  <div className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-indigo-600 text-[18px]">view_sidebar</span>
                                    <input
                                      type="text"
                                      value={block.title || "Sidebar Callout"}
                                      onChange={(e) => updateBlockData(block.id, { title: e.target.value })}
                                      className="font-black text-xs text-slate-900 bg-transparent border-none focus:outline-none"
                                      placeholder="Sidebar Title..."
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = [...(block.items || []), { id: Date.now().toString(), title: "Live Deal Page", url: "https://amazon.in" }];
                                      updateBlockData(block.id, { items: next });
                                    }}
                                    className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold cursor-pointer"
                                  >
                                    + Add Link
                                  </button>
                                </div>
                                <textarea
                                  value={block.content}
                                  onChange={(e) => updateBlockContent(block.id, e.target.value)}
                                  rows={2}
                                  className="w-full text-xs text-slate-600 bg-white/70 p-2 rounded-xl border border-indigo-100 focus:outline-none resize-y"
                                  placeholder="Sidebar overview or summary note..."
                                />
                                <div className="space-y-1.5">
                                  {(block.items || [
                                    { id: "1", title: "Compare Bank Rates", url: "/banks" },
                                    { id: "2", title: "Calculate Monthly EMI", url: "/emi-calculator" }
                                  ]).map((item, i) => (
                                    <div key={item.id || i} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-indigo-100">
                                      <span className="text-indigo-600 text-xs">🔗</span>
                                      <input
                                        type="text"
                                        value={item.title}
                                        onChange={(e) => {
                                          const next = [...(block.items || [])];
                                          next[i] = { ...next[i], title: e.target.value };
                                          updateBlockData(block.id, { items: next });
                                        }}
                                        className="font-bold text-xs text-slate-800 bg-transparent border-none focus:outline-none flex-1"
                                        placeholder="Link Title..."
                                      />
                                      <input
                                        type="text"
                                        value={item.url || ""}
                                        onChange={(e) => {
                                          const next = [...(block.items || [])];
                                          next[i] = { ...next[i], url: e.target.value };
                                          updateBlockData(block.id, { items: next });
                                        }}
                                        className="font-mono text-[10px] text-indigo-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 w-36 focus:outline-none"
                                        placeholder="URL..."
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const next = (block.items || []).filter((_, idx) => idx !== i);
                                          updateBlockData(block.id, { items: next });
                                        }}
                                        className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                                      >
                                        <span className="material-symbols-outlined text-[13px]">close</span>
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : /* BLOCK TYPE: GOOGLE MAPS */
                            block.type === "google_maps" ? (
                              <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="material-symbols-outlined text-rose-500">map</span>
                                  <input
                                    type="text"
                                    value={block.content}
                                    onChange={(e) => updateBlockContent(block.id, e.target.value)}
                                    placeholder="Location query (e.g. Harvard University, Cambridge, MA)..."
                                    className="text-xs font-bold text-slate-800 flex-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 focus:outline-none"
                                  />
                                </div>
                                <div className="w-full aspect-video rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                                  <iframe
                                    src={`https://maps.google.com/maps?q=${encodeURIComponent(block.content || "London")}&t=&z=13&ie=UTF8&iwloc=&output=embed`}
                                    className="w-full h-full border-0"
                                    loading="lazy"
                                  />
                                </div>
                              </div>
                            ) : /* BLOCK TYPE: SOUNDCLOUD */
                            block.type === "soundcloud" ? (
                              <div className="p-4 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-2xl space-y-2">
                                <div className="flex items-center gap-2 text-orange-600">
                                  <span className="material-symbols-outlined">graphic_eq</span>
                                  <span className="text-xs font-bold">{block.title || "SoundCloud Audio Track"}</span>
                                </div>
                                <input
                                  type="text"
                                  value={block.content}
                                  onChange={(e) => updateBlockContent(block.id, e.target.value)}
                                  placeholder="SoundCloud track URL..."
                                  className="w-full text-xs font-mono px-3 py-1.5 bg-white border border-orange-200 rounded-lg text-slate-800 focus:outline-none"
                                />
                              </div>
                            ) : /* BLOCK TYPE: TEXT PATH */
                            block.type === "text_path" ? (
                              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-2">
                                <svg viewBox="0 0 500 100" className="w-full max-h-24">
                                  <path id={`path-${block.id}`} d="M 10 80 Q 250 10 490 80" fill="transparent" stroke="#E2E8F0" strokeWidth="2" />
                                  <text className="text-xs font-black fill-indigo-600 font-sans tracking-widest">
                                    <textPath href={`#path-${block.id}`} startOffset="50%" textAnchor="middle">
                                      {block.title || "VidyaLoan • Study Abroad • Dream Higher • "}
                                    </textPath>
                                  </text>
                                </svg>
                                <input
                                  type="text"
                                  value={block.title || ""}
                                  onChange={(e) => updateBlockData(block.id, { title: e.target.value })}
                                  placeholder="Curved Path Text..."
                                  className="text-xs font-bold text-slate-800 text-center bg-transparent border-none focus:outline-none w-full"
                                />
                              </div>
                            ) : /* BLOCK TYPE: LINK IN BIO */
                            block.type === "link_bio" ? (
                              <div className="p-6 bg-gradient-to-b from-indigo-50/60 to-purple-50/40 border border-indigo-200 rounded-3xl text-center space-y-4 max-w-md mx-auto">
                                <div className="w-16 h-16 rounded-full bg-indigo-600 text-white flex items-center justify-center mx-auto text-xl font-bold shadow-md">
                                  {(block.title || "V")[0]}
                                </div>
                                <div>
                                  <input
                                    type="text"
                                    value={block.title || "VidyaLoan Advisor"}
                                    onChange={(e) => updateBlockData(block.id, { title: e.target.value })}
                                    className="text-sm font-black text-slate-900 text-center bg-transparent border-none focus:outline-none w-full"
                                  />
                                  <input
                                    type="text"
                                    value={block.subtitle || "Helping students fund studies abroad"}
                                    onChange={(e) => updateBlockData(block.id, { subtitle: e.target.value })}
                                    className="text-[11px] text-slate-500 text-center bg-transparent border-none focus:outline-none w-full"
                                  />
                                </div>
                                <div className="space-y-2">
                                  {(block.items || []).map((item, idx) => (
                                    <div
                                      key={item.id || idx}
                                      className="w-full py-2.5 px-4 bg-white hover:bg-indigo-50 border border-indigo-100 hover:border-indigo-400 rounded-xl text-xs font-bold text-indigo-950 flex items-center justify-between shadow-2xs transition-all"
                                    >
                                      <span>{item.title}</span>
                                      {item.badge && (
                                        <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md">
                                          {item.badge}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : /* BLOCK TYPE: TABLE OF CONTENTS (TOC) */
                            block.type === "table_of_contents" ? (
                              <div className="p-5 bg-gradient-to-br from-slate-50 to-indigo-50/40 rounded-2xl border border-indigo-100 shadow-xs space-y-3">
                                <div className="flex items-center justify-between border-b border-indigo-100/80 pb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-indigo-600 text-lg">toc</span>
                                    <input
                                      type="text"
                                      value={block.title || "Table of Contents"}
                                      onChange={(e) => updateBlockData(block.id, { title: e.target.value })}
                                      className="font-black text-sm text-slate-900 bg-transparent border-none focus:outline-none"
                                      placeholder="TOC Heading..."
                                    />
                                  </div>
                                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                                    Auto-Indexed from H1–H6
                                  </span>
                                </div>

                                {(() => {
                                  const headings = blocks.filter((b) => b.type === "heading" && b.content?.trim());
                                  if (headings.length === 0) {
                                    return (
                                      <div className="py-4 text-center text-slate-400">
                                        <p className="text-xs font-semibold">No headings found yet.</p>
                                        <p className="text-[11px] text-slate-400">
                                          Add H1–H6 heading blocks to your blog to automatically generate chapter links here!
                                        </p>
                                      </div>
                                    );
                                  }

                                  return (
                                    <ul className="space-y-1.5 list-none pl-0">
                                      {headings.map((h, i) => {
                                        const lvl = Number(h.level || 2);
                                        const paddingClass =
                                          lvl === 1 ? "pl-0 font-bold text-slate-900 text-sm" :
                                          lvl === 2 ? "pl-3 font-semibold text-slate-800 text-xs" :
                                          lvl === 3 ? "pl-6 font-medium text-slate-700 text-xs" :
                                          lvl === 4 ? "pl-9 font-medium text-slate-600 text-xs" :
                                          "pl-12 text-slate-500 text-[11px]";
                                        const slug = (h.content || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

                                        return (
                                          <li key={h.id || i} className={`flex items-center gap-2 ${paddingClass}`}>
                                            <span className="text-indigo-400 font-mono text-[10px]">{i + 1}.</span>
                                            <a
                                              href={`#${slug}`}
                                              onClick={(e) => e.preventDefault()}
                                              className="hover:text-indigo-600 hover:underline flex items-center gap-1 flex-1 truncate"
                                            >
                                              <span>{h.content}</span>
                                              <span className="text-[9px] font-mono text-slate-400 bg-slate-100 px-1 rounded">H{lvl}</span>
                                            </a>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  );
                                })()}
                              </div>
                            ) : /* BLOCK TYPE: RESPONSIVE DATA TABLE */
                            block.type === "table" ? (
                              <div className="space-y-2.5">
                                {/* Table Toolbar */}
                                <div className="flex items-center justify-between gap-2 flex-wrap text-xs bg-slate-50 p-2 rounded-xl border border-slate-200">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="material-symbols-outlined text-indigo-600 text-sm">table_chart</span>
                                    <span className="font-bold text-slate-800 text-xs">Table Matrix:</span>
                                    <button
                                      type="button"
                                      onClick={() => addTableRow(block.id)}
                                      className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold text-[10px] cursor-pointer"
                                    >
                                      + Row
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteTableRow(block.id)}
                                      className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded font-bold text-[10px] border border-rose-200 cursor-pointer"
                                    >
                                      - Row
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => addTableColumn(block.id)}
                                      className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold text-[10px] cursor-pointer"
                                    >
                                      + Col
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteTableColumn(block.id)}
                                      className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded font-bold text-[10px] border border-rose-200 cursor-pointer"
                                    >
                                      - Col
                                    </button>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => toggleTableHeader(block.id)}
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                                        block.tableData?.hasHeader !== false
                                          ? "bg-slate-800 text-white"
                                          : "bg-white text-slate-600 border border-slate-200"
                                      }`}
                                    >
                                      Header: {block.tableData?.hasHeader !== false ? "ON" : "OFF"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => toggleTableStriped(block.id)}
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                                        block.tableData?.isStriped
                                          ? "bg-indigo-600 text-white"
                                          : "bg-white text-slate-600 border border-slate-200"
                                      }`}
                                    >
                                      Striped: {block.tableData?.isStriped ? "ON" : "OFF"}
                                    </button>
                                  </div>
                                </div>

                                {/* Table Grid */}
                                <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
                                  <table className="w-full text-left border-collapse">
                                    {block.tableData?.hasHeader !== false && (
                                      <thead className="bg-slate-100 text-slate-800 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                                        <tr>
                                          {(block.tableData?.headers || ["Feature", "Rate", "Details"]).map((h, colIdx) => (
                                            <th key={colIdx} className="p-2 border-r border-slate-200 last:border-r-0">
                                              <input
                                                type="text"
                                                value={h}
                                                onChange={(e) => updateTableHeader(block.id, colIdx, e.target.value)}
                                                className="w-full bg-transparent font-bold text-xs text-slate-900 border-none focus:outline-none"
                                              />
                                            </th>
                                          ))}
                                        </tr>
                                      </thead>
                                    )}
                                    <tbody className="divide-y divide-slate-100">
                                      {(block.tableData?.rows || [
                                        ["Collateral-Free Limit", "Up to ₹75 Lakhs", "Instant pre-approval"],
                                        ["Interest Rate", "From 8.5% p.a.", "Tax benefit under 80E"],
                                      ]).map((row, rowIdx) => (
                                        <tr
                                          key={rowIdx}
                                          className={`${
                                            block.tableData?.isStriped && rowIdx % 2 === 1
                                              ? "bg-slate-50/70"
                                              : "bg-white"
                                          } hover:bg-indigo-50/30 transition-colors`}
                                        >
                                          {row.map((cell, colIdx) => (
                                            <td key={colIdx} className="p-2 border-r border-slate-100 last:border-r-0">
                                              <input
                                                type="text"
                                                value={cell}
                                                onChange={(e) => updateTableCell(block.id, rowIdx, colIdx, e.target.value)}
                                                className="w-full bg-transparent text-xs text-slate-700 border-none focus:outline-none"
                                              />
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            ) : /* BLOCK TYPE: LIST (ORDERED / UNORDERED) */
                            block.type === "list" ? (
                              <div className="space-y-2 p-3 bg-slate-50/60 rounded-xl border border-slate-200">
                                <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2 flex-wrap">
                                  <div className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-indigo-600 text-sm">
                                      {block.listType === "ordered" ? "format_list_numbered" : "format_list_bulleted"}
                                    </span>
                                    <span className="text-xs font-bold text-slate-800">
                                      {block.listType === "ordered" ? "Numbered List (<ol>)" : "Bulleted List (<ul>)"}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => toggleListType(block.id)}
                                      className="px-2 py-0.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded text-[10px] font-bold cursor-pointer transition-colors"
                                    >
                                      Switch to {block.listType === "ordered" ? "Bulleted (•)" : "Numbered (1.)"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => addListItem(block.id)}
                                      className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold cursor-pointer"
                                    >
                                      + Add Item
                                    </button>
                                  </div>
                                </div>

                                <div className="space-y-1.5">
                                  {((block.items && block.items.length > 0)
                                    ? block.items
                                    : (block.content || "First item\nSecond item\nThird item").split("\n").map((s, idx) => ({ id: String(idx), title: s }))
                                  ).map((item, itemIdx) => (
                                    <div key={item.id || itemIdx} className="flex items-center gap-2">
                                      <span className="w-5 text-center font-mono text-xs font-bold text-indigo-600 shrink-0 select-none">
                                        {block.listType === "ordered" ? `${itemIdx + 1}.` : "•"}
                                      </span>
                                      <input
                                        type="text"
                                        value={item.title || ""}
                                        onChange={(e) => updateListItem(block.id, itemIdx, e.target.value)}
                                        className="flex-1 bg-white px-2 py-1 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-indigo-400"
                                        placeholder={`List item ${itemIdx + 1}...`}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => removeListItem(block.id, itemIdx)}
                                        className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                                        title="Delete item"
                                      >
                                        <span className="material-symbols-outlined text-[14px]">close</span>
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              /* DEFAULT: REAL-TIME RICH TEXT & LIVE FORMATTING WYSIWYG EDITOR */
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5 flex-wrap">
                                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                    <button
                                      type="button"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => applyFormatToSelection(block.id, "bold")}
                                      className="px-2 py-0.5 text-xs font-black text-slate-800 hover:bg-white rounded transition-colors cursor-pointer"
                                      title="Bold (Ctrl+B) - Formats selected text"
                                    >
                                      B
                                    </button>
                                    <button
                                      type="button"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => applyFormatToSelection(block.id, "italic")}
                                      className="px-2 py-0.5 text-xs italic font-serif text-slate-800 hover:bg-white rounded transition-colors cursor-pointer"
                                      title="Italic (Ctrl+I)"
                                    >
                                      I
                                    </button>
                                    <button
                                      type="button"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => applyFormatToSelection(block.id, "underline")}
                                      className="px-2 py-0.5 text-xs underline font-semibold text-slate-800 hover:bg-white rounded transition-colors cursor-pointer"
                                      title="Underline (Ctrl+U)"
                                    >
                                      U
                                    </button>
                                    <button
                                      type="button"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => applyFormatToSelection(block.id, "strike")}
                                      className="px-2 py-0.5 text-xs line-through text-slate-600 hover:bg-white rounded transition-colors cursor-pointer"
                                      title="Strikethrough"
                                    >
                                      S
                                    </button>
                                    <button
                                      type="button"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => applyFormatToSelection(block.id, "code")}
                                      className="px-2 py-0.5 text-xs font-mono text-emerald-700 hover:bg-white rounded transition-colors cursor-pointer"
                                      title="Inline Code (`code`)"
                                    >
                                      &lt;/&gt;
                                    </button>
                                    {/* Auto-closing Multi-color Highlight Tool with Quick Split Button */}
                                    <div className="relative inline-flex items-center">
                                      <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => applyHighlight(block.id, "#fef08a", "#854d0e")}
                                        className="px-2 py-0.5 text-xs font-black text-amber-900 bg-amber-200 hover:bg-amber-300 rounded-l transition-colors cursor-pointer shadow-2xs flex items-center gap-1 border-r border-amber-300/80"
                                        title="Quick Highlight in Yellow Marker (or toggle off)"
                                      >
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                        Highlight
                                      </button>
                                      <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() =>
                                          setActiveHighlightPicker(activeHighlightPicker === block.id ? null : block.id)
                                        }
                                        className="px-1 py-0.5 text-xs text-amber-900 bg-amber-200 hover:bg-amber-300 rounded-r transition-colors cursor-pointer flex items-center"
                                        title="Choose Highlight Color or Remove"
                                      >
                                        <span className="material-symbols-outlined text-[13px]">arrow_drop_down</span>
                                      </button>

                                      {/* Auto-closing Highlight Dropdown Popover */}
                                      {activeHighlightPicker === block.id && (
                                        <div
                                          onMouseDown={(e) => e.preventDefault()}
                                          className="absolute top-full left-0 mt-1 z-30 bg-white p-2 rounded-xl shadow-xl border border-slate-200 flex flex-col gap-1.5 min-w-[210px] animate-in fade-in zoom-in-95 duration-100"
                                        >
                                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 flex items-center justify-between">
                                            <span>Highlight Colors</span>
                                            <button
                                              type="button"
                                              onClick={() => setActiveHighlightPicker(null)}
                                              className="text-slate-400 hover:text-slate-700 cursor-pointer"
                                            >
                                              <span className="material-symbols-outlined text-[13px]">close</span>
                                            </button>
                                          </div>
                                          <div className="grid grid-cols-3 gap-1">
                                            {HIGHLIGHT_SWATCHES.map((swatch) => (
                                              <button
                                                key={swatch.name}
                                                type="button"
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => applyHighlight(block.id, swatch.bg, swatch.text)}
                                                className="px-2 py-1 text-[11px] font-bold rounded-lg transition-transform hover:scale-105 cursor-pointer text-center"
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
                                              className="w-full px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                                            >
                                              <span className="material-symbols-outlined text-[13px]">
                                                format_color_reset
                                              </span>
                                              Remove Highlight
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    <button
                                      type="button"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => {
                                        let selText = "";
                                        if (typeof window !== "undefined") {
                                          const sel = window.getSelection();
                                          if (sel && !sel.isCollapsed) selText = sel.toString().trim();
                                        }
                                        openHyperlinkDialog(block.id, selText, block.url || block.link);
                                      }}
                                      className="px-2.5 py-0.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-white rounded transition-colors flex items-center gap-1 cursor-pointer border border-indigo-200"
                                      title="Add Hyperlink to selected text"
                                    >
                                      <span className="material-symbols-outlined text-[13px]">link</span>
                                      <span>Link</span>
                                    </button>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {/* Mode switcher: Visual WYSIWYG vs HTML Source */}
                                    <div className="flex items-center bg-slate-200/80 p-0.5 rounded-md text-[10px] font-bold">
                                      <button
                                        type="button"
                                        onClick={() => setEditorModes((prev) => ({ ...prev, [block.id]: "visual" }))}
                                        className={`px-2 py-0.5 rounded cursor-pointer ${
                                          (editorModes[block.id] || "visual") === "visual"
                                            ? "bg-white text-indigo-600 shadow-2xs"
                                            : "text-slate-500 hover:text-slate-900"
                                        }`}
                                      >
                                        Visual
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditorModes((prev) => ({ ...prev, [block.id]: "html" }))}
                                        className={`px-2 py-0.5 rounded cursor-pointer ${
                                          editorModes[block.id] === "html"
                                            ? "bg-white text-indigo-600 shadow-2xs"
                                            : "text-slate-500 hover:text-slate-900"
                                        }`}
                                      >
                                        HTML
                                      </button>
                                    </div>

                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                                      <span>
                                        {block.content
                                          ? block.content.replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length
                                          : 0}{" "}
                                        words
                                      </span>
                                      <span>•</span>
                                      <span>{block.content ? block.content.length : 0} chars</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Dynamic Text & Live Editor Widget Controls Bar */}
                                <div className="flex items-center gap-1.5 flex-wrap bg-slate-50/90 p-1.5 rounded-lg border border-slate-200/80 text-[11px]">
                                  {/* Dynamic Typography Presets */}
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-0.5">
                                      Preset:
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => applyTextPreset(block.id, "body")}
                                      className="px-2 py-0.5 rounded text-[11px] font-semibold bg-white text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 transition-colors cursor-pointer"
                                      title="Standard 15px reading body text"
                                    >
                                      Body
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => applyTextPreset(block.id, "lead")}
                                      className="px-2 py-0.5 rounded text-[11px] font-bold bg-white text-indigo-700 hover:bg-indigo-100/60 border border-indigo-200 transition-colors cursor-pointer"
                                      title="19px bold article lead / subhead"
                                    >
                                      Lead
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => applyTextPreset(block.id, "editorial")}
                                      className="px-2 py-0.5 rounded text-[11px] font-serif italic bg-white text-slate-800 hover:bg-amber-50 hover:text-amber-900 border border-slate-200 transition-colors cursor-pointer"
                                      title="Editorial classic serif typography"
                                    >
                                      Editorial
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => applyTextPreset(block.id, "tip")}
                                      className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 transition-colors cursor-pointer"
                                      title="Green Deal / Pro Tip Callout Box"
                                    >
                                      Deal Tip
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => applyTextPreset(block.id, "alert")}
                                      className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300 transition-colors cursor-pointer"
                                      title="Amber Alert Notice Box"
                                    >
                                      Notice
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => applyTextPreset(block.id, "card")}
                                      className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 hover:bg-white border border-slate-300 transition-colors cursor-pointer"
                                      title="Subtle Boxed Card Container"
                                    >
                                      Card
                                    </button>
                                  </div>

                                  <span className="text-slate-300 mx-0.5">|</span>

                                  {/* Dynamic Text Alignment */}
                                  <div className="flex items-center gap-0.5 bg-white p-0.5 rounded border border-slate-200">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateBlockData(block.id, {
                                          style: { ...block.style, textAlign: "left" },
                                        })
                                      }
                                      className={`p-1 rounded cursor-pointer ${
                                        !block.style?.textAlign || block.style?.textAlign === "left"
                                          ? "bg-indigo-50 text-indigo-600 font-bold"
                                          : "text-slate-500 hover:text-slate-900"
                                      }`}
                                      title="Align Left"
                                    >
                                      <span className="material-symbols-outlined text-[13px]">format_align_left</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateBlockData(block.id, {
                                          style: { ...block.style, textAlign: "center" },
                                        })
                                      }
                                      className={`p-1 rounded cursor-pointer ${
                                        block.style?.textAlign === "center"
                                          ? "bg-indigo-50 text-indigo-600 font-bold"
                                          : "text-slate-500 hover:text-slate-900"
                                      }`}
                                      title="Align Center"
                                    >
                                      <span className="material-symbols-outlined text-[13px]">format_align_center</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateBlockData(block.id, {
                                          style: { ...block.style, textAlign: "right" },
                                        })
                                      }
                                      className={`p-1 rounded cursor-pointer ${
                                        block.style?.textAlign === "right"
                                          ? "bg-indigo-50 text-indigo-600 font-bold"
                                          : "text-slate-500 hover:text-slate-900"
                                      }`}
                                      title="Align Right"
                                    >
                                      <span className="material-symbols-outlined text-[13px]">format_align_right</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateBlockData(block.id, {
                                          style: { ...block.style, textAlign: "justify" },
                                        })
                                      }
                                      className={`p-1 rounded cursor-pointer ${
                                        block.style?.textAlign === "justify"
                                          ? "bg-indigo-50 text-indigo-600 font-bold"
                                          : "text-slate-500 hover:text-slate-900"
                                      }`}
                                      title="Align Justify"
                                    >
                                      <span className="material-symbols-outlined text-[13px]">format_align_justify</span>
                                    </button>
                                  </div>

                                  <span className="text-slate-300 mx-0.5">|</span>

                                  {/* Dynamic Font Size Selector */}
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] font-bold text-slate-400">Size:</span>
                                    <select
                                      value={block.style?.fontSize || "15px"}
                                      onChange={(e) =>
                                        updateBlockData(block.id, {
                                          style: { ...block.style, fontSize: e.target.value },
                                        })
                                      }
                                      className="bg-white border border-slate-200 text-slate-700 text-[11px] font-semibold rounded px-1.5 py-0.5 focus:outline-none cursor-pointer"
                                    >
                                      <option value="12px">12px - Small</option>
                                      <option value="15px">15px - Body</option>
                                      <option value="17px">17px - Medium</option>
                                      <option value="19px">19px - Lead</option>
                                      <option value="22px">22px - Display</option>
                                    </select>
                                  </div>

                                  <span className="text-slate-300 mx-0.5">|</span>

                                  {/* Dynamic Color Quick Swatches */}
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] font-bold text-slate-400">Color:</span>
                                    {[
                                      { label: "Dark Slate", color: "#1e293b" },
                                      { label: "Indigo Navy", color: "#1e1b4b" },
                                      { label: "Emerald", color: "#064e3b" },
                                      { label: "Amber Crimson", color: "#7f1d1d" },
                                      { label: "Muted Gray", color: "#64748b" },
                                    ].map((c) => (
                                      <button
                                        key={c.color}
                                        type="button"
                                        onClick={() =>
                                          updateBlockData(block.id, {
                                            style: { ...block.style, color: c.color },
                                          })
                                        }
                                        className={`w-3.5 h-3.5 rounded-full border border-slate-300 transition-transform hover:scale-125 cursor-pointer ${
                                          block.style?.color === c.color ? "ring-2 ring-indigo-400 scale-110" : ""
                                        }`}
                                        style={{ backgroundColor: c.color }}
                                        title={c.label}
                                      />
                                    ))}
                                  </div>
                                </div>

                                {(editorModes[block.id] || "visual") === "visual" ? (
                                  <div
                                    id={`editor-${block.id}`}
                                    contentEditable
                                    suppressContentEditableWarning
                                    onMouseUp={() => handleTextSelectionChange(block.id)}
                                    onKeyUp={() => handleTextSelectionChange(block.id)}
                                    onBlur={(e) => updateBlockContent(block.id, e.currentTarget.innerHTML)}
                                    dangerouslySetInnerHTML={{ __html: block.content || "" }}
                                    className="w-full min-h-[4.5rem] bg-transparent border-none focus:outline-none text-slate-800 text-sm leading-relaxed max-w-none transition-all"
                                    style={{
                                      fontSize: block.style?.fontSize || "15px",
                                      textAlign: block.style?.textAlign || "left",
                                      fontFamily: block.style?.fontFamily,
                                      color: block.style?.color,
                                      backgroundColor: block.style?.backgroundColor,
                                      padding: block.style?.padding,
                                      borderRadius: block.style?.borderRadius,
                                      borderLeft: (block.style as any)?.borderLeft,
                                      border: (block.style as any)?.border,
                                      lineHeight: block.style?.lineHeight || "1.65",
                                    }}
                                  />
                                ) : (
                                  <textarea
                                    value={block.content}
                                    onChange={(e) => updateBlockContent(block.id, e.target.value)}
                                    rows={4}
                                    className="w-full font-mono text-xs p-2 bg-slate-900 text-emerald-400 rounded-lg border border-slate-800 focus:outline-none resize-y leading-relaxed"
                                    placeholder="<p>Raw HTML or formatted text...</p>"
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        </React.Fragment>
                      );
                    })
                  )}

                  {/* Elementor Section Inserter Banner (+) */}
                  {blocks.length > 0 && viewMode === "edit" && (
                    <div className="pt-4 flex justify-center">
                      <button
                        type="button"
                        onClick={() => addBlock("text")}
                        className="px-4 py-2 border-2 border-dashed border-slate-300 hover:border-[#E21B5A] rounded-xl text-xs font-bold text-slate-500 hover:text-[#E21B5A] flex items-center gap-1.5 transition-all cursor-pointer group"
                      >
                        <span className="material-symbols-outlined text-sm group-hover:scale-110 transition-transform">
                          add_circle
                        </span>
                        + Add Elementor Widget / Section
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Hyperlink Modal Dialog */}
      {hyperlinkModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined">link</span>
                <h4 className="font-bold text-sm">Insert / Edit Hyperlink</h4>
              </div>
              <button
                type="button"
                onClick={() => setHyperlinkModalOpen(false)}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Display Text (Anchor)</label>
                <input
                  type="text"
                  value={hyperlinkText}
                  onChange={(e) => setHyperlinkText(e.target.value)}
                  placeholder="e.g. Apply for Education Loan"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Destination URL / Web Address</label>
                <input
                  type="text"
                  value={hyperlinkUrl}
                  onChange={(e) => setHyperlinkUrl(e.target.value)}
                  placeholder="https://... or /apply or #heading-id"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Quick Preset Links */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Popular Loan Presets:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { label: "Loan Application", url: "/apply" },
                    { label: "Check Eligibility", url: "/eligibility" },
                    { label: "EMI Calculator", url: "/calculator" },
                    { label: "Partner Banks", url: "/banks" },
                  ].map((preset) => (
                    <button
                      key={preset.url}
                      type="button"
                      onClick={() => {
                        setHyperlinkUrl(preset.url);
                        if (!hyperlinkText) setHyperlinkText(preset.label);
                      }}
                      className="px-2 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 rounded-lg text-[10px] font-bold border border-slate-200 transition-colors cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="target-blank-chk"
                  checked={hyperlinkTargetBlank}
                  onChange={(e) => setHyperlinkTargetBlank(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="target-blank-chk" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Open link in a new tab (target=&quot;_blank&quot;)
                </label>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setHyperlinkModalOpen(false)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyHyperlink}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
              >
                Apply Hyperlink
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
