import assert from "node:assert/strict";
import test from "node:test";
import { fetchRssFeed } from "./fetch-rss-feed";

test("blocks localhost and local network destinations", async () => {
  await assert.rejects(() => fetchRssFeed("http://localhost/feed.xml"), /Local network/);
  await assert.rejects(() => fetchRssFeed("http://127.0.0.1/feed.xml"), /non-public/);
  await assert.rejects(() => fetchRssFeed("http://[::1]/feed.xml"), /non-public/);
});

test("rejects unsupported protocols and URL credentials", async () => {
  await assert.rejects(() => fetchRssFeed("file:///etc/passwd"), /Only HTTP and HTTPS/);
  await assert.rejects(() => fetchRssFeed("https://user:pass@example.com/feed.xml"), /must not contain credentials/);
});
