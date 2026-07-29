import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
        pathname: "/**",
      },
    ],
  },
  // Les polices sont lues à l'exécution par satori : sans cette inclusion
  // explicite, le traceur de Next ne les embarque pas dans la fonction.
  outputFileTracingIncludes: {
    "/api/album/refresh": ["./assets/fonts/**"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Contrairement à robots.txt, cet en-tête est respecté même quand un
          // moteur découvre une URL par un lien plutôt qu'en explorant le site.
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive, nosnippet, noimageindex",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
