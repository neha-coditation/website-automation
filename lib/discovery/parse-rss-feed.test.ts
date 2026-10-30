import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeArticleUrl,
  parseRssFeedXml,
} from "./parse-rss-feed";

test("normalizes tracking parameters and URL fragments", () => {
  assert.equal(
    normalizeArticleUrl("https://example.com/story/?utm_source=newsletter&ref=home#top"),
    "https://example.com/story?ref=home",
  );
});

test("rejects unsupported and credential-bearing URLs", () => {
  assert.equal(normalizeArticleUrl("javascript:alert(1)"), null);
  assert.equal(normalizeArticleUrl("https://user:pass@example.com/story"), null);
});

test("parses RSS items into normalized discovery records", async () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
      <channel>
        <title>Example Tech</title>
        <description>Technology updates</description>
        <link>https://example.com</link>
        <item>
          <guid>story-123</guid>
          <title>New platform release</title>
          <link>https://example.com/platform?utm_medium=rss</link>
          <description>A short summary.</description>
          <author>Editorial Team</author>
          <pubDate>Tue, 27 Oct 2026 10:00:00 GMT</pubDate>
        </item>
        <item>
          <title>Item without a usable link</title>
          <description>This item should be skipped.</description>
        </item>
      </channel>
    </rss>`;

  const result = await parseRssFeedXml(xml);

  assert.equal(result.title, "Example Tech");
  assert.equal(result.siteUrl, "https://example.com/");
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].title, "New platform release");
  assert.equal(result.items[0].canonicalUrl, "https://example.com/platform");
  assert.equal(result.items[0].externalId, "story-123");
  assert.equal(result.items[0].description, "A short summary.");
  assert.equal(result.items[0].author, "Editorial Team");
  assert.equal(result.items[0].publishedAt?.toISOString(), "2026-10-27T10:00:00.000Z");
});

test("rejects empty and oversized feed responses", async () => {
  await assert.rejects(() => parseRssFeedXml("  "), /response was empty/);
  await assert.rejects(
    () => parseRssFeedXml("x".repeat(2 * 1024 * 1024 + 1)),
    /2 MB limit/,
  );
});
