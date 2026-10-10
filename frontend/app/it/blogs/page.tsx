"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { blogApi } from "@/lib/api";
import Link from "next/link";
import DynamicBlogEditor from "@/components/DynamicBlogEditor";

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
  | "split_content"
  // Legacy / convenience types
  | "link"
  | "cta"
  | "quote"
  | "code"
  | "container";

export interface SplitConfig {
  layoutType: "image_text" | "text_text" | "text_image";
  ratio?: "50_50" | "40_60" | "60_40" | "33_67";
  verticalAlign?: "top" | "center" | "bottom";
  cardStyle?: "clean" | "card" | "gradient" | "bordered";
  // Left column
  leftTitle?: string;
  leftContent?: string;
  leftImageUrl?: string;
  leftImageCaption?: string;
  leftImageAlt?: string;
  leftItems?: string[];
  // Right column
  rightTitle?: string;
  rightContent?: string;
  rightImageUrl?: string;
  rightImageCaption?: string;
  rightImageAlt?: string;
  rightItems?: string[];
  // CTA
  buttonText?: string;
  buttonUrl?: string;
  buttonNewTab?: boolean;
}

interface BlockItem {
  id: string;
  title: string;
  content?: string;
  url?: string;
  icon?: string;
  badge?: string;
  salary?: string;
  requirements?: string;
  caption?: string;
  credit?: string;
  details?: string[];
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
  splitConfig?: SplitConfig;
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
  { type: "split_content", label: "Split 2-Column", icon: "view_column", category: "basic", badge: "New", desc: "Left & right matter, or left image & right content." },
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
  { type: "image_carousel", label: "Story Slideshow (MSN Style)", icon: "view_carousel", category: "media", badge: "Interactive", desc: "Multi-image story gallery with sidebar navigation, salary badges, duties, and smooth slide transitions." },
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
  { label: "Loan Application", url: "/apply-loan", desc: "Direct loan eligibility & application form" },
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
    } catch { }
  }

  // 2. Direct JSON string array
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch { }
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
  const [editingBlog, setEditingBlog] = useState<any | null>(null);

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
  const [savedDraftNotice, setSavedDraftNotice] = useState<{ title: string; savedAt: string } | null>(null);
  const [bulkImageModalBlockId, setBulkImageModalBlockId] = useState<string | null>(null);
  const [bulkImageUrlsText, setBulkImageUrlsText] = useState("");
  const [dockSearch, setDockSearch] = useState("");

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
    } catch (_) { }
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
        }).catch(() => { });
      } else if (editSlug) {
        blogApi.getBySlug(editSlug).then((res: any) => {
          if (res?.data) handleEditBlog(res.data);
        }).catch(() => { });
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
      split_content: "",
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
        block.url = "/apply-loan";
        block.openInNewTab = true;
        break;
      case "link":
        block.url = "/apply-loan";
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
      case "split_content":
      case "container":
        block.title = "Split 2-Column";
        block.splitConfig = {
          layoutType: "image_text",
          ratio: "50_50",
          verticalAlign: "center",
          cardStyle: "clean",
          leftTitle: "Global Study Destinations",
          leftContent: "Explore thousands of accredited university programs across the United States, United Kingdom, Canada, and Germany with comprehensive counselor guidance.",
          leftImageUrl: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=800",
          leftImageCaption: "Campus academic excellence & student community",
          leftImageAlt: "University students on campus",
          leftItems: [
            "Accredited top-tier global universities",
            "100% comprehensive expense funding",
          ],
          rightTitle: "Collateral-Free Loan Assistance",
          rightContent: "Secure up to ₹75 Lakhs without physical collateral. Fast 48-hour approval, complete tuition + living coverage, and income tax deduction under Section 80E.",
          rightItems: [
            "Up to ₹75 Lakhs collateral-free limit",
            "Interest rates starting from 8.5% p.a.",
            "Moratorium: Course + 6-12 months",
            "Fast 48-hour conditional sanction",
          ],
          buttonText: "Check Eligibility & Apply",
          buttonUrl: "/apply-loan",
          buttonNewTab: true,
        };
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
        block.title = "High-Paying Careers That Don't Require a Bachelor's Degree";
        block.subtitle = "Explore lucrative technical and aviation professions with great salary growth";
        block.items = [
          {
            id: "1",
            title: "Commercial & Regional Pilot",
            salary: "$148,900 / year",
            requirements: "Commercial Certificate & Flight Hours (No Degree)",
            badge: "Aviation",
            content: "Commercial pilots fly chartered flights, corporate executive jets, and regional cargo routes. Airline entry depends on FAA flight certification and logged flight hours rather than a 4-year degree.",
            url: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=1000",
            caption: "Flight deck instrumentation and simulator training",
            credit: "Photo: Aviation Archive",
            details: ["12-18 month flight school timeline", "High demand with senior airline retirements", "Over $200,000+ earning potential for captains"],
          },
          {
            id: "2",
            title: "Air Traffic Controller",
            salary: "$132,250 / year",
            requirements: "High School + FAA Academy Certification",
            badge: "Federal",
            content: "Air traffic controllers coordinate aircraft movement to maintain safe separation distances. Selected candidates receive paid training at the FAA Academy in Oklahoma City.",
            url: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=1000",
            caption: "Tower and radar controllers coordinate safe flight corridors",
            credit: "Photo: FAA Operations",
            details: ["Full federal pension and medical benefits", "Paid training at FAA Academy", "Median salary exceeds $130,000"],
          },
          {
            id: "3",
            title: "Power Plant Operator",
            salary: "$97,000 / year",
            requirements: "On-The-Job Apprenticeship & NRC License",
            badge: "Energy",
            content: "Operators control the systems that generate and distribute electric power across nuclear, hydro, and natural gas facilities. Training is almost entirely paid on-site.",
            url: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?q=80&w=1000",
            caption: "Control room operators manage generation grids with rigorous safety protocols",
            credit: "Photo: Industrial Systems",
            details: ["100% employer-paid licensing", "Overtime regularly pushes pay over $115k", "Recession-resilient utility sector"],
          },
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
          { id: "1", title: "Apply for Study Abroad Loan", url: "/apply-loan", badge: "Instant" },
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
    const targetUrl = hyperlinkUrl.trim() || "/apply-loan";
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
        const linkHtml = `<a href="${targetUrl}" ${hyperlinkTargetBlank ? 'target="_blank" rel="noopener noreferrer"' : ""
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
    _textColor?: string
  ) => {
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    const el = document.getElementById(`editor-${blockId}`);
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      const containerEl = el || (range.commonAncestorContainer as HTMLElement)?.closest?.('[contenteditable="true"]') as HTMLElement | null;

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

      let node: Node | null = range.commonAncestorContainer;
      if (node.nodeType === Node.TEXT_NODE) {
        node = node.parentNode;
      }
      const existing = (node as HTMLElement)?.closest?.('[data-highlight="true"], mark') as HTMLElement | null;

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
            const fragment = range.extractContents();
            span.appendChild(fragment);
            range.insertNode(span);
          } catch (_) { }
        }
      }

      if (containerEl) {
        const marks = Array.from(containerEl.querySelectorAll("mark"));
        marks.forEach((m) => {
          const s = document.createElement("span");
          s.setAttribute("data-highlight", "true");
          s.style.backgroundColor = m.style.backgroundColor || bg;
          s.innerHTML = m.innerHTML;
          m.parentNode?.replaceChild(s, m);
        });
        updateBlockContent(blockId, containerEl.innerHTML);
      }
    }

    setActiveHighlightPicker(null);
  };

  const removeHighlight = (blockId: string) => {
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    const el = document.getElementById(`editor-${blockId}`);

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
        updateBlockContent(blockId, containerEl.innerHTML);
      }
    }

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
        } catch (_) { }
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
    if (templateKey === "high_paying_jobs_slideshow") {
      setBlogTitle("High-Paying Jobs That Require No College Degree (2026)");
      setBlogSubtitle("Explore top-earning career paths where hands-on training, industry certifications, and FAA licenses out-earn traditional four-year degrees.");
      setBlogCategory("Career & Education");
      setCoverImage("https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=1200");
      setBlogTags(["HighPayingJobs", "NoDegreeNeeded", "CareerGuide", "Apprenticeships", "VocationalSkills", "SalaryGrowth"]);
      tBlocks = [
        createBlock("heading", "The Skills Revolution: Earning Six Figures Without a Degree"),
        createBlock(
          "text",
          "For decades, high school graduates were told that a four-year bachelor's degree was the only reliable ticket to a secure, upper-middle-class income. But with soaring university tuition debts and intense market demand for specialized technical expertise, that consensus has shattered. Today, commercial pilots, air traffic controllers, and power plant technicians command salaries exceeding $100,000 to $145,000 per year—all without ever setting foot in a four-year lecture hall."
        ),
        createBlock("alert", "Interactive Gallery: Browse through the slides below or click any job in the sidebar to jump directly to its salary benchmarks, duties, and entry paths."),
        {
          ...createBlock("image_carousel"),
          title: "High-Paying Careers That Don't Require a Bachelor's Degree",
          subtitle: "Use the sidebar or arrows to navigate through top-earning positions",
          items: [
            {
              id: "job-1",
              title: "Commercial & Regional Pilot",
              badge: "Highest Earning",
              salary: "$148,900 / year (Median)",
              requirements: "Commercial Pilot Certificate + Instrument Rating (No 4-Year Degree)",
              url: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=1000",
              content: "Commercial pilots operate aircraft for charter flights, cargo delivery, aerial photography, and corporate travel. While major international airlines historically favored bachelor degrees, regional carriers and corporate fleets now hire based strictly on flight hours, FAA commercial certification, and multi-engine ratings. As thousands of senior pilots reach mandatory retirement, hiring bonuses and hourly pay have surged to historic highs.",
              caption: "Modern flight deck navigation systems require precision training rather than academic coursework.",
              credit: "Photo: Unsplash / Aviation Media",
              details: [
                "Average Training Timeline: 12 to 18 months at an FAA-certified flight school",
                "Flight Hour Milestones: 250 hours for Commercial License, 1,500 hours for ATP",
                "Top Earning Potential: Up to $220,000+ per year with seniority and captain rank",
              ]
            },
            {
              id: "job-2",
              title: "Air Traffic Controller",
              badge: "Top Federal Pay",
              salary: "$132,250 / year (Median)",
              requirements: "High School Diploma + FAA Academy Graduation (Under Age 31)",
              url: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=1000",
              content: "Air traffic controllers coordinate the safe, orderly movement of aircraft across national airspace and terminal radar approach zones. The Federal Aviation Administration (FAA) hires candidates with a high school diploma and three years of progressive work experience. Selected candidates attend the intense FAA Academy in Oklahoma City, receiving full training and federal pay.",
              caption: "Controllers maintain 24/7 radar contact with commercial and cargo aircraft.",
              credit: "Photo: Unsplash / FAA Operations",
              details: [
                "FAA Academy Training: Several months of intensive radar and tower simulation",
                "Federal Benefits: Comprehensive federal retirement pension and medical coverage",
                "Top 10% Earning Range: More than $185,000 per year at major hub towers",
              ]
            },
            {
              id: "job-3",
              title: "Nuclear & Power Plant Operator",
              badge: "Energy Sector",
              salary: "$97,000 / year (Median)",
              requirements: "High School Diploma + On-Site Apprenticeship & NRC License",
              url: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?q=80&w=1000",
              content: "Power plant operators control the machinery, turbines, and generators that generate electric power across nuclear, hydroelectric, and natural gas facilities. Nuclear plant operators must obtain a license from the Nuclear Regulatory Commission (NRC) through employer-sponsored on-the-job training and simulator exams. The role demands high reliability and problem-solving skills.",
              caption: "Control room operators manage generation grids with rigorous safety protocols.",
              credit: "Photo: Unsplash / Industrial Archive",
              details: [
                "Training Model: 100% paid on-the-job training with licensing incentives",
                "Overtime & Shift Bonuses: Can push annual compensation past $120,000+",
                "Stability: Vital infrastructure with near-zero layoff volatility",
              ]
            },
            {
              id: "job-4",
              title: "Elevator & Escalator Installer / Repairer",
              badge: "Union Trade",
              salary: "$99,000 / year (Median)",
              requirements: "High School Diploma + 4-Year Paid Union Apprenticeship",
              url: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=1000",
              content: "Elevator installers assemble, install, maintain, and repair elevators, escalators, moving walkways, and chairlifts. This is widely considered the highest-paid non-degree construction trade. Trainees enter a paid four-year apprenticeship through the International Union of Elevator Constructors (IUEC), earning competitive hourly wages while learning electrical and hydraulic systems.",
              caption: "Elevator mechanics handle complex electrical circuits and hydraulic hoisting systems.",
              credit: "Photo: Unsplash / Construction Tech",
              details: [
                "Zero Debt Model: Apprentices earn while they learn with zero student loans",
                "Top Market Wages: Exceeds $130,000 per year in metropolitan high-rise markets",
                "Long-term Demand: Modern smart elevators require specialized mechanical expertise",
              ]
            },
            {
              id: "job-5",
              title: "Radiation Therapist",
              badge: "Healthcare",
              salary: "$89,500 / year (Median)",
              requirements: "12-24 Month ARRT Certification (No 4-Year University Degree)",
              url: "https://images.unsplash.com/photo-1516549655169-df83a0774514?q=80&w=1000",
              content: "Radiation therapists administer targeted radiation treatments to cancer patients in hospitals and oncology clinics under the guidance of oncologists and medical physicists. Entering this high-demand healthcare career requires an accredited 1-to-2 year certificate program and ARRT board certification, bypassing the exorbitant tuition and length of medical school or four-year degrees.",
              caption: "Therapists operate linear accelerators with precise digital targeting.",
              credit: "Photo: Unsplash / Health Imaging",
              details: [
                "Fast Completion: Start working in as little as 18 to 24 months",
                "Job Outlook: Fast-growing demand driven by an aging demographic",
                "Predictable Schedule: Clinic-based hours with limited night shifts",
              ]
            },
            {
              id: "job-6",
              title: "Police Detective & First-Line Supervisor",
              badge: "Public Service",
              salary: "$92,970 / year (Median)",
              requirements: "High School Diploma + Police Academy & Promotional Merit",
              url: "https://images.unsplash.com/photo-1453873531674-2151abc01707?q=80&w=1000",
              content: "Police detectives and precinct supervisors conduct investigations, interview witnesses, analyze evidence, and direct patrol teams. Most municipal and state police agencies require only a high school diploma and graduation from an agency training academy. Career detectives earn promotions through field merit and departmental exams, pairing substantial base pay with lucrative pensions.",
              caption: "Detectives lead complex criminal investigations and evidentiary analysis.",
              credit: "Photo: Unsplash / Investigative Bureau",
              details: [
                "Retirement: 20-to-25 year retirement pensions with early pension access",
                "Overtime Earning: Top supervisors regularly earn over $130,000 with overtime",
                "Comprehensive Benefits: Lifetime healthcare and family coverage packages",
              ]
            }
          ]
        },
        createBlock("heading", "Degree vs. Specialized Skills: Financial Comparison"),
        {
          ...createBlock("table"),
          tableData: {
            headers: ["Career Track", "Typical Debt at Entry", "Training Duration", "Median 5-Year Earnings"],
            rows: [
              ["Four-Year Liberal Arts Degree", "$38,000 - $85,000 Debt", "4 to 5 Years", "$55,000 - $65,000 / yr"],
              ["Commercial Pilot Track", "$45,000 (Flight Training)", "14 to 18 Months", "$110,000 - $150,000 / yr"],
              ["Union Elevator Apprenticeship", "$0 (Earn While Learning)", "4 Years (Paid)", "$90,000 - $115,000 / yr"],
              ["Air Traffic Control Academy", "$0 (Paid Academy Training)", "1 to 2 Years", "$120,000 - $140,000 / yr"],
            ],
            hasHeader: true,
            isStriped: true,
          }
        },
        {
          ...createBlock("cta", "Planning to pursue specialized vocational certification, pilot flight hours, or healthcare licensing? VidyaLoans provides targeted skill financing with zero collateral."),
          title: "Finance Your Specialized Career Certification",
          buttonText: "Check Skill Loan Eligibility →",
          url: "/apply-loan",
          openInNewTab: true,
        },
        {
          ...createBlock("tags"),
          title: "Related Career Topics",
          tags: ["HighPayingJobs", "NoDegreeNeeded", "CommercialPilot", "AirTrafficController", "UnionTrades", "VocationalSkills2026"],
        }
      ];
    } else if (templateKey === "education_guide") {
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
          url: "/apply-loan",
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
      } catch (_) { }

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
      } catch { }
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
    setEditingBlog(fullBlog);
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
            </div>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              Dynamic editorial publishing suite with live side-by-side preview, real-time word counting, rich content blocks, and SEO optimization.
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
              Create Dynamic Blog
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
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${blog.published
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
                        className={`px-3 py-1 rounded-lg transition-all ${compareTab === "overview" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
                          }`}
                      >
                        Metrics & Stats
                      </button>
                      <button
                        type="button"
                        onClick={() => setCompareTab("content")}
                        className={`px-3 py-1 rounded-lg transition-all ${compareTab === "content" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
                          }`}
                      >
                        Content Preview
                      </button>
                      <button
                        type="button"
                        onClick={() => setCompareTab("architecture")}
                        className={`px-3 py-1 rounded-lg transition-all ${compareTab === "architecture" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
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
        <DynamicBlogEditor
          initialBlog={editingBlog}
          currentUser={user}
          onBack={() => {
            setIsCreating(false);
            setEditingBlog(null);
            setEditingBlogId(null);
            router.replace("/it/blogs");
          }}
          onSaved={() => {
            setIsCreating(false);
            setEditingBlog(null);
            setEditingBlogId(null);
            router.replace("/it/blogs");
            loadBlogs();
          }}
        />
      )}
    </div>
  );
}
