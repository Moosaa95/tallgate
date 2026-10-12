/**
 * Content Security Policy.
 *
 * Enforced in production; kept report-only in development so that Fast Refresh
 * (which relies on eval and a websocket) is not broken. Next.js emits inline
 * hydration scripts, so `script-src` needs `'unsafe-inline'` until a nonce can
 * be threaded through statically rendered pages; everything not required by the
 * app (object, frame, base, form targets, external image hosts) is locked down.
 *
 * @param {boolean} isDev
 */
function buildContentSecurityPolicy(isDev) {
  return [
    "default-src 'self'",
    "img-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline'",
    isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    isDev
      ? "connect-src 'self' https://*.supabase.co ws: wss:"
      : "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: process.cwd(),
  poweredByHeader: false,
  async headers() {
    const isDev = process.env.NODE_ENV !== "production";
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: isDev
              ? "Content-Security-Policy-Report-Only"
              : "Content-Security-Policy",
            value: buildContentSecurityPolicy(isDev),
          },
        ],
      },
    ];
  },
  experimental: {
    optimizePackageImports: [
      "react-icons",
      "@headlessui/react",
    ],
  },
  webpack(config) {
    // Grab the existing rule that handles SVG imports
    const fileLoaderRule = config.module.rules.find((rule) =>
      rule.test?.test?.(".svg")
    );

    config.module.rules.push(
      // Reapply the existing rule, but only for svg imports ending in ?url
      {
        ...fileLoaderRule,
        test: /\.svg$/i,
        resourceQuery: /url/, // *.svg?url
      },
      // Convert all other *.svg imports to React components
      {
        test: /\.svg$/i,
        issuer: fileLoaderRule.issuer,
        resourceQuery: { not: [...fileLoaderRule.resourceQuery.not, /url/] }, // exclude if *.svg?url
        use: ["@svgr/webpack"],
      }
    );

    // Modify the file loader rule to ignore *.svg, since we have it handled now.
    fileLoaderRule.exclude = /\.svg$/i;

    return config;
  },

  // ...other config
};

if (process.env.NODE_ENV === "production") {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    console.warn("⚠️ Warning: Supabase public configuration is missing. Authentication and database-backed features will fail.");
  }
  if (!process.env.RESEND_API_KEY) {
    console.warn("⚠️ Warning: RESEND_API_KEY is not configured. Emails will fail in production.");
  }
  if (!process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL.includes("localhost")) {
    console.warn("⚠️ Warning: NEXT_PUBLIC_SITE_URL is missing or set to localhost. Certificate verification links may break.");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("⚠️ Warning: SUPABASE_SERVICE_ROLE_KEY is missing. Admin actions, rate limiting, and public form submissions will fail.");
  }
}

export default nextConfig;
