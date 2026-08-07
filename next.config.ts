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
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
