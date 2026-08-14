import type { NextConfig } from "next";

// ponytail: headers de segurança sólidos e sem risco de quebrar o app. CSP ficou de fora de
// propósito — uma CSP estrita conflita com os estilos/scripts inline do Next e exige teste
// dedicado; upgrade quando alguém puder validar página a página.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" }, // anti-clickjacking (ninguém embute o app num iframe)
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // ponytail: expõe o ambiente da Vercel (production/preview/development) pro client bundle —
  // NODE_ENV não serve pra essa distinção (é "production" tanto em Preview quanto em Production
  // na Vercel). Usado pra esconder páginas em backlog (Bunker, Conta) só em produção.
  env: {
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
