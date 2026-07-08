/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/type-to-sign',
        destination: '/translate',
        permanent: false,
      },
      {
        source: '/sign-to-text',
        destination: '/translate',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
