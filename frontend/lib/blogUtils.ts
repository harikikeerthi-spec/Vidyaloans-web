/**
 * Shared Blog Utilities for cleaning content, excerpts, and extracting Table of Contents headings.
 */

export interface BlogHeading {
  id: string;
  text: string;
  level: number;
}

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
    .replace(/<div[^>]*class="[^"]*blog-cover-page[^"]*"[\s\S]*?(?:<\/div>\s*){1,6}/gi, "")
    .replace(/<div[^>]*class="[^"]*pt-5 mt-4 border-t[^"]*"[^>]*>[\s\S]*?Official References[\s\S]*?<\/div>/gi, "")
    .replace(/<div[^>]*style="[^"]*border-color:\s*rgba\(255,\s*255,\s*255,\s*0\.12\)[^"]*"[^>]*>[\s\S]*?Official References[\s\S]*?<\/div>/gi, "")
    .replace(/(?:\[\s*\]|\{\s*\})?\s*\{[\s\S]*?"metaTitle"[\s\S]*?\}/gi, "")
    .replace(/^(?:\s*<\/div\s*>)+/gi, "")
    .trim();
}

/**
 * Parses headings (h1 - h6) from blog HTML and injects unique IDs + scroll margins.
 * Also extracts any authored custom Table of Contents title.
 * If no standard heading tags are found, gracefully discovers bold section titles (<p><strong>...</strong></p>).
 */
export function extractHeadingsAndEnhanceHtml(rawHtml: string): {
  headings: BlogHeading[];
  enhancedHtml: string;
  tocTitle: string;
} {
  if (!rawHtml || typeof rawHtml !== "string") {
    return { headings: [], enhancedHtml: "", tocTitle: "Table of Contents" };
  }

  // 1. Extract custom TOC title if an inline <nav class="blog-toc ..."> was authored
  let tocTitle = "Table of Contents";
  const tocMatch = rawHtml.match(/<nav[^>]*class="[^"]*blog-toc[^"]*"[^>]*>[\s\S]*?<span[^>]*>(.*?)<\/span>/i);
  if (tocMatch && tocMatch[1]) {
    const candidate = cleanExcerptText(tocMatch[1]);
    if (candidate && candidate.length > 2 && !candidate.toLowerCase().includes("material-symbols")) {
      tocTitle = candidate;
    }
  }

  // 2. Extract headings (h1 - h6) and inject id and scroll-margin attributes
  const headings: BlogHeading[] = [];
  const seenIds = new Set<string>();

  let enhancedHtml = rawHtml.replace(
    /<h([1-6])(\b[^>]*)>([\s\S]*?)<\/h\1>/gi,
    (match, levelStr, attrs, innerContent) => {
      const level = parseInt(levelStr, 10);
      const text = cleanExcerptText(innerContent);
      if (!text) return match;

      // Extract existing id if any
      const idMatch = attrs.match(/\bid=(["'])(.*?)\1/i);
      let id = idMatch ? idMatch[2] : "";

      if (!id) {
        id = text
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
      }
      if (!id) {
        id = `section-${headings.length + 1}`;
      }

      // Ensure id uniqueness
      let uniqueId = id;
      let counter = 1;
      while (seenIds.has(uniqueId)) {
        uniqueId = `${id}-${counter}`;
        counter++;
      }
      seenIds.add(uniqueId);

      headings.push({
        id: uniqueId,
        text,
        level,
      });

      // Update attributes with uniqueId and ensure scroll-margin-top class
      let newAttrs = attrs;
      if (idMatch) {
        newAttrs = newAttrs.replace(/\bid=(["'])(.*?)\1/i, `id="${uniqueId}"`);
      } else {
        newAttrs = ` id="${uniqueId}"${newAttrs}`;
      }

      if (/class=(["'])(.*?)\1/i.test(newAttrs)) {
        newAttrs = newAttrs.replace(/class=(["'])(.*?)\1/i, (_m: string, q: string, cls: string) => {
          return `class=${q}${cls.includes("scroll-mt") ? cls : `${cls} scroll-mt-28`}${q}`;
        });
      } else {
        newAttrs += ` class="scroll-mt-28"`;
      }

      return `<h${level}${newAttrs}>${innerContent}</h${level}>`;
    }
  );

  // 3. Fallback: if fewer than 2 headings found, scan for standalone <p><strong>Heading</strong></p>
  if (headings.length < 2) {
    enhancedHtml = enhancedHtml.replace(
      /<p(\b[^>]*)>\s*<(strong|b)>([\s\S]*?)<\/\2>\s*<\/p>/gi,
      (match, attrs, tag, innerContent) => {
        const text = cleanExcerptText(innerContent);
        // Only treat as heading if reasonably short and non-empty
        if (!text || text.length > 85 || (text.includes(".") && text.split(".").length > 2)) return match;

        let id = text
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
        if (!id) id = `section-${headings.length + 1}`;

        let uniqueId = id;
        let counter = 1;
        while (seenIds.has(uniqueId)) {
          uniqueId = `${id}-${counter}`;
          counter++;
        }
        seenIds.add(uniqueId);

        headings.push({
          id: uniqueId,
          text,
          level: 2,
        });

        return `<h2 id="${uniqueId}" class="scroll-mt-28 font-display font-extrabold text-2xl text-slate-900 mt-8 mb-3 block">${innerContent}</h2>`;
      }
    );
  }

  // 4. Ultimate fallback: if still no headings, create default section anchors so TOC is ALWAYS available
  if (headings.length === 0 && cleanExcerptText(rawHtml).length > 100) {
    headings.push({
      id: "overview",
      text: "Overview & Key Insights",
      level: 2,
    });
    headings.push({
      id: "details",
      text: "Detailed Guide & Insights",
      level: 2,
    });
    enhancedHtml = `<div id="overview" class="scroll-mt-28"></div>` + enhancedHtml;
  }

  return { headings, enhancedHtml, tocTitle };
}

