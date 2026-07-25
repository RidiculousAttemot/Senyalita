/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Next 14.2.5's bundled webpack hardcodes output.hashFunction to
    // "xxhash64", which routes through webpack's WASM hash implementation.
    // That implementation crashes on Node 24 ("Cannot read properties of
    // undefined (reading 'length')" in WasmHash._updateWithBuffer). Force
    // Node's native sha256 hasher instead, which bypasses WasmHash entirely.
    config.output.hashFunction = 'sha256';
    return config;
  },
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
