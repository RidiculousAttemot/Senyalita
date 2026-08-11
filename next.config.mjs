/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /**
   * Traced server bundle, for the Docker runtime stage.
   *
   * Without it the image has to copy the whole of node_modules. Standalone
   * emits .next/standalone with only the modules actually reachable from the
   * server, which is what the runtime stage copies.
   *
   * Harmless outside Docker: Vercel ignores it, and `next dev` and `next start`
   * are unaffected. It does NOT include public/ or .next/static — those are
   * copied separately, and forgetting them yields a server that boots and
   * serves 404s for every asset.
   */
  output: "standalone",
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
  async headers() {
    // Next applies immutable caching to its own /_next/static output, but not to
    // anything under public/. Measured on production, weights.bin was served
    // with "max-age=0, must-revalidate" — 312KB revalidated on every load — and
    // the vendored MediaPipe runtime would inherit the same, trading a slow CDN
    // for a slow origin.
    //
    // These files are safe to pin because their content is fixed for a given
    // build: the WASM is copied from a pinned package version, the .task is a
    // released model artifact, and the BiLSTM weights change only when the model
    // is retrained — which also changes model.json, so a stale weights.bin can
    // never pair with a new topology without both being re-fetched.
    const immutable = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }];
    return [
      { source: "/mediapipe/wasm/:path*", headers: immutable },
      { source: "/models/:path*", headers: immutable },
    ];
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
      // /conversation was removed by the scope reduction, not moved. There is
      // no equivalent surface, so it lands on /translate rather than 404ing.
      //
      // Deliberately 307 (permanent: false), unlike the two above. Those are
      // renames — the workflows genuinely live on /translate now, so a 301 is
      // accurate and cacheable forever. This one is a deletion, and a 301 is
      // cached by the browser indefinitely: if the page ever came back, anyone
      // who hit the redirect once would keep being bounced with no way to
      // clear it.
      //
      // That is not hypothetical. /learn had a redirect here and now does not:
      // it was rebuilt as a learning reference. Because the redirect was 307,
      // nothing has to be un-cached. /evaluation made the same point earlier —
      // a page removed under the two-workflow rule can turn out to be needed.
      {
        source: '/conversation',
        destination: '/translate',
        permanent: false,
      },
      // The detail route had a dynamic segment; :id is discarded because
      // nothing on /translate consumes a conversation id.
      {
        source: '/conversation/:id',
        destination: '/translate',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
