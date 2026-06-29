/** @type {import('next').NextConfig} */

// On GitHub Pages we export a fully static site served from /<repo>/, so we set
// output:"export" + a basePath. The API route is removed from the build in CI
// for that target (the static client falls back to the on-device deterministic
// engine). On a server host (Vercel / local) we build normally and the live
// LLM extraction route is active.
const isPages = process.env.GITHUB_PAGES === "true";
const repo = "co-ver-change-order-demo";
const basePath = isPages ? `/${repo}` : "";

const nextConfig = {
  output: isPages ? "export" : undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  basePath,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
