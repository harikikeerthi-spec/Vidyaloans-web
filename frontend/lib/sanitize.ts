import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitize an HTML string to safely render using dangerouslySetInnerHTML.
 * Strips active scripts, iframes, objects, and any inline event handlers (onerror, onload, etc.).
 */
export function sanitizeHtml(dirtyHtml: string | null | undefined): string {
  if (!dirtyHtml || typeof dirtyHtml !== "string") return "";

  return DOMPurify.sanitize(dirtyHtml, {
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
  });
}

/**
 * Escapes characters in JSON-LD objects before embedding them into inline `<script>` tags,
 * replacing every `<` with `\u003c` to prevent `</script>` tag breakout XSS attacks.
 */
export function safeJsonLd(obj: any): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}
