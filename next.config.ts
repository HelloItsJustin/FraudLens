import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The dev status badge is useful to framework developers, but not part of the FraudLens product UI.
  devIndicators: false,
};

export default nextConfig;
