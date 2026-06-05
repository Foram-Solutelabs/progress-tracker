/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // `encoding` is an optional peer dep of node-fetch (pulled in by face-api.js).
    // It is never used at runtime in the browser, so stub it out to silence the
    // "Can't resolve 'encoding'" module-not-found warning that floods the console.
    config.resolve.fallback = { ...config.resolve.fallback, encoding: false }
    if (!isServer) {
      config.resolve.fallback.fs = false
    }
    return config
  },
};

export default nextConfig;
