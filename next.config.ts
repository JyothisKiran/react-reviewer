import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  serverExternalPackages: [
    "@typescript-eslint/parser",
    "@typescript-eslint/eslint-plugin",
    "eslint-plugin-react-hooks",
    "eslint-plugin-jsx-a11y",
  ],
  // lib/review/prompt.ts reads these with fs at request time, so ship them with the route.
  outputFileTracingIncludes: {
    "/api/review": ["./prompts/*.md"],
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
