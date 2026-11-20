import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
// CI's Lighthouse run serves a production build over plain http://localhost.
const httpPreview = process.env.LOCAL_HTTP_PREVIEW === "1";

// 'unsafe-inline' for scripts is needed by Next.js hydration without nonces.
// challenges.cloudflare.com serves the Turnstile bot check (script + iframe).
const TURNSTILE = "https://challenges.cloudflare.com";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${TURNSTILE}${isDev ? " 'unsafe-eval'" : ""}`,
  `frame-src ${TURNSTILE}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' ${TURNSTILE}${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev || httpPreview ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  ...(httpPreview ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Report form: up to 5 evidence files x 10 MB, plus text fields.
    serverActions: { bodySizeLimit: "52mb" },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/(admin|dashboard|account|login)/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/(admin|dashboard|account|login)", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;
