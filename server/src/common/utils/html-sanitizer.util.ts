import sanitizeHtml from 'sanitize-html';

export const BLOG_ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'span', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'sub', 'sup', 'mark', 'small', 'del', 'ins',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code', 'hr', 'br', 'div',
  'a', 'img',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
  'details', 'summary', 'figure', 'figcaption',
  'form', 'input', 'button', 'select', 'option', 'label',
];

export const BLOG_ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ['href', 'name', 'target', 'rel', 'title', 'class'],
  img: ['src', 'srcset', 'alt', 'title', 'width', 'height', 'loading', 'class'],
  form: ['action', 'method', 'class', 'id'],
  input: ['type', 'name', 'value', 'placeholder', 'required', 'class', 'id', 'checked', 'readonly', 'disabled'],
  button: ['type', 'class', 'id', 'disabled'],
  select: ['name', 'class', 'id', 'required'],
  option: ['value', 'selected'],
  label: ['for', 'class'],
  '*': ['class', 'id', 'aria-*', 'role', 'style'],
};

/**
 * Sanitizes rich text HTML content to eliminate XSS vectors (scripts, event handlers, javascript: URIs).
 */
export const sanitizeBlogHtml = (dirtyHtml: string): string => {
  if (!dirtyHtml || typeof dirtyHtml !== 'string') return '';

  return sanitizeHtml(dirtyHtml, {
    allowedTags: BLOG_ALLOWED_TAGS,
    allowedAttributes: BLOG_ALLOWED_ATTRIBUTES,
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: {
      img: ['http', 'https', 'data'],
      form: ['http', 'https'],
    },
    allowProtocolRelative: false,
    disallowedTagsMode: 'completelyDiscard',
    nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript', 'iframe'],
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href || '';
        const isExternal = href.startsWith('http://') || href.startsWith('https://');
        return {
          tagName: 'a',
          attribs: {
            ...attribs,
            ...(isExternal ? { rel: 'noopener noreferrer' } : {}),
          },
        };
      },
    },
  });
};

/**
 * Sanitizes rich text blog content while preserving special metadata comments
 * such as <!--BLOCKS_JSON_START--> and <!--SEO_JSON_START-->.
 */
export const sanitizeBlogContentWithMetadata = (rawContent: string): string => {
  if (!rawContent || typeof rawContent !== 'string') return '';

  let htmlPortion = rawContent;
  let blocksComment = '';
  let seoComment = '';

  const blocksMatch = htmlPortion.match(/<!--BLOCKS_JSON_START-->([\s\S]*?)<!--BLOCKS_JSON_END-->/);
  if (blocksMatch) {
    blocksComment = blocksMatch[0];
    htmlPortion = htmlPortion.replace(blocksMatch[0], '');
  }

  const seoMatch = htmlPortion.match(/<!--SEO_JSON_START-->([\s\S]*?)<!--SEO_JSON_END-->/);
  if (seoMatch) {
    seoComment = seoMatch[0];
    htmlPortion = htmlPortion.replace(seoMatch[0], '');
  }

  const sanitizedHtml = sanitizeBlogHtml(htmlPortion).trim();

  let finalContent = sanitizedHtml;
  if (blocksComment) {
    finalContent += `\n\n${blocksComment}`;
  }
  if (seoComment) {
    finalContent += `\n${seoComment}`;
  }

  return finalContent;
};
