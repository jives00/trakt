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
        { source: "/nuvio-addon/:path*", destination: `${apiUrl}/nuvio-addon/:path*`, basePath: false },
      ],
    };
  },
};

export default nextConfig;
