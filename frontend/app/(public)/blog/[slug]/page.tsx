import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { BlogPost } from "@/types";
import BlogShareBar from "@/components/BlogShareBar";

interface Props {
  params: Promise<{
    slug: string;
  }>;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.vidyaloans.in";

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
      title: "Article Not Found | VidyaLoans",
      description: "The requested education loan guide or article could not be located.",
    };
  }

  const metaTitle =
    (blog as any).metaTitle ||
    `${blog.title} | VidyaLoans Education Guide`;
  const metaDescription =
    (blog as any).metaDescription ||
    blog.subtitle ||
    (blog as any).excerpt ||
    "Read comprehensive education loan guidance, interest rates, and university funding tips on VidyaLoans.";
  const canonicalUrl =
    (blog as any).canonicalUrl || `${SITE_URL}/blog/${blog.slug || slug}`;
  const ogImage =
    blog.coverImage ||
    blog.featuredImage ||
    `${SITE_URL}/images/og-default.jpg`;
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
    description: blog.subtitle || (blog as any).excerpt || "",
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

  return (
    <>
      {/* Schema.org Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdArticle) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }}
      />

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
              {blog.subtitle || (blog as any).excerpt}
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

        {/* Featured Hero Image */}
        <div className="max-w-5xl mx-auto px-6 mb-16">
          <div className="relative aspect-[21/9] rounded-3xl overflow-hidden shadow-xl bg-slate-100 border border-slate-100">
            <img
              src={coverImg}
              alt={blog.title}
              className="w-full h-full object-cover"
              loading="eager"
            />
          </div>
        </div>

        {/* Article Body Content */}
        <div className="max-w-3xl mx-auto px-6">
          <div
            className="prose prose-lg prose-indigo max-w-none 
              prose-headings:font-display prose-headings:font-black prose-headings:tracking-tight
              prose-p:text-slate-700 prose-p:leading-relaxed
              prose-strong:text-slate-900 prose-strong:font-bold
              prose-img:rounded-2xl prose-img:shadow-md
              prose-a:text-indigo-600 prose-a:font-bold prose-a:no-underline hover:prose-a:underline"
            dangerouslySetInnerHTML={{ __html: blog.content || "" }}
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
                Compare pre-approved loan options from 15+ premier banks & NBFCs with 100% paperless verification and 3-day approval guarantees.
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
