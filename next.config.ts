import type { NextConfig } from "next";

/**
 * Baseline security headers (OWASP Secure Headers recommendations), applied to
 * every response. A strict Content-Security-Policy needs per-request nonces for
 * the inline intro script and Next's streamed data — tracked as a follow-up.
 */
const securityHeaders = [
  // Only ever load over HTTPS (ignored by browsers on http://localhost).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Don't let browsers guess content types (stops MIME-sniffing attacks).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // No embedding in other sites' frames (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // Send only the origin to other sites, never full URLs.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Location only for this site's own pages; everything else off.
  {
    key: "Permissions-Policy",
    value: "geolocation=(self), camera=(), microphone=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false, // don't advertise the framework/version
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.googleusercontent.com" }],
  },
  headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
