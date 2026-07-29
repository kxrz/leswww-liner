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
};

export default nextConfig;
