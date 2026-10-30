import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep tracing inside this app even when a developer has unrelated parent lockfiles.
  outputFileTracingRoot: path.resolve(process.cwd()),
};

export default nextConfig;
