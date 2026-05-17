/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  basePath: '/trakt',
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
        { source: "/stremio-addon/:path*", destination: "http://localhost:3002/stremio-addon/:path*" },
      ],
    };
  },
};

export default nextConfig;
