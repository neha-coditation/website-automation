export class LinkedInPublishError extends Error {
  constructor(message: string, public statusCode: number | null, public retryable: boolean) {
    super(message);
    this.name = "LinkedInPublishError";
  }
}

type LinkedInPublishResult = { externalPostId: string | null; responseBody: string };

export async function publishLinkedInPost(
  accessToken: string,
  providerAccountId: string,
  commentary: string,
): Promise<LinkedInPublishResult> {
  const version = process.env.LINKEDIN_API_VERSION;
  if (!version || !/^20\d{4}$/.test(version)) {
    throw new LinkedInPublishError("Set LINKEDIN_API_VERSION to a currently supported LinkedIn API version.", null, false);
  }
  if (!commentary.trim() || commentary.length > 3000) {
    throw new LinkedInPublishError("LinkedIn post text must contain 1–3,000 characters.", null, false);
  }
  let response: Response;
  try {
    response = await fetch("https://api.linkedin.com/rest/posts", {
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
  } catch {
    // The request may have reached LinkedIn before the connection failed.
    // Do not automatically retry an outcome that may have succeeded remotely.
    throw new LinkedInPublishError("LinkedIn request outcome is unknown; reconcile the post before retrying.", null, false);
  }
  const responseBody = await response.text();
  if (!response.ok) {
    throw new LinkedInPublishError(
      `LinkedIn returned HTTP ${response.status}: ${responseBody.slice(0, 500)}`,
      response.status,
      response.status === 429,
    );
  }
  return {
    externalPostId: response.headers.get("x-restli-id") || response.headers.get("location"),
    responseBody: responseBody.slice(0, 4000),
  };
}
