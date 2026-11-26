import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a second local dev server (e.g. for testing) use its own build folder.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
