import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import pkg from "./package.json";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig & { eslint?: { ignoreDuringBuilds?: boolean } } = {
  // Versión y commit visibles en cliente vía process.env.NEXT_PUBLIC_*.
  // VERCEL_GIT_COMMIT_SHA es inyectado automáticamente por Vercel en build.
  env: {
    NEXT_PUBLIC_VERSION: pkg.version,
    NEXT_PUBLIC_GIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA || "",
  },
  typescript: {
    // Permite que el build pase aunque haya errores de tipos
    ignoreBuildErrors: true,
  },
  eslint: {
    // Permite que el build pase aunque haya errores de ESLint
    ignoreDuringBuilds: true,
  },
  async headers() {
    const isDev = process.env.NODE_ENV !== "production";
    // Dev necesita unsafe-eval (React Refresh) y unsafe-inline (HMR).
    // Prod: endurecemos script-src quitando unsafe-eval; dejamos unsafe-inline
    // hasta migrar a nonces (Next.js hidrata con scripts inline).
    // Paddle.js se carga desde cdn.paddle.com (checkout). Debe permitirse en script-src.
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.paddle.com"
      : "script-src 'self' 'unsafe-inline' https://cdn.paddle.com";
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              scriptSrc,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              `connect-src 'self' ${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"} https://*.supabase.co wss://*.supabase.co https://*.paddle.com`,
              "frame-ancestors 'none'",
              "frame-src 'self' blob: https://*.paddle.com",
              "child-src 'self' blob:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
