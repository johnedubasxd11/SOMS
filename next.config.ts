import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // There is a stray package.json in the user profile directory, which makes
  // Turbopack pick the wrong workspace root. Pin it to this project.
  turbopack: {
    root: path.resolve(process.cwd()),
  },
  // exceljs ships CommonJS internals that break when bundled - require it
  // from node_modules at runtime instead. (@react-pdf/renderer is already in
  // Next's default list.)
  serverExternalPackages: ["exceljs"],
};

export default nextConfig;
