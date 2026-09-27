import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // Allows hosting on GitHub Pages under /<repo>: NEXT_PUBLIC_BASE_PATH=/RustCUI-Editor
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  images: { unoptimized: true },
};

export default nextConfig;
