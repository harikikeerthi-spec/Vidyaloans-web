import DOMPurify from "dompurify";

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "span", "strong", "b", "em", "i", "u", "s", "strike", "sub", "sup", "mark", "small", "del", "ins",
    "ul", "ol", "li",
    "blockquote", "pre", "code", "hr", "br", "div",
    "a", "img",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
    "details", "summary", "figure", "figcaption",
    "form", "input", "button", "select", "option", "label",
  ],
  ALLOWED_ATTR: [
    "href", "name", "target", "rel", "title", "class", "id", "style",
    "src", "srcset", "alt", "width", "height", "loading",
    "action", "method", "type", "value", "placeholder", "required", "checked", "readonly", "disabled", "for",
    "role",
  ],
  FORBID_TAGS: ["script", "iframe", "object", "embed", "applet", "style"],
  FORBID_ATTR: [
    "onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur",
    "onchange", "onsubmit", "onkeydown", "onkeyup", "onkeypress", "onmouseenter", "onmouseleave"
  ],
};

function serverSanitizeHtml(dirty: string): string {
  if (!dirty || typeof dirty !== "string") return "";

  // 1. Strip forbidden tags with content: script, style, object, embed, applet, iframe
  let clean = dirty.replace(/<\s*(script|style|object|embed|applet|iframe)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "");
  // 2. Strip any remaining opening/closing forbidden tags
  clean = clean.replace(/<\s*\/?\s*(script|style|object|embed|applet|iframe)\b[^>]*>/gi, "");
  // 3. Strip all inline event handlers (onerror, onload, onclick, on*, etc.)
  clean = clean.replace(/\s+on[a-zA-Z0-9_-]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, "");
  // 4. Neutralize dangerous URL schemes (javascript:, vbscript:, data:text/html) in attributes
  clean = clean.replace(/(href|src|action|formaction)\s*=\s*(['"])\s*(?:javascript|vbscript|data\s*:\s*text\/html):[\s\S]*?\2/gi, '$1="#"');
  clean = clean.replace(/(href|src|action|formaction)\s*=\s*(?:javascript|vbscript|data\s*:\s*text\/html):[^\s>]+/gi, '$1="#"');

  return clean;
}

/**
 * Sanitize an HTML string to safely render using dangerouslySetInnerHTML.
 * Strips active scripts, iframes, objects, and any inline event handlers (onerror, onload, etc.).
 * Works seamlessly in both browser and Server-Side Rendering (SSR / Turbopack) environments without jsdom.
 */
export function sanitizeHtml(dirtyHtml: string | null | undefined): string {
  if (!dirtyHtml || typeof dirtyHtml !== "string") return "";

  // If in browser, use DOMPurify directly
  if (typeof window !== "undefined" && DOMPurify && typeof DOMPurify.sanitize === "function") {
    return DOMPurify.sanitize(dirtyHtml, SANITIZE_CONFIG);
  }

  // On server (SSR / Turbopack / Node runtime), sanitize safely without jsdom
  return serverSanitizeHtml(dirtyHtml);
}

/**
 * Escapes characters in JSON-LD objects before embedding them into inline `<script>` tags,
 * replacing every `<` with `\u003c` to prevent `</script>` tag breakout XSS attacks.
 */
export function safeJsonLd(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}
