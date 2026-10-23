import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  async rewrites() {
    // Serve the Utility Hub (static files in public/tools) at tools.adiefalsyarif.my
    const toolsHost = [{ type: "host", value: "tools.adiefalsyarif.my" }];
    return [
      { source: "/", has: toolsHost, destination: "/tools/index.html" },
      { source: "/:path*", has: toolsHost, destination: "/tools/:path*" },
    ];
  },
};

export default nextConfig;