import sanitizeHtml from "sanitize-html";
import he from "he";

const allowedTags = [
  "p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li",
  "h1", "h2", "h3", "blockquote", "a", "code", "pre",
];

export function sanitizeDraftHtml(value: string): string {
  return sanitizeHtml(value, {
    allowedTags,
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "nofollow noopener noreferrer", target: "_blank" }),
    },
  });
}

export function draftHtmlToText(value: string): string {
  const withParagraphBreaks = value
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "• ")
    .replace(/<\/(?:p|h[1-6]|li|blockquote|pre)>/gi, "\n");
  return he.decode(sanitizeHtml(withParagraphBreaks, { allowedTags: [], allowedAttributes: {} }))
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
