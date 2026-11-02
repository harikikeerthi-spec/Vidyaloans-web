import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { BlogPost } from "@/types";
import BlogShareBar from "@/components/BlogShareBar";
import BlogRegistrationHandler from "@/components/BlogRegistrationHandler";
import { sanitizeHtml, safeJsonLd } from "@/lib/sanitize";

interface Props {
  params: Promise<{
    slug: string;
  }>;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.vidyaloans.in";

/**
 * Strip clipboard fragments (<!--StartFragment-->, etc.), HTML tags, and clean plain text
 * for excerpts, subtitles, and SEO meta descriptions.
 */
export function cleanExcerptText(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return "";
  return raw
    .replace(/<!--StartFragment-->/gi, "")
    .replace(/<!--EndFragment-->/gi, "")
    .replace(/&lt;!--StartFragment--&gt;/gi, "")
    .replace(/&lt;!--EndFragment--&gt;/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;[^&gt;]+&gt;/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Strips internal builder metadata comments, blocks JSON, and SEO JSON objects
 * so that internal JSON structures are never rendered inside the public blog article body.
 */
export function cleanBlogContent(rawHtml: string | null | undefined): string {
  if (!rawHtml || typeof rawHtml !== "string") return "";
  return rawHtml
    .replace(/<!--BLOCKS_JSON_START-->[\s\S]*?<!--BLOCKS_JSON_END-->/gi, "")
    .replace(/<!--SEO_JSON_START-->[\s\S]*?<!--SEO_JSON_END-->/gi, "")
    .replace(/<!--\s*BLOCKS_DATA:[\s\S]*?-->/gi, "")
    .replace(/<!--\s*SEO_DATA:[\s\S]*?-->/gi, "")
    .replace(/<!--StartFragment-->/gi, "")
    .replace(/<!--EndFragment-->/gi, "")
    .replace(/&lt;!--StartFragment--&gt;/gi, "")
    .replace(/&lt;!--EndFragment--&gt;/gi, "")
    .replace(/<!--BLOCKS_JSON_(?:START|END)-->/gi, "")
    .replace(/<!--SEO_JSON_(?:START|END)-->/gi, "")
    .replace(/<div[^>]*class="[^"]*blog-cover-page[^"]*"[\s\S]*?<\/div>\s*<\/div>/gi, "")
    .replace(/(?:\[\s*\]|\{\s*\})?\s*\{[\s\S]*?"metaTitle"[\s\S]*?\}/gi, "")
    .trim();
}

async function fetchBlogBySlug(slug: string): Promise<BlogPost | null> {
  const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:5000";
  const cleanSlug = decodeURIComponent(slug).trim();

  // 1. Try fetching by slug via /api/blogs/slug/
  try {
    const res = await fetch(`${backendUrl}/api/blogs/slug/${encodeURIComponent(cleanSlug)}`, {
      next: { revalidate: 60 },
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.success && json.data) return json.data;
      if (json?.data) return json.data;
    }
  } catch (err) {
    console.error(`Error fetching blog by slug ${cleanSlug}:`, err);
  }

  // 2. Fallback: try by id or slug via /api/blogs/
  try {
    const res = await fetch(`${backendUrl}/api/blogs/${encodeURIComponent(cleanSlug)}`, {
      next: { revalidate: 60 },
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.success && json.data) return json.data;
      if (json?.data) return json.data;
    }
  } catch (err) {
    console.error(`Error fetching blog by ID ${cleanSlug}:`, err);
  }

  // 3. Fallback: try without /api in case backend runs without global prefix
  try {
    const res = await fetch(`${backendUrl}/blogs/slug/${encodeURIComponent(cleanSlug)}`, {
      next: { revalidate: 60 },
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.success && json.data) return json.data;
      if (json?.data) return json.data;
    }
  } catch {
    // Ignore fallback error
  }

  return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const blog = await fetchBlogBySlug(slug);

  if (!blog) {
    return {
      title: "Article Not Found",
      description: "The requested education loan guide or article could not be located.",
    };
  }

  const metaTitle =
    (blog as any).metaTitle ||
    blog.title;
  const metaDescription =
    cleanExcerptText((blog as any).metaDescription) ||
    cleanExcerptText(blog.subtitle) ||
    cleanExcerptText((blog as any).excerpt) ||
    "Read comprehensive education loan guidance, interest rates, and university funding tips on VidyaLoans.";
  const canonicalUrl =
    (blog as any).canonicalUrl || `${SITE_URL}/blog/${blog.slug || slug}`;
  const ogImage =
    blog.coverImage ||
    blog.featuredImage ||
    `${SITE_URL}/images/og-image.png`;
  const publishedTime = blog.publishedAt || (blog as any).createdAt || new Date().toISOString();
  const modifiedTime =
    (blog as any).updatedAt || blog.publishedAt || (blog as any).createdAt || publishedTime;

  return {
    title: metaTitle,
    description: metaDescription,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: metaTitle,
      description: metaDescription,
      url: canonicalUrl,
      siteName: "VidyaLoans",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: blog.title,
        },
      ],
      type: "article",
      publishedTime,
      modifiedTime,
      authors: [blog.authorName || "VidyaLoans Editorial Staff"],
      section: blog.category || "Education Loan",
      tags: blog.tags || ["EducationLoan", "StudyAbroad", "FintechGuidance"],
    },
    twitter: {
      card: "summary_large_image",
      title: metaTitle,
      description: metaDescription,
      images: [ogImage],
      creator: "@vidyaloans",
    },
    robots: {
      index: (blog as any).noIndex !== true,
      follow: (blog as any).noIndex !== true,
      googleBot: {
        index: (blog as any).noIndex !== true,
        follow: (blog as any).noIndex !== true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const blog = await fetchBlogBySlug(slug);

  if (!blog) {
    notFound();
  }

  const canonicalUrl = `${SITE_URL}/blog/${blog.slug || slug}`;
  const coverImg =
    blog.coverImage ||
    blog.featuredImage ||
    "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200";

  // Schema.org BlogPosting Structured Data
  const jsonLdArticle = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonicalUrl,
    },
    headline: blog.title,
    description: cleanExcerptText(blog.subtitle || (blog as any).excerpt || ""),
    image: [coverImg],
    datePublished: blog.publishedAt || (blog as any).createdAt,
    dateModified: (blog as any).updatedAt || blog.publishedAt || (blog as any).createdAt,
    author: {
      "@type": "Person",
      name: blog.authorName || "VidyaLoans Editorial Staff",
    },
    publisher: {
      "@type": "Organization",
      name: "VidyaLoans",
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/images/logo.png`,
      },
    },
    articleSection: blog.category || "Education Loan",
    keywords: (blog.tags || []).join(", "),
  };

  // Schema.org BreadcrumbList Structured Data
  const jsonLdBreadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: SITE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: `${SITE_URL}/blog`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: blog.category || "Guidance",
        item: `${SITE_URL}/blog?category=${encodeURIComponent(blog.category || "Guidance")}`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: blog.title,
        item: canonicalUrl,
      },
    ],
  };

  // Schema.org FAQPage Structured Data (if FAQs exist)
  let faqList: Array<{ question: string; answer: string }> = (blog as any).faqSchema || [];
  if ((!faqList || faqList.length === 0) && blog.content) {
    const seoMatch = blog.content.match(/<!--SEO_JSON_START-->([\s\S]*?)<!--SEO_JSON_END-->/);
    if (seoMatch && seoMatch[1]) {
      try {
        const parsed = JSON.parse(seoMatch[1]);
        if (Array.isArray(parsed.faqSchema)) faqList = parsed.faqSchema;
      } catch (_) {}
    }
  }

  const validFaqs = (faqList || []).filter((f) => f.question?.trim() && f.answer?.trim());
  const jsonLdFaq = validFaqs.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: validFaqs.map((f) => ({
      "@type": "Question",
      name: f.question.trim(),
      acceptedAnswer: {
        "@type": "Answer",
        text: f.answer.trim(),
      },
    })),
  } : null;

  return (
    <>
      {/* Schema.org Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLdArticle) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLdBreadcrumb) }}
      />
      {jsonLdFaq && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLdFaq) }}
        />
      )}
      <BlogRegistrationHandler />

      <article className="pt-24 pb-32 bg-white">
        {/* Breadcrumb Navigation & Hero Header */}
        <div className="max-w-4xl mx-auto px-6 mb-12">
          {/* Visual Semantic Breadcrumb Trail */}
          <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-xs text-slate-400 flex-wrap">
            <Link href="/" className="hover:text-indigo-600 transition-colors">
              Home
            </Link>
            <span className="text-slate-300">/</span>
            <Link href="/blog" className="hover:text-indigo-600 transition-colors">
              Blog Hub
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-indigo-600 font-bold">
              {blog.category || "Education"}
            </span>
          </nav>

          <div className="flex items-center gap-3 text-[11px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-4">
            <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-100 rounded-md">
              {blog.category || "Education"}
            </span>
            <span className="w-1 h-1 bg-gray-300 rounded-full" />
            <span>{blog.readTime || 5} min read</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-slate-900 leading-[1.12] tracking-tight mb-5 font-display">
            {blog.title}
          </h1>

          {(blog.subtitle || (blog as any).excerpt) && (
            <p className="text-base sm:text-lg md:text-xl text-slate-600 font-normal leading-relaxed mb-8">
              {cleanExcerptText(blog.subtitle || (blog as any).excerpt)}
            </p>
          )}

          {/* Author & Publishing Metadata */}
          <div className="flex items-center gap-4 py-4 border-y border-slate-100">
            <div className="w-11 h-11 bg-indigo-100 rounded-2xl flex items-center justify-center font-bold text-indigo-700 text-base">
              {(blog.authorName || "V")[0]?.toUpperCase() || "V"}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Written by</p>
              <p className="text-slate-900 font-black text-sm">{blog.authorName || "VidyaLoans Editorial Staff"}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Published</p>
              <time
                dateTime={blog.publishedAt || (blog as any).createdAt}
                className="text-slate-900 font-bold text-xs"
              >
                {new Date(blog.publishedAt || (blog as any).createdAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </time>
            </div>
          </div>
        </div>



        {/* Article Body Content */}
        <div className="max-w-3xl mx-auto px-6">
          <style dangerouslySetInnerHTML={{ __html: `
            .blog-prose-content a:not(.blog-btn):not(.btn-submit-inquiry):not(.btn-reset-inquiry):not(.blog-cta-card a) {
              color: #2563eb !important;
              font-weight: 700 !important;
              text-decoration: underline !important;
              text-underline-offset: 4px !important;
              text-decoration-thickness: 2px !important;
              text-decoration-color: #60a5fa !important;
              background-color: rgba(239, 246, 255, 0.9) !important;
              padding: 2px 7px !important;
              border-radius: 6px !important;
              box-shadow: 0 1px 2px rgba(37, 99, 235, 0.08) !important;
              transition: all 0.2s ease !important;
              display: inline !important;
            }
            .blog-prose-content a:not(.blog-btn):not(.btn-submit-inquiry):not(.btn-reset-inquiry):not(.blog-cta-card a):hover {
              color: #1d4ed8 !important;
              text-decoration-color: #2563eb !important;
              background-color: #dbeafe !important;
              box-shadow: 0 2px 4px rgba(37, 99, 235, 0.16) !important;
            }
            .blog-prose-content a:not(.blog-btn):not(.btn-submit-inquiry):not(.btn-reset-inquiry):not(.blog-cta-card a)::after {
              content: " \\2197";
              font-size: 0.8em;
              font-weight: 900;
              opacity: 0.85;
              display: inline-block;
              margin-left: 2px;
            }
            .blog-toc a::after,
            .blog-cta-card a::after {
              content: none !important;
            }
            .blog-toc a {
              background-color: transparent !important;
              padding: 0 !important;
              box-shadow: none !important;
              display: flex !important;
            }
            .blog-cta-card a {
              background-color: transparent !important;
              box-shadow: none !important;
              text-decoration: none !important;
            }
            .blog-prose-content ul:not(.blog-toc ul) {
              list-style-type: disc !important;
              padding-left: 1.5rem !important;
              margin-top: 0.75rem !important;
              margin-bottom: 0.75rem !important;
            }
            .blog-prose-content ol {
              list-style-type: decimal !important;
              padding-left: 1.5rem !important;
              margin-top: 0.75rem !important;
              margin-bottom: 0.75rem !important;
            }
            .blog-prose-content li {
              display: list-item !important;
              padding-left: 0.25rem !important;
              margin-bottom: 0.35rem !important;
            }
            .blog-prose-content h1 {
              font-size: 2.25rem !important;
              font-weight: 900 !important;
              line-height: 1.2 !important;
              margin-top: 2.25rem !important;
              margin-bottom: 1rem !important;
              color: #0f172a !important;
              display: block !important;
            }
            .blog-prose-content h2 {
              font-size: 1.875rem !important;
              font-weight: 800 !important;
              line-height: 1.25 !important;
              margin-top: 2rem !important;
              margin-bottom: 0.75rem !important;
              color: #0f172a !important;
              display: block !important;
            }
            .blog-prose-content h3 {
              font-size: 1.5rem !important;
              font-weight: 700 !important;
              line-height: 1.3 !important;
              margin-top: 1.75rem !important;
              margin-bottom: 0.5rem !important;
              color: #1e293b !important;
              display: block !important;
            }
            .blog-prose-content h4 {
              font-size: 1.25rem !important;
              font-weight: 700 !important;
              line-height: 1.35 !important;
              margin-top: 1.5rem !important;
              margin-bottom: 0.5rem !important;
              color: #1e293b !important;
              display: block !important;
            }
            .blog-prose-content h5 {
              font-size: 1.125rem !important;
              font-weight: 600 !important;
              line-height: 1.4 !important;
              margin-top: 1.25rem !important;
              margin-bottom: 0.5rem !important;
              color: #334155 !important;
              display: block !important;
            }
            .blog-prose-content h6 {
              font-size: 0.875rem !important;
              font-weight: 600 !important;
              text-transform: uppercase !important;
              letter-spacing: 0.05em !important;
              line-height: 1.4 !important;
              margin-top: 1rem !important;
              margin-bottom: 0.25rem !important;
              color: #475569 !important;
              display: block !important;
            }
          `}} />
          <div
            className="prose prose-lg prose-indigo max-w-none blog-prose-content
              prose-headings:font-display prose-headings:font-black prose-headings:tracking-tight
              prose-p:text-slate-700 prose-p:leading-relaxed
              prose-strong:text-slate-900 prose-strong:font-bold
              prose-img:rounded-2xl prose-img:shadow-md
              prose-a:text-blue-600 prose-a:font-bold prose-a:underline prose-a:underline-offset-4 prose-a:decoration-2 prose-a:decoration-blue-400 hover:prose-a:decoration-blue-700 hover:prose-a:text-blue-800 prose-a:bg-blue-50/90 prose-a:px-1.5 prose-a:py-0.5 prose-a:rounded-md hover:prose-a:bg-blue-100 prose-a:transition-all prose-a:shadow-2xs"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(cleanBlogContent(blog.content || "")) }}
          />

          {/* Tag Badges */}
          {blog.tags && blog.tags.length > 0 && (
            <div className="mt-16 pt-8 border-t border-slate-100 flex flex-wrap gap-2">
              <span className="text-xs font-bold text-slate-400 mr-2 self-center">Tags:</span>
              {blog.tags.map((tag: string) => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-slate-50 hover:bg-slate-100 rounded-full text-xs font-bold text-slate-600 border border-slate-200"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Social Share Bar */}
          <BlogShareBar title={blog.title} url={canonicalUrl} />
        </div>

        {/* Bottom CTA Card */}
        <div className="max-w-4xl mx-auto px-6 mt-24">
          <div className="bg-gradient-to-br from-[#0A2540] to-indigo-950 rounded-3xl p-8 sm:p-14 text-center relative overflow-hidden shadow-2xl text-white">
            <div className="relative z-10 max-w-xl mx-auto space-y-4">
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 inline-block">
                Study Abroad & Loan Intelligence
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-white font-display">
                Looking for an Education Loan?
              </h2>
              <p className="text-indigo-200 text-sm sm:text-base leading-relaxed">
                Compare pre-approved loan options from 5+ partner banks &amp; NBFCs with 100% paperless verification and 48-hour approval processing.
              </p>
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/apply-loan"
                  className="px-8 py-3.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2"
                >
                  <span>Check Loan Eligibility Free</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </Link>
                <Link
                  href="/compare-loans"
                  className="px-6 py-3.5 bg-white/10 hover:bg-white/15 text-white border border-white/20 rounded-xl text-xs font-bold transition-all"
                >
                  Compare Bank Rates
                </Link>
              </div>
            </div>
          </div>
        </div>
      </article>
    </>
  );
}
