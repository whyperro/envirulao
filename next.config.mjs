// next.config.mjs
import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack(config) {
    // Alias para que "@/..." apunte siempre a la raíz del proyecto
    config.resolve.alias["@"] = path.resolve(process.cwd());
    return config;
  },
};

export default nextConfig;
