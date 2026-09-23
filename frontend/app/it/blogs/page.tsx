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
  // Legacy / convenience types
  | "link"
  | "cta"
  | "list"
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
  // Elementor-style Link Settings
  url?: string;
  link?: string;
  openInNewTab?: boolean;
  addNofollow?: boolean;
  linkStyle?: "primary" | "secondary" | "outline" | "inline";
  style?: {
    fontSize?: string;
    fontFamily?: string;
    color?: string;
    backgroundColor?: string;
    textAlign?: "left" | "center" | "right" | "justify";
    padding?: string;
    borderRadius?: string;
    opacity?: string;
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
  { type: "heading", label: "Heading", icon: "title", category: "basic", desc: "Add eye-catching headlines." },
  { type: "image", label: "Image", icon: "image", category: "basic", desc: "Control the size, opacity and more." },
  { type: "text", label: "Text Editor", icon: "text_fields", category: "basic", desc: "Just like the WordPress text editor." },
  { type: "video", label: "Video", icon: "videocam", category: "basic", desc: "Add YouTube, Vimeo, VideoPress, Dailymotion or self-hosted videos." },
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
      const res: any = await blogApi.getAll(1, 100).catch(() => ({ data: [] }));
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
    if (action === "create") {
      setIsCreating(true);
    }
  }, [action]);

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

  // Create block helper with smart defaults for all 30 Elementor widgets
  const createBlock = (type: BlockType, customContent?: string): Block => {
    const defaults: Record<BlockType, string> = {
      heading: "Add Eye-Catching Headline",
      image: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=800",
      text: "Enter your detailed article paragraph text here. Just like the WordPress text editor, you can format, align, and customize typography seamlessly.",
      video: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      button: "Check Eligibility & Apply Now",
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
        fontSize: type === "heading" ? "24px" : "14px",
        padding: "8px",
      },
    };

    // Smart initializers for interactive & complex widgets
    switch (type) {
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
    if (action === "create") {
      router.replace("/it/blogs");
    }
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

  const getBlogBlocks = (blog: any): Block[] => {
    if (!blog) return [];
    if (Array.isArray(blog.blocks) && blog.blocks.length > 0) return blog.blocks;
    if (typeof blog.blocks === "string") {
      try {
        const parsed = JSON.parse(blog.blocks);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    if (typeof blog.content === "string") {
      const match = blog.content.match(/<!--BLOCKS_JSON_START-->([\s\S]*?)<!--BLOCKS_JSON_END-->/);
      if (match && match[1]) {
        try {
          const parsed = JSON.parse(match[1]);
          if (Array.isArray(parsed)) return parsed;
        } catch {}
      }
      if (blog.content.startsWith("[")) {
        try {
          const parsed = JSON.parse(blog.content);
          if (Array.isArray(parsed)) return parsed;
        } catch {}
      }
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

  const handleEditBlog = (blog: any) => {
    setEditingBlogId(blog.id || blog._id);
    setBlogTitle(blog.title || "");
    setBlogSlug(blog.slug || "");
    setBlogSubtitle(blog.subtitle || blog.excerpt || "");
    setBlogCategory(blog.category || "Loan Guidance");
    setCoverImage(blog.coverImage || blog.featuredImage || "");
    setBlocks(getBlogBlocks(blog));
    setIsCreating(true);
  };

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

              {/* Elementor Iconic Badge */}
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm"
                style={{ backgroundColor: "#E21B5A" }}
                title="WordPress Elementor Visual Engine"
              >
                <span className="material-symbols-outlined text-lg font-black">widgets</span>
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
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white text-xs font-semibold rounded-xl transition-all border border-slate-700 cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[15px] text-amber-400">save</span>
                <span className="hidden sm:inline">Backup</span>
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveBlog(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all border border-slate-700 cursor-pointer"
              >
                {saving ? "Saving..." : "Save Draft"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveBlog(true)}
                className="px-4 py-1.5 bg-[#E21B5A] hover:bg-[#C9134D] active:scale-95 text-white text-xs font-black rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">publish</span>
                {saving ? "Publishing..." : "Publish"}
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
                      Style
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
                    <div className="flex items-center gap-2.5 border-l border-slate-200 pl-3">
                      {/* Link URL Quick Input */}
                      <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl">
                        <span className="material-symbols-outlined text-indigo-600 text-[16px]">link</span>
                        <input
                          type="text"
                          value={selectedBlock.url || selectedBlock.link || ""}
                          onChange={(e) => updateBlockData(selectedBlock.id, { url: e.target.value, link: e.target.value })}
                          placeholder="Link URL (e.g. /apply or https://...)"
                          className="text-xs bg-transparent border-none focus:outline-none w-52 font-mono font-medium text-slate-800"
                        />
                      </div>

                      {/* Open Link Inspector Details Modal */}
                      <button
                        type="button"
                        onClick={() => setLinkInspectorOpen(!linkInspectorOpen)}
                        className={`px-3 py-1 text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer ${
                          selectedBlock.url || selectedBlock.link
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                        }`}
                        title="Elementor Link Settings (Target, Nofollow, Presets)"
                      >
                        <span className="material-symbols-outlined text-[14px]">settings_ethernet</span>
                        <span>Link Options</span>
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

                  {/* TAB 2: STYLE (TYPOGRAPHY, COLORS, ALIGNMENT) */}
                  {elementorInspectorTab === "style" && (
                    <div className="flex items-center gap-3 border-l border-slate-200 pl-3">
                      <select
                        value={selectedBlock.style?.fontSize || "14px"}
                        onChange={(e) => updateBlockStyle(selectedBlock.id, { fontSize: e.target.value })}
                        className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer"
                      >
                        <option value="12px">12px Small</option>
                        <option value="14px">14px Body</option>
                        <option value="16px">16px Medium</option>
                        <option value="20px">20px Subtitle</option>
                        <option value="24px">24px Heading</option>
                        <option value="32px">32px Hero Title</option>
                      </select>

                      {/* Text Alignment */}
                      <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                        {(["left", "center", "right"] as const).map((align) => (
                          <button
                            key={align}
                            type="button"
                            onClick={() => updateBlockStyle(selectedBlock.id, { textAlign: align })}
                            className={`p-1 rounded-md text-slate-600 transition-all ${
                              (selectedBlock.style?.textAlign || "left") === align
                                ? "bg-white text-indigo-600 shadow-2xs font-bold"
                                : "hover:bg-slate-200/50"
                            }`}
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
                            className="w-5 h-5 rounded-full border border-slate-200 transition-transform hover:scale-110 cursor-pointer"
                            style={{ backgroundColor: c.color }}
                            title={c.name}
                          />
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

                {/* Block Quick Duplicate / Delete */}
                <div className="flex items-center gap-2">
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

                {/* Main Article Title */}
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mb-6">
                  {blogTitle || "Untitled Article Header"}
                </h1>

                {/* Canvas Blocks Container */}
                <div className="space-y-4 flex-1">
                  {blocks.length === 0 ? (
                    <div className="py-20 text-center text-slate-400 my-auto">
                      <div
                        className="w-16 h-16 rounded-2xl text-white flex items-center justify-center mx-auto mb-3 shadow-md"
                        style={{ backgroundColor: "#E21B5A" }}
                      >
                        <span className="material-symbols-outlined text-3xl">widgets</span>
                      </div>
                      <h4 className="text-sm font-black text-slate-800 mb-1">
                        Elementor Canvas is Ready
                      </h4>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                        Drag widgets from the left panel, add dedicated link cards, or load a pre-built kit to begin.
                      </p>
                      <button
                        type="button"
                        onClick={() => applyTemplate("education_guide")}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-sm cursor-pointer"
                      >
                        Load Education Guide Kit
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
                            onClick={() => setSelectedBlockId(block.id)}
                            onDragStart={(e) => handleBlockDragStart(e, block.id)}
                            onDragEnd={handleBlockDragEnd}
                            onDragOver={(e) => handleCanvasDragOver(e, index)}
                            onDrop={(e) => handleCanvasDrop(e, index)}
                            className={`group relative rounded-xl p-3 transition-all cursor-pointer ${
                              isSelected
                                ? "ring-2 ring-[#E21B5A] ring-offset-2 bg-rose-50/20 shadow-sm"
                                : "hover:ring-1 hover:ring-slate-300"
                            }`}
                            style={{
                              color: block.style?.color || "#1e293b",
                              backgroundColor: block.style?.backgroundColor || "transparent",
                              textAlign: block.style?.textAlign || "left",
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
                              <input
                                type="text"
                                value={block.content}
                                onChange={(e) => updateBlockContent(block.id, e.target.value)}
                                className="w-full font-bold text-slate-900 bg-transparent border-none focus:outline-none"
                                style={{ fontSize: block.style?.fontSize || "22px" }}
                                placeholder="Heading text..."
                              />
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
                            ) : /* BLOCK TYPE: BUTTON WITH LINK */
                            block.type === "button" ? (
                              <div className="my-2 flex flex-col sm:flex-row sm:items-center gap-2">
                                <button
                                  type="button"
                                  className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer"
                                >
                                  {block.content || "Click Here"}
                                </button>
                                {isSelected && (
                                  <span className="text-[10px] font-mono text-slate-400">
                                    Target: {block.url || "/apply"}
                                  </span>
                                )}
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

                                {/* Image Settings (Selected State) */}
                                {isSelected && (
                                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                                      <span className="flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px] text-indigo-600">photo_library</span>
                                        Image Source (File Upload or Link)
                                      </span>
                                      <label className="text-indigo-600 hover:text-indigo-800 cursor-pointer flex items-center gap-1 font-bold">
                                        <span className="material-symbols-outlined text-[14px]">file_upload</span>
                                        Choose File From Device
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
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="material-symbols-outlined text-slate-400 text-[16px]">link</span>
                                      <input
                                        type="text"
                                        value={block.content.startsWith("data:") ? "[Local Uploaded Image File]" : block.content}
                                        onChange={(e) => updateBlockContent(block.id, e.target.value)}
                                        placeholder="Or enter image link URL (https://...)..."
                                        className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:border-rose-400"
                                      />
                                      {block.content && (
                                        <button
                                          type="button"
                                          onClick={() => updateBlockContent(block.id, "")}
                                          className="px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold border border-rose-200 cursor-pointer"
                                        >
                                          Clear
                                        </button>
                                      )}
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

                                {/* Video Settings (Selected State) */}
                                {isSelected && (
                                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                                      <span className="flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px] text-indigo-600">smart_display</span>
                                        Video Source (File Upload or YouTube / Vimeo URL)
                                      </span>
                                      <label className="text-indigo-600 hover:text-indigo-800 cursor-pointer flex items-center gap-1 font-bold">
                                        <span className="material-symbols-outlined text-[14px]">file_upload</span>
                                        Upload Video File
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
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="material-symbols-outlined text-slate-400 text-[16px]">link</span>
                                      <input
                                        type="text"
                                        value={block.content.startsWith("data:") ? "[Local Uploaded Video File]" : block.content}
                                        onChange={(e) => updateBlockContent(block.id, e.target.value)}
                                        placeholder="Paste YouTube, Vimeo or MP4 URL (e.g. https://youtube.com/watch?v=...)..."
                                        className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-400"
                                      />
                                      {block.content && (
                                        <button
                                          type="button"
                                          onClick={() => updateBlockContent(block.id, "")}
                                          className="px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold border border-rose-200 cursor-pointer"
                                        >
                                          Clear
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}
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
                                {isSelected && (
                                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 pt-1">
                                    <span>Material Icon Name:</span>
                                    <input
                                      type="text"
                                      value={block.iconName || "verified_user"}
                                      onChange={(e) => updateBlockData(block.id, { iconName: e.target.value })}
                                      className="px-2 py-0.5 bg-white border border-slate-200 rounded text-xs w-36 font-mono"
                                    />
                                  </div>
                                )}
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
                            ) : /* BLOCK TYPE: SOCIAL ICONS */
                            block.type === "social_icons" ? (
                              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                                <input
                                  type="text"
                                  value={block.title || "Follow Us"}
                                  onChange={(e) => updateBlockData(block.id, { title: e.target.value })}
                                  className="text-xs font-bold text-slate-700 bg-transparent border-none focus:outline-none"
                                />
                                <div className="flex items-center gap-2 flex-wrap">
                                  {(block.items || []).map((item, i) => (
                                    <div
                                      key={item.id || i}
                                      className="px-3 py-1.5 bg-white border border-slate-200 hover:border-indigo-400 rounded-xl text-xs font-bold text-slate-800 flex items-center gap-1.5 shadow-2xs hover:text-indigo-600 transition-colors"
                                    >
                                      <span className="material-symbols-outlined text-[16px] text-indigo-600">{item.icon || "share"}</span>
                                      <span>{item.title}</span>
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
                            ) : /* BLOCK TYPE: IMAGE CAROUSEL */
                            block.type === "image_carousel" ? (
                              <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3 shadow-md">
                                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                                  <span className="flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[16px] text-rose-400">view_carousel</span>
                                    {block.title || "Rotating Image Carousel"}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">{(block.items || []).length} Slides</span>
                                </div>
                                {(block.items || []).length > 0 && (
                                  <div className="relative rounded-xl overflow-hidden aspect-21/9 bg-slate-800">
                                    <img
                                      src={block.items?.[0]?.url || "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=800"}
                                      alt="Carousel"
                                      className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex items-end p-4">
                                      <div>
                                        <p className="text-sm font-bold text-white">{block.items?.[0]?.title}</p>
                                        <p className="text-xs text-slate-300">{block.items?.[0]?.content}</p>
                                      </div>
                                    </div>
                                  </div>
                                )}
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
                            ) : /* BLOCK TYPE: NESTED TABS */
                            block.type === "nested_tabs" ? (
                              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                                <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 overflow-x-auto">
                                  {(block.items || []).map((tab, idx) => (
                                    <button
                                      key={tab.id || idx}
                                      type="button"
                                      onClick={() => updateBlockData(block.id, { value: idx })}
                                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                                        (Number(block.value) || 0) === idx
                                          ? "bg-indigo-600 text-white shadow-xs"
                                          : "bg-white text-slate-700 hover:bg-slate-100"
                                      }`}
                                    >
                                      {tab.title}
                                    </button>
                                  ))}
                                </div>
                                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                                  <textarea
                                    value={block.items?.[Number(block.value) || 0]?.content || ""}
                                    onChange={(e) => {
                                      const curIdx = Number(block.value) || 0;
                                      const nextItems = [...(block.items || [])];
                                      if (nextItems[curIdx]) {
                                        nextItems[curIdx] = { ...nextItems[curIdx], content: e.target.value };
                                        updateBlockData(block.id, { items: nextItems });
                                      }
                                    }}
                                    rows={3}
                                    className="w-full text-xs text-slate-700 bg-transparent border-none focus:outline-none resize-y leading-relaxed"
                                    placeholder="Tab content..."
                                  />
                                </div>
                              </div>
                            ) : /* BLOCK TYPE: NESTED ACCORDION */
                            block.type === "nested_accordion" ? (
                              <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2">
                                <input
                                  type="text"
                                  value={block.title || "FAQ Accordion"}
                                  onChange={(e) => updateBlockData(block.id, { title: e.target.value })}
                                  className="text-xs font-bold text-slate-800 bg-transparent border-none focus:outline-none"
                                />
                                <div className="space-y-2">
                                  {(block.items || []).map((acc, idx) => (
                                    <details key={acc.id || idx} className="group border border-slate-200 rounded-xl bg-slate-50/50 overflow-hidden" open={idx === 0}>
                                      <summary className="p-3 text-xs font-bold text-slate-800 cursor-pointer flex items-center justify-between">
                                        <span>{acc.title}</span>
                                        <span className="material-symbols-outlined text-[16px] group-open:rotate-180 transition-transform">
                                          expand_more
                                        </span>
                                      </summary>
                                      <div className="p-3 pt-0 text-xs text-slate-600 border-t border-slate-100 bg-white">
                                        <textarea
                                          value={acc.content || ""}
                                          onChange={(e) => {
                                            const nextItems = [...(block.items || [])];
                                            nextItems[idx] = { ...nextItems[idx], content: e.target.value };
                                            updateBlockData(block.id, { items: nextItems });
                                          }}
                                          rows={2}
                                          className="w-full bg-transparent border-none focus:outline-none text-xs resize-y"
                                        />
                                      </div>
                                    </details>
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
                            ) : /* BLOCK TYPE: SIDEBAR */
                            block.type === "sidebar" ? (
                              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                                <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider">Page Sidebar Mock</span>
                                <h5 className="text-xs font-bold text-slate-900">{block.title || "Helpful Student Resources"}</h5>
                                <p className="text-[11px] text-slate-500">{block.content}</p>
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
                            ) : (
                              /* DEFAULT: TEXT EDITOR */
                              <textarea
                                value={block.content}
                                onChange={(e) => updateBlockContent(block.id, e.target.value)}
                                rows={3}
                                className="w-full bg-transparent border-none focus:outline-none resize-y text-slate-800 text-sm leading-relaxed"
                                style={{ fontSize: block.style?.fontSize || "14px" }}
                                placeholder="Enter paragraph text..."
                              />
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
    </div>
  );
}
