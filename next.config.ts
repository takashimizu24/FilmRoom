import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Allow accessing the dev server from other devices on the LAN (e.g. a phone
  // on the same Wi-Fi) — Next 16 blocks cross-origin dev resources by default.
  allowedDevOrigins: ["192.168.0.118"],
};

export default nextConfig;
