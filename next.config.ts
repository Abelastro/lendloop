import type { NextConfig } from "next";

const convexSite = process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "";
const convexCloud = process.env.NEXT_PUBLIC_CONVEX_URL ?? "";
const isDev = process.env.NODE_ENV !== "production";

function clerkFrontendApiHost(publishableKey: string | undefined) {
  if (!publishableKey) return null;
  try {
    const encoded = publishableKey.split("_").slice(2).join("_");
    const host = Buffer.from(encoded, "base64").toString("utf8").replace(/\$/, "");
    return host.includes(".") ? host : null;
  } catch {
    return null;
  }
}

const clerkHost = clerkFrontendApiHost(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
const clerkHosts = [
  ...(clerkHost ? [`https://${clerkHost}`] : []),
  ...(clerkHost?.includes(".clerk.accounts.dev")
    ? [`https://${clerkHost.replace(".clerk.accounts.dev", ".accounts.dev")}`]
    : []),
  "https://*.clerk.accounts.dev",
  "https://*.clerk.com",
];

const connectSources = [
  "'self'",
  "https://*.convex.cloud",
  "wss://*.convex.cloud",
  ...clerkHosts,
  "https://clerk-telemetry.com",
  "https://*.protect.clerk.com:*",
  ...(convexSite ? [convexSite] : []),
  ...(convexCloud ? [convexCloud] : []),
].join(" ");

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  // Next.js and Clerk bootstrap inline scripts. Replace with a nonce-based
  // policy before handling regulated or high-value data (see README).
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} ${clerkHosts.join(" ")} https://cdn.protect.clerk.com https://challenges.cloudflare.com`,
  "worker-src 'self' blob:",
  `frame-src 'self' https://challenges.cloudflare.com ${clerkHosts.join(" ")}`,
  `connect-src ${connectSources}`,
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    unoptimized: isDev,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.pexels.com",
        pathname: "/photos/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
