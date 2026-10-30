import assert from "node:assert/strict";
import test from "node:test";
import { draftHtmlToText, sanitizeDraftHtml } from "./sanitize";

test("removes scripts, event handlers and unsafe URL schemes", () => {
  const safe = sanitizeDraftHtml('<p onclick="alert(1)">Hello <strong>team</strong></p><script>alert(1)</script><a href="javascript:alert(1)">bad link</a>');
  assert.match(safe, /<strong>team<\/strong>/);
  assert.doesNotMatch(safe, /script|onclick|javascript:/i);
});

test("converts rich text to plain text for social publishing", () => {
  assert.equal(draftHtmlToText("<h2>Launch</h2><p>Useful &amp; clear</p><ul><li>One</li></ul>"), "LaunchUseful & clearOne");
});
