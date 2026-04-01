import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "aubox.blob.core.windows.net",
        pathname: "/**",
      },
    ],
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/cases", destination: "/dashboard/cases" },
        { source: "/cases/:path*", destination: "/dashboard/cases/:path*" },
        { source: "/profile", destination: "/dashboard/profile" },
      ],
    };
  },
};

export default nextConfig;
