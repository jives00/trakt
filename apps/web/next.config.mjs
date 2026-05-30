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
    const apiUrl = process.env.API_URL ?? 'http://localhost:3002';
    return {
      beforeFiles: [
        { source: "/api/:path*", destination: `${apiUrl}/api/:path*`, basePath: false },
        { source: "/stremio-addon/:path*", destination: `${apiUrl}/stremio-addon/:path*`, basePath: false },
      ],
    };
  },
};

export default nextConfig;
