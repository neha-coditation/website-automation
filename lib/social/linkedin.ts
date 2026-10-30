type LinkedInPublishResult = { externalPostId: string | null; responseBody: string };

export async function publishLinkedInPost(
  accessToken: string,
  providerAccountId: string,
  commentary: string,
): Promise<LinkedInPublishResult> {
  const version = process.env.LINKEDIN_API_VERSION;
  if (!version || !/^20\d{4}$/.test(version)) {
    throw new Error("Set LINKEDIN_API_VERSION to a currently supported LinkedIn API version.");
  }
  if (!commentary.trim() || commentary.length > 3000) {
    throw new Error("LinkedIn post text must contain 1–3,000 characters.");
  }
  const response = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "LinkedIn-Version": version,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: `urn:li:person:${providerAccountId}`,
      commentary,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const responseBody = await response.text();
  if (!response.ok) {
    throw new Error(`LinkedIn returned HTTP ${response.status}: ${responseBody.slice(0, 500)}`);
  }
  return {
    externalPostId: response.headers.get("x-restli-id") || response.headers.get("location"),
    responseBody: responseBody.slice(0, 4000),
  };
}
