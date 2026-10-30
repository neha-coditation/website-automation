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
  return he.decode(sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }))
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
