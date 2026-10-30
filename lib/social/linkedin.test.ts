import assert from "node:assert/strict";
import test from "node:test";
import { LinkedInPublishError, publishLinkedInPost } from "./linkedin";

test("requires a configured LinkedIn API version", async () => {
  delete process.env.LINKEDIN_API_VERSION;
  await assert.rejects(
    () => publishLinkedInPost("token", "person-id", "Hello"),
    (error: unknown) => error instanceof LinkedInPublishError && /LINKEDIN_API_VERSION/.test(error.message),
  );
});

test("rejects empty or oversized post content before network access", async () => {
  process.env.LINKEDIN_API_VERSION = "202601";
  await assert.rejects(
    () => publishLinkedInPost("token", "person-id", ""),
    (error: unknown) => error instanceof LinkedInPublishError && /1–3,000/.test(error.message),
  );
  await assert.rejects(
    () => publishLinkedInPost("token", "person-id", "x".repeat(3001)),
    (error: unknown) => error instanceof LinkedInPublishError && /1–3,000/.test(error.message),
  );
});


test("marks server errors as uncertain and rate limits as safely retryable", async () => {
  const originalFetch = globalThis.fetch;
  process.env.LINKEDIN_API_VERSION = "202601";
  try {
    globalThis.fetch = async () => new Response("temporary provider error", { status: 503 });
    await assert.rejects(
      () => publishLinkedInPost("token", "person-id", "Hello"),
      (error: unknown) => error instanceof LinkedInPublishError && error.outcomeUncertain && !error.retryable,
    );
    globalThis.fetch = async () => new Response("rate limited", { status: 429 });
    await assert.rejects(
      () => publishLinkedInPost("token", "person-id", "Hello"),
      (error: unknown) => error instanceof LinkedInPublishError && error.retryable && !error.outcomeUncertain,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("treats transport failures as uncertain to prevent duplicate posts", async () => {
  const originalFetch = globalThis.fetch;
  process.env.LINKEDIN_API_VERSION = "202601";
  try {
    globalThis.fetch = async () => { throw new Error("socket reset"); };
    await assert.rejects(
      () => publishLinkedInPost("token", "person-id", "Hello"),
      (error: unknown) => error instanceof LinkedInPublishError && error.outcomeUncertain && !error.retryable,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
