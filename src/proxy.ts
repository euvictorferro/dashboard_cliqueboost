// proxy.ts
// ponytail: Next.js 16 renomeou middleware.ts -> proxy.ts e trocou o runtime padrão de
// Edge pra Node.js. Precisa ser proxy.ts porque session.ts usa node:crypto (não roda no
// Edge Runtime que middleware.ts usava).
import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE_NAME } from "@/lib/session";
import { verifyAdminSession, ADMIN_SESSION_COOKIE_NAME } from "@/lib/adminSession";

// ponytail: qualquer rota nova (página OU API) fora do padrão /[client]/... precisa
// entrar aqui, senão o proxy trata o primeiro segmento do path como clientId e bloqueia
// visitantes sem sessão.
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/sair", "/api/auth/logout", "/api/referrals", "/internal"];

const ADMIN_PUBLIC_PATHS = ["/admin/login", "/api/admin/auth/login", "/api/admin/auth/logout", "/api/admin/auth/google"];

export function proxy(request: NextRequest) {
  const { pathname: originalPathname } = request.nextUrl;

  // admin.cliqueboost.io/clientes → /admin/clientes (rewrite interno, URL do usuário fica limpa)
  const host = request.headers.get("host") ?? "";
  const isAdminHost = host.startsWith("admin.");
  if (
    isAdminHost &&
    !originalPathname.startsWith("/admin") &&
    !originalPathname.startsWith("/api/") &&
    !/\.[a-zA-Z0-9]+$/.test(originalPathname) &&
    !originalPathname.startsWith("/_next/")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = `/admin${originalPathname === "/" ? "" : originalPathname}`;
    return NextResponse.rewrite(url);
  }

  const { pathname } = request.nextUrl;

  // Árvore do admin: sessão própria, nada a ver com a de cliente abaixo.
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (ADMIN_PUBLIC_PATHS.some((p) => pathname === p)) return NextResponse.next();
    const adminSession = verifyAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value);
    if (!adminSession) {
      if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  if (
    PUBLIC_PATHS.some((p) => pathname === p) ||
    pathname.startsWith("/r/") ||
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/" ||
    // ponytail: qualquer arquivo estático de public/ (logo-*.png, icon.png, futuros assets) —
    // sem isso o proxy trata o nome do arquivo como clientId e bloqueia o asset pra quem não
    // tem sessão (bug real encontrado ao construir a tela de login: logo quebrado nela mesma).
    /\.[a-zA-Z0-9]+$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  const session = verifySession(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  // rotas com [client] na URL: /tiago/..., /api/.../tiago/... — client_id é sempre o
  // primeiro segmento depois de /api/<recurso>/ ou o primeiro segmento da URL nas páginas.
  const clientIdInPath = pathname.startsWith("/api/")
    ? pathname.split("/")[3] // /api/<recurso>/<clientId>/...
    : pathname.split("/")[1]; // /<clientId>/...

  const hasClientSession = session && (!clientIdInPath || session.clientId === clientIdInPath);
  // Admin logado enxerga (e edita) o dashboard de qualquer cliente — visão espelho.
  const hasAdminSession = verifyAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value) !== null;

  if (!hasClientSession && !hasAdminSession) {
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
