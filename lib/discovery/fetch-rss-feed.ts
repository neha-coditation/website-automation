import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import type { IncomingMessage, RequestOptions } from "node:http";
import ipaddr from "ipaddr.js";

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 3;
const USER_AGENT = "MarketingStudio/0.1 (+https://github.com/neha-coditation/website-automation)";

export type SafeFeedResponse = {
  finalUrl: string;
  xml: string;
  contentType: string | null;
};

function isPublicAddress(address: string): boolean {
  try {
    let parsed = ipaddr.parse(address);
    if (parsed.kind() === "ipv6" && parsed.isIPv4MappedAddress()) {
      parsed = parsed.toIPv4Address();
    }
    return parsed.range() === "unicast";
  } catch {
    return false;
  }
}

async function resolvePublicAddress(hostname: string): Promise<{ address: string; family: number }> {
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error("Local network feed URLs are not allowed.");
  }

  const normalizedHost = hostname.replace(/^\\[|\\]$/g, "");
  const literalFamily = ipaddr.isValid(normalizedHost) ? ipaddr.parse(normalizedHost).kind() === "ipv4" ? 4 : 6 : 0;
  const records = literalFamily
    ? [{ address: hostname, family: literalFamily }]
    : await lookup(normalizedHost, { all: true, verbatim: true });

  if (records.length === 0 || records.some((record) => !isPublicAddress(record.address))) {
    throw new Error("The feed hostname resolves to a non-public or restricted IP address.");
  }

  return records[0];
}

function requestOnce(url: URL, address: { address: string; family: number }): Promise<{
  statusCode: number;
  headers: IncomingMessage["headers"];
  body: string;
}> {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    const options: RequestOptions = {
      protocol: url.protocol,
      hostname: url.hostname.replace(/^\\[|\\]$/g, ""),
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.1",
      },
      timeout: REQUEST_TIMEOUT_MS,
      // Pin the socket to the address that was validated above to reduce DNS-rebinding risk.
      lookup: ((_hostname: string, _options: unknown, callback: (error: NodeJS.ErrnoException | null, address: string, family: number) => void) => {
        callback(null, address.address, address.family);
      }) as RequestOptions["lookup"],
      ...(url.protocol === "https:" && !url.hostname.startsWith("[") ? { servername: url.hostname } : {}),
    };

    const req = transport.request(options, (res) => {
      const statusCode = res.statusCode ?? 0;
      const chunks: Buffer[] = [];
      let size = 0;

      res.on("data", (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size > MAX_RESPONSE_BYTES) {
          req.destroy(new Error("Feed response exceeds the 2 MB limit."));
          return;
        }
        chunks.push(buffer);
      });

      res.on("end", () => resolve({
        statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks).toString("utf8"),
      }));
    });

    req.on("timeout", () => req.destroy(new Error("Feed request timed out.")));
    req.on("error", reject);
    req.end();
  });
}

/**
 * Fetches an RSS/Atom feed using validated public DNS results and a pinned
 * destination address. Redirect destinations are independently validated.
 */
export async function fetchRssFeed(rawUrl: string): Promise<SafeFeedResponse> {
  let currentUrl: URL;
  try {
    currentUrl = new URL(rawUrl);
  } catch {
    throw new Error("Enter a valid feed URL.");
  }

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    if (currentUrl.protocol !== "http:" && currentUrl.protocol !== "https:") {
      throw new Error("Only HTTP and HTTPS feed URLs are supported.");
    }
    if (currentUrl.username || currentUrl.password) {
      throw new Error("Feed URLs must not contain credentials.");
    }

    const destination = await resolvePublicAddress(currentUrl.hostname);
    const response = await requestOnce(currentUrl, destination);

    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
      const location = response.headers.location;
      if (!location) throw new Error("Feed redirect did not include a destination.");
      if (redirectCount === MAX_REDIRECTS) throw new Error("Feed exceeded the redirect limit.");
      currentUrl = new URL(location, currentUrl);
      continue;
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`Feed server returned HTTP ${response.statusCode}.`);
    }

    const contentType = response.headers["content-type"]?.toLowerCase() ?? null;
    if (contentType && !/(xml|rss|atom|text\/plain)/i.test(contentType)) {
      throw new Error("The URL did not return an XML feed response.");
    }

    if (!response.body.trim()) throw new Error("The feed response was empty.");

    return {
      finalUrl: currentUrl.toString(),
      xml: response.body,
      contentType,
    };
  }

  throw new Error("Unable to fetch the feed.");
}
