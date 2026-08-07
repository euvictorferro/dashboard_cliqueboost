// proxy.ts
// ponytail: Next.js 16 renomeou middleware.ts -> proxy.ts e trocou o runtime padrão de
// Edge pra Node.js. Precisa ser proxy.ts porque session.ts usa node:crypto (não roda no
// Edge Runtime que middleware.ts usava).
import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE_NAME } from "@/lib/session";

// ponytail: qualquer rota nova (página OU API) fora do padrão /[client]/... precisa
// entrar aqui, senão o proxy trata o primeiro segmento do path como clientId e bloqueia
// visitantes sem sessão.
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/sair", "/api/auth/logout", "/api/referrals"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname === p) ||
    pathname.startsWith("/r/") ||
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/" ||
    pathname === "/icon.png"
  ) {
    return NextResponse.next();
  }

  const session = verifySession(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  // rotas com [client] na URL: /tiago/..., /api/.../tiago/... — client_id é sempre o
  // primeiro segmento depois de /api/<recurso>/ ou o primeiro segmento da URL nas páginas.
  const clientIdInPath = pathname.startsWith("/api/")
    ? pathname.split("/")[3] // /api/<recurso>/<clientId>/...
    : pathname.split("/")[1]; // /<clientId>/...

  if (!session || (clientIdInPath && session.clientId !== clientIdInPath)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
