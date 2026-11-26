import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // @libsql/client debe ser externo: si Turbopack lo empaqueta, el módulo
  // cae en una capa donde process.env está sustituido y Turso no recibe
  // credenciales (recomendación oficial de Turso para Next.js).
  serverExternalPackages: ["@libsql/client", "libsql", "better-sqlite3"],
};

export default nextConfig;
