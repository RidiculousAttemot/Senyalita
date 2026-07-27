/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { dev }) => {
    // Next 14.2.5's bundled webpack hardcodes output.hashFunction to
    // "xxhash64", which routes through webpack's WASM hash implementation.
    // That implementation crashes on Node 24 ("Cannot read properties of
    // undefined (reading 'length')" in WasmHash._updateWithBuffer). Force
    // Node's native sha256 hasher instead, which bypasses WasmHash entirely.
    config.output.hashFunction = 'sha256';

    // Same root cause, later stage: the filesystem cache serialises modules
    // through that hasher, and on Node 24 it can emit a manifest referencing
    // chunks it never wrote — the build then dies with
    // "Cannot find module './<id>.js'" while collecting page data.
    // Production builds trade cache reuse for correctness; dev keeps the cache
    // because fast rebuilds matter more there and the failure is a build-only
    // symptom. Both workarounds become unnecessary on the pinned Node 22.
    if (!dev) {
      config.cache = false;
    }

    return config;
  },
  async redirects() {
    // /type-to-sign and /sign-to-text are kept as permanent redirects: the
    // pages themselves are gone (the workflows live on /translate), but the
    // paths were linked externally, so they should not start 404ing.
    return [
      {
        source: '/type-to-sign',
        destination: '/translate',
        permanent: true,
      },
      {
        source: '/sign-to-text',
        destination: '/translate',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
