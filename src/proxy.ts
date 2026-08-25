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
// ponytail: /internal saiu daqui de propósito — listava todos os clientes pra qualquer
// visitante. Sem entrada no PUBLIC_PATHS, o proxy exige sessão; admin acessa via visão espelho.
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/sair", "/api/auth/logout", "/api/referrals"];

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

  // ponytail: landing page pública (src/app/page.tsx) é pra o domínio apex (cliqueboost.io),
  // que ainda não está no ar — enquanto isso, "/" em qualquer domínio (dash.cliqueboost.io
  // incluso) manda direto pro login, que é a porta de entrada real hoje. Reverter quando o
  // domínio apex existir e passar a rotear por host.
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

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
  // /api/auth/update-credentials, /api/auth/session e /api/auth/onboarding fogem do padrão
  // (client_id vem da sessão, não da URL).
  const NO_CLIENT_IN_PATH_APIS = ["/api/auth/update-credentials", "/api/auth/session", "/api/auth/onboarding"];
  const clientIdInPath = NO_CLIENT_IN_PATH_APIS.includes(pathname)
    ? undefined
    : pathname.startsWith("/api/")
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

  // ponytail: conta temporária (email/senha provisórios criados por nós) — a troca obrigatória
  // é um popup em cima do dashboard (AppFrame → UpdateCredentialsModal), não um bloqueio de
  // rota aqui. Gate só de UX, não de segurança: dá pra chamar outras APIs por baixo do modal
  // via devtools. Upgrade pra bloqueio real (como antes) se algum dia isso importar.

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
