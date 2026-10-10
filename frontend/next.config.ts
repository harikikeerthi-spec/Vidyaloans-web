/** @type {import('next').NextConfig} */


// Accept any trycloudflare.com tunnel automatically (wildcard) plus any
// additional origins supplied via ALLOWED_DEV_ORIGINS (comma-separated).
const envAllowed = process.env.ALLOWED_DEV_ORIGINS
  ? process.env.ALLOWED_DEV_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
  : [];

// Wildcard entry accepted by Next.js ≥ 15.1 – covers every random tunnel URL
// Cloudflare Quick Tunnels generate, so you never have to edit this file again.
const allowedDevOrigins: string[] = [
  '*.trycloudflare.com',
  ...envAllowed,
];

const nextConfig = {
  // Fix: explicitly set Turbopack root to this directory so Next.js does not
  // incorrectly infer the parent Loan/ folder as the workspace root.
  turbopack: {
    root: __dirname,
  },
  // Allow specific dev origins to request Next.js assets in development.
  // Use the ALLOWED_DEV_ORIGINS env var (comma-separated) to add more without changing code.
  allowedDevOrigins,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "i.pravatar.cc" },
      { protocol: "https", hostname: "img.icons8.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "ui-avatars.com" },
      { protocol: "https", hostname: "logo.clearbit.com" },
    ],
  },
  async redirects() {
    return [
      {
        source: "/apply",
        destination: "/apply-loan",
        permanent: true,
      },
      {
        source: "/privacy",
        destination: "/privacy-policy",
        permanent: true,
      },
      {
        source: "/terms",
        destination: "/terms-conditions",
        permanent: true,
      },
      {
        source: "/terms-of-service",
        destination: "/terms-conditions",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.BACKEND_URL || "http://127.0.0.1:5000"}/api/:path*`,
      },
      {
        source: "/socket.io",
        destination: `${process.env.BACKEND_URL || "http://127.0.0.1:5000"}/socket.io/`,
      },
      {
        source: "/socket.io/:path*",
        destination: `${process.env.BACKEND_URL || "http://127.0.0.1:5000"}/socket.io/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
