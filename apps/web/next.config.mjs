/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "artworks.thetvdb.com" },
    ],
  },
  rewrites: () => {
    return {
      beforeFiles: [
        { source: "/api/:path*", destination: "http://localhost:3002/api/:path*" },
      ],
    };
  },
};

export default nextConfig;
