import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // CVs are uploaded one file per request, which keeps each request under Vercel's 4.5 MB body limit.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  serverExternalPackages: ["mammoth", "unpdf"],
};

export default nextConfig;
