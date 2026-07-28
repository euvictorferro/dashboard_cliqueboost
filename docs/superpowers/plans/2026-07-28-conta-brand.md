# Página Conta — Brand (cor + logo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar cada cliente escolher uma cor principal (aplicada de verdade no dashboard dele) e subir um logo (exibido só na página Conta).

**Architecture:** `client_settings` ganha 2 colunas novas (`brand_color`, `logo_url`). Um bucket novo do Supabase Storage guarda os arquivos de logo. Um `layout.tsx` novo, compartilhado por todas as páginas de um cliente, sobrescreve a CSS variable `--brand-primary` quando o cliente tem cor customizada. Duas rotas novas (`PUT /api/conta/[client]/brand`, `POST /api/conta/[client]/logo`) lidam com salvar cor e subir logo.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4, Supabase (`@supabase/supabase-js` + Storage) — sem dependências novas.

## Global Constraints

- Sem seleção de fonte, sem substituir o logo da Sidebar (continua Clique Boost), sem ajuste de contraste automático — tudo já decidido na spec, não reabrir.
- Cor: `<input type="color">` nativo, sem biblioteca de color picker.
- Logo: só PNG/JPEG/SVG, máx. 2MB, guardado em `client-logos/{clientId}/logo.<ext>` (sobrescreve em cada novo upload).
- O bucket `client-logos` é público (leitura sem autenticação) — não é dado sensível.
- Sem suíte de testes automatizada neste projeto (padrão já estabelecido) — verificação via `npx tsc --noEmit`, `npm run build`, script Node isolado, curl real (incluindo upload real de teste), e checagem visual.
- Não mesclar em `main`/`staging` sem aprovação explícita do Victor.

## Handoff obrigatório antes da Task 1

Este plano cria uma migration nova (`supabase/migrations/0007_client_settings_brand.sql`). Antes de prosseguir na Task 1:

1. O implementador cria o arquivo da migration, PARA e avisa o controller/Victor, pedindo pra rodar o SQL no SQL Editor do Supabase.
2. Só depois da confirmação, o implementador continua pro resto da Task 1.

(A criação do bucket do Storage NÃO precisa de handoff — é feita via API com a Service Role Key, dentro da própria task.)

---

### Task 1: Migration + bucket de Storage + `clientSettings.ts` + `hexColor.ts`

**Files:**
- Create: `supabase/migrations/0007_client_settings_brand.sql`
- Modify: `src/lib/clientSettings.ts` (arquivo inteiro será substituído)
- Create: `src/lib/hexColor.ts`

**Interfaces:**
- Produces: `ClientSettings = { timeZone: string; brandColor: string | null; logoUrl: string | null }`, `fetchClientSettings(clientId): Promise<ClientSettings>` (assinatura de retorno estendida), `updateClientSettings(clientId, timeZone): Promise<void>` (sem mudança), `updateClientBrand(clientId, { brandColor?, logoUrl? }): Promise<void>` (novo, upsert parcial); `hexToHslTriplet(hex): string` — consumidos pelas Tasks 2, 3 e 4.

- [ ] **Step 1: Criar a migration `supabase/migrations/0007_client_settings_brand.sql`**

```sql
alter table client_settings add column if not exists brand_color text;
alter table client_settings add column if not exists logo_url text;
```

- [ ] **Step 2: PARAR e pedir handoff**

Avise o controller/Victor: "Criei a migration `0007_client_settings_brand.sql`. Preciso que você rode esse SQL no SQL Editor do Supabase antes de eu continuar." Espere a confirmação antes de prosseguir.

- [ ] **Step 3: Criar o bucket `client-logos` no Supabase Storage**

```bash
set -a && source .env.local && set +a
curl -s -X POST "$SUPABASE_URL/storage/v1/bucket" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"id": "client-logos", "name": "client-logos", "public": true}'
```

Expected: resposta de sucesso (`{"name":"client-logos"}`) OU um erro indicando que o bucket já existe (`"Bucket already exists"` ou similar) — nesse caso está tudo bem, é idempotente, siga em frente.

- [ ] **Step 4: Substituir `src/lib/clientSettings.ts` inteiro**

```ts
// src/lib/clientSettings.ts
// ponytail: server-only — nunca importar isto de um componente "use client" (usa a Service Role Key).
import { getSupabaseAdmin } from "./supabase";
import { DEFAULT_TIME_ZONE } from "./clientTime";

export type ClientSettings = { timeZone: string; brandColor: string | null; logoUrl: string | null };

export async function fetchClientSettings(clientId: string): Promise<ClientSettings> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { data, error } = await supabase
    .from("client_settings")
    .select("time_zone, brand_color, logo_url")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    timeZone: data?.time_zone ?? DEFAULT_TIME_ZONE,
    brandColor: data?.brand_color ?? null,
    logoUrl: data?.logo_url ?? null,
  };
}

export async function updateClientSettings(clientId: string, timeZone: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { error } = await supabase
    .from("client_settings")
    .upsert({ client_id: clientId, time_zone: timeZone }, { onConflict: "client_id" });
  if (error) throw new Error(error.message);
}

// ponytail: upsert parcial — só grava as colunas passadas, não mexe em time_zone/logo_url quando
// só a cor é enviada (Postgres ON CONFLICT DO UPDATE SET só atualiza as colunas do payload).
export async function updateClientBrand(
  clientId: string,
  brand: { brandColor?: string; logoUrl?: string }
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const patch: Record<string, string> = { client_id: clientId };
  if (brand.brandColor !== undefined) patch.brand_color = brand.brandColor;
  if (brand.logoUrl !== undefined) patch.logo_url = brand.logoUrl;
  const { error } = await supabase.from("client_settings").upsert(patch, { onConflict: "client_id" });
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 5: Criar `src/lib/hexColor.ts`**

```ts
// src/lib/hexColor.ts
// ponytail: matemática pura de conversão hex -> HSL, sem biblioteca — só usado pra alimentar as
// CSS variables do projeto, que já usam o formato "H S% L%" (mesmo formato de globals.css).
export function hexToHslTriplet(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
```

- [ ] **Step 6: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 7: Verificar `hexToHslTriplet` com um script Node isolado**

```bash
cat > /tmp/verify-hexcolor.mjs << 'EOF'
function hexToHslTriplet(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) { console.error(`FAIL ${label}: got "${actual}", expected "${expected}"`); process.exitCode = 1; }
  else console.log(`OK ${label}`);
}

assertEqual(hexToHslTriplet("#FF0000"), "0 100% 50%", "vermelho puro");
assertEqual(hexToHslTriplet("#00FF00"), "120 100% 50%", "verde puro");
assertEqual(hexToHslTriplet("#0000FF"), "240 100% 50%", "azul puro");
assertEqual(hexToHslTriplet("#FFFFFF"), "0 0% 100%", "branco");
assertEqual(hexToHslTriplet("#000000"), "0 0% 0%", "preto");
EOF
node /tmp/verify-hexcolor.mjs
rm /tmp/verify-hexcolor.mjs
```

Expected: 5 linhas `OK ...`, nenhuma `FAIL`.

- [ ] **Step 8: Build**

Run: `npm run build`
Expected: build limpo.

- [ ] **Step 9: Verificação real — round-trip de `updateClientBrand`/`fetchClientSettings` com `client_id` de teste descartável**

**Importante**: use `client_id = "__test__"` (nunca um cliente real) — `client_settings` tem `client_id` como chave primária, então "apagar por id específico" não existe, só "apagar por client_id" (lição já registrada em rodadas anteriores deste projeto).

```bash
set -a && source .env.local && set +a
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
(async () => {
  const { error: upsertError } = await supabase.from('client_settings').upsert({ client_id: '__test__', brand_color: '#7C3AED' }, { onConflict: 'client_id' });
  if (upsertError) { console.error('FAIL upsert', upsertError.message); process.exit(1); }
  const { data, error } = await supabase.from('client_settings').select('time_zone, brand_color, logo_url').eq('client_id', '__test__').maybeSingle();
  if (error) { console.error('FAIL select', error.message); process.exit(1); }
  if (data.brand_color !== '#7C3AED') { console.error('FAIL: brand_color não bateu', JSON.stringify(data)); process.exit(1); }
  console.log('OK: brand_color salvo e lido corretamente', JSON.stringify(data));
  const { error: deleteError } = await supabase.from('client_settings').delete().eq('client_id', '__test__');
  if (deleteError) { console.error('FAIL delete', deleteError.message); process.exit(1); }
  const { data: after } = await supabase.from('client_settings').select('client_id').eq('client_id', '__test__').maybeSingle();
  if (after) { console.error('FAIL: linha de teste não foi removida'); process.exit(1); }
  console.log('OK: linha de teste removida, client_settings sem resíduo');
})();
"
```

Expected: `OK: brand_color salvo e lido corretamente ...` e `OK: linha de teste removida, client_settings sem resíduo`.

- [ ] **Step 10: Commit**

```bash
git add supabase/migrations/0007_client_settings_brand.sql src/lib/clientSettings.ts src/lib/hexColor.ts
git commit -m "Adiciona bucket client-logos + brand_color/logo_url em client_settings + hexToHslTriplet"
```

---

### Task 2: Rotas `PUT /api/conta/[client]/brand` e `POST /api/conta/[client]/logo`

**Files:**
- Create: `src/app/api/conta/[client]/brand/route.ts`
- Create: `src/app/api/conta/[client]/logo/route.ts`

**Interfaces:**
- Consumes: `updateClientBrand(clientId, { brandColor?, logoUrl? })` de `src/lib/clientSettings.ts` (Task 1), `getSupabaseAdmin()` de `src/lib/supabase.ts`.
- Produces: `PUT /api/conta/[client]/brand?key=TOKEN` (body `{ brandColor }`) → `{ brandColor }` ou 400 se inválido; `POST /api/conta/[client]/logo?key=TOKEN` (multipart, campo `logo`) → `{ logoUrl }` ou 400 se arquivo inválido/grande demais — consumidos pela Task 4.

- [ ] **Step 1: Criar `src/app/api/conta/[client]/brand/route.ts`**

```ts
// src/app/api/conta/[client]/brand/route.ts
import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { updateClientBrand } from "@/lib/clientSettings";
import { verifyClientToken } from "@/lib/access";

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

export async function PUT(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) return Response.json({ error: "unknown client" }, { status: 404 });
  if (!(await verifyClientToken(clientId, key))) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const brandColor = body?.brandColor;
  if (typeof brandColor !== "string" || !HEX_COLOR_PATTERN.test(brandColor)) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    await updateClientBrand(clientId, { brandColor });
    return Response.json({ brandColor });
  } catch (err) {
    console.error(`[conta] falha ao salvar cor de ${clientId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
```

- [ ] **Step 2: Criar `src/app/api/conta/[client]/logo/route.ts`**

```ts
// src/app/api/conta/[client]/logo/route.ts
import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { updateClientBrand } from "@/lib/clientSettings";
import { verifyClientToken } from "@/lib/access";
import { getSupabaseAdmin } from "@/lib/supabase";

const MAX_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/svg+xml"]);
const EXT_BY_TYPE: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/svg+xml": "svg" };

export async function POST(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) return Response.json({ error: "unknown client" }, { status: 404 });
  if (!(await verifyClientToken(clientId, key))) return Response.json({ error: "unauthorized" }, { status: 401 });

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("logo");
  if (!(file instanceof File)) return Response.json({ error: "invalid_body" }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return Response.json({ error: "invalid_type" }, { status: 400 });
  if (file.size > MAX_SIZE_BYTES) return Response.json({ error: "too_large" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ error: "fetch_failed" }, { status: 502 });

  const ext = EXT_BY_TYPE[file.type];
  const path = `${clientId}/logo.${ext}`;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from("client-logos")
      .upload(path, buffer, { contentType: file.type, upsert: true });
    if (uploadError) throw new Error(uploadError.message);

    const { data } = supabase.storage.from("client-logos").getPublicUrl(path);
    await updateClientBrand(clientId, { logoUrl: data.publicUrl });
    return Response.json({ logoUrl: data.publicUrl });
  } catch (err) {
    console.error(`[conta] falha ao subir logo de ${clientId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build limpo, `ƒ /api/conta/[client]/brand` e `ƒ /api/conta/[client]/logo` presentes na lista de rotas.

- [ ] **Step 5: Verificação real ao vivo — 404/401/400/200 (cor) e upload real (logo)**

Com o dev server rodando (porta 3001, `env -u SUPABASE_URL -u SUPABASE_KEY` se necessário):

```bash
# Cor: 404 cliente inexistente
curl -s -o /dev/null -w "%{http_code}\n" -X PUT "http://localhost:3001/api/conta/naoexiste/brand?key=qualquer" -H "Content-Type: application/json" -d '{"brandColor":"#7C3AED"}'
# esperado: 404

# Cor: 401 token errado
curl -s -o /dev/null -w "%{http_code}\n" -X PUT "http://localhost:3001/api/conta/tiago/brand?key=chaveerrada" -H "Content-Type: application/json" -d '{"brandColor":"#7C3AED"}'
# esperado: 401

# Cor: 400 valor inválido
curl -s -o /dev/null -w "%{http_code}\n" -X PUT "http://localhost:3001/api/conta/tiago/brand?key=b9d179192160c98b579807d25f8a956e" -H "Content-Type: application/json" -d '{"brandColor":"roxo"}'
# esperado: 400

# Cor: 200 valor válido
curl -s -X PUT "http://localhost:3001/api/conta/tiago/brand?key=b9d179192160c98b579807d25f8a956e" -H "Content-Type: application/json" -d '{"brandColor":"#7C3AED"}'
# esperado: {"brandColor":"#7C3AED"}

# Logo: upload real de teste (cria um PNG mínimo de 1x1 pixel)
python3 -c "
import base64
png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=')
open('/tmp/test-logo.png', 'wb').write(png)
"
curl -s -X POST "http://localhost:3001/api/conta/tiago/logo?key=b9d179192160c98b579807d25f8a956e" -F "logo=@/tmp/test-logo.png;type=image/png"
# esperado: {"logoUrl":"https://.../storage/v1/object/public/client-logos/tiago/logo.png"}
rm /tmp/test-logo.png
```

Expected: os 4 primeiros códigos batem exatamente, e o upload retorna uma `logoUrl` real acessível.

- [ ] **Step 6: Limpar o dado de teste do Tiago**

```bash
set -a && source .env.local && set +a
curl -s -X DELETE "$SUPABASE_URL/rest/v1/client_settings?client_id=eq.tiago" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
curl -s -X DELETE "$SUPABASE_URL/storage/v1/object/client-logos/tiago/logo.png" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Confirme com um `GET` que `client_settings` não tem linha pro Tiago, e que o objeto do Storage foi removido.

- [ ] **Step 7: Commit**

```bash
git add "src/app/api/conta/[client]/brand/route.ts" "src/app/api/conta/[client]/logo/route.ts"
git commit -m "Adiciona rotas PUT /api/conta/[client]/brand e POST /api/conta/[client]/logo"
```

---

### Task 3: `layout.tsx` — aplica a cor customizada de verdade

**Files:**
- Create: `src/app/[client]/layout.tsx`

**Interfaces:**
- Consumes: `fetchClientSettings(clientId)` de `src/lib/clientSettings.ts` (Task 1), `hexToHslTriplet(hex)` de `src/lib/hexColor.ts` (Task 1).

- [ ] **Step 1: Criar `src/app/[client]/layout.tsx`**

```tsx
// src/app/[client]/layout.tsx
import { fetchClientSettings } from "@/lib/clientSettings";
import { hexToHslTriplet } from "@/lib/hexColor";

export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ client: string }>;
}) {
  const { client } = await params;

  let brandColor: string | null = null;
  try {
    brandColor = (await fetchClientSettings(client)).brandColor;
  } catch (err) {
    console.error(`[conta] falha ao buscar brandColor de ${client}, usando padrão:`, err);
  }

  if (!brandColor) return <>{children}</>;

  return <div style={{ "--brand-primary": hexToHslTriplet(brandColor) } as React.CSSProperties}>{children}</div>;
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build limpo.

- [ ] **Step 4: Verificação real — trocar a cor de um cliente de teste e confirmar o efeito real em 2 páginas diferentes**

```bash
set -a && source .env.local && set +a
curl -s -X PUT "http://localhost:3001/api/conta/tiago/brand?key=b9d179192160c98b579807d25f8a956e" -H "Content-Type: application/json" -d '{"brandColor":"#16A34A"}'
```

Abrir `/tiago?key=b9d179192160c98b579807d25f8a956e` (Dashboard) e `/tiago/calendario?key=b9d179192160c98b579807d25f8a956e` — confirmar que botões/destaques roxos agora aparecem em verde (`#16A34A`) nas duas páginas. Abrir `/debora?key=e5bff4d1825a067cfab62539526e9a3c` (outro cliente, sem cor customizada) e confirmar que continua no roxo padrão.

Reverter e confirmar que a tabela ficou vazia ao final:

```bash
curl -s -X DELETE "$SUPABASE_URL/rest/v1/client_settings?client_id=eq.tiago" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Recarregar `/tiago?key=...` e confirmar que voltou pro roxo padrão.

- [ ] **Step 5: Commit**

```bash
git add "src/app/[client]/layout.tsx"
git commit -m "Adiciona layout de cliente que aplica brand_color como --brand-primary"
```

---

### Task 4: Seção "Marca" na página Conta

**Files:**
- Modify: `src/components/ContaPageClient.tsx` (arquivo inteiro será substituído)

**Interfaces:**
- Consumes: `GET /api/conta/[client]` (já retorna `brandColor`/`logoUrl` desde a Task 1), `PUT /api/conta/[client]/brand`, `POST /api/conta/[client]/logo` (Task 2).

- [ ] **Step 1: Substituir `src/components/ContaPageClient.tsx` inteiro**

```tsx
// src/components/ContaPageClient.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { US_TIMEZONES } from "@/lib/clientTime";

type Status = "loading" | "error" | "ready";
type SaveStatus = "idle" | "saving" | "saved" | "error";

export function ContaPageClient({ clientId, accessKey }: { clientId: string; accessKey: string }) {
  const [status, setStatus] = useState<Status>("loading");
  const [timeZone, setTimeZone] = useState<string>("America/New_York");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const [brandColor, setBrandColor] = useState<string>("#7C3AED");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [brandSaveStatus, setBrandSaveStatus] = useState<SaveStatus>("idle");
  const [uploadStatus, setUploadStatus] = useState<SaveStatus>("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/conta/${clientId}?key=${encodeURIComponent(accessKey)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error();
        return data as { timeZone: string; brandColor: string | null; logoUrl: string | null };
      })
      .then((data) => {
        if (!cancelled) {
          setTimeZone(data.timeZone);
          if (data.brandColor) setBrandColor(data.brandColor);
          setLogoUrl(data.logoUrl);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, accessKey]);

  function handleSaveTimeZone() {
    setSaveStatus("saving");
    fetch(`/api/conta/${clientId}?key=${encodeURIComponent(accessKey)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeZone }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        setSaveStatus("saved");
      })
      .catch(() => setSaveStatus("error"));
  }

  function handleSaveBrandColor() {
    setBrandSaveStatus("saving");
    fetch(`/api/conta/${clientId}/brand?key=${encodeURIComponent(accessKey)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandColor }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        setBrandSaveStatus("saved");
      })
      .catch(() => setBrandSaveStatus("error"));
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadStatus("saving");
    const formData = new FormData();
    formData.append("logo", file);
    fetch(`/api/conta/${clientId}/logo?key=${encodeURIComponent(accessKey)}`, {
      method: "POST",
      body: formData,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error();
        setLogoUrl(data.logoUrl);
        setUploadStatus("saved");
      })
      .catch(() => setUploadStatus("error"));
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-10 sm:px-10">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Conta</h1>

      {status === "loading" && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {status === "error" && (
        <p className="rounded-[var(--radius-card)] bg-card p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-soft)]">
          Não foi possível carregar as configurações agora.
        </p>
      )}
      {status === "ready" && (
        <div className="flex max-w-md flex-col gap-6">
          <div className="rounded-[var(--radius-card)] bg-card p-6 shadow-[var(--shadow-soft)]">
            <h2 className="mb-1 text-sm font-bold text-card-foreground">Fuso horário</h2>
            <p className="mb-4 text-xs text-muted-foreground">Define o horário exibido no Calendário e nas Atas.</p>
            <select
              value={timeZone}
              onChange={(e) => {
                setTimeZone(e.target.value);
                setSaveStatus("idle");
              }}
              className="mb-4 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {US_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleSaveTimeZone}
              disabled={saveStatus === "saving"}
              className="rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-primary/90 disabled:opacity-50"
            >
              {saveStatus === "saving" ? "Salvando..." : "Salvar"}
            </button>
            {saveStatus === "saved" && <p className="mt-2 text-xs text-green-600">Salvo com sucesso.</p>}
            {saveStatus === "error" && <p className="mt-2 text-xs text-red-500">Não foi possível salvar.</p>}
          </div>

          <div className="rounded-[var(--radius-card)] bg-card p-6 shadow-[var(--shadow-soft)]">
            <h2 className="mb-1 text-sm font-bold text-card-foreground">Marca</h2>
            <p className="mb-4 text-xs text-muted-foreground">Cor principal e logo exibidos no dashboard.</p>

            <label className="mb-1 block text-xs font-semibold text-card-foreground">Cor principal</label>
            <div className="mb-4 flex items-center gap-3">
              <input
                type="color"
                value={brandColor}
                onChange={(e) => {
                  setBrandColor(e.target.value);
                  setBrandSaveStatus("idle");
                }}
                className="h-10 w-14 cursor-pointer rounded-md border border-border bg-background"
              />
              <span className="text-sm text-muted-foreground">{brandColor}</span>
            </div>
            <button
              type="button"
              onClick={handleSaveBrandColor}
              disabled={brandSaveStatus === "saving"}
              className="mb-6 rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-primary/90 disabled:opacity-50"
            >
              {brandSaveStatus === "saving" ? "Salvando..." : "Salvar cor"}
            </button>
            {brandSaveStatus === "saved" && <p className="-mt-4 mb-6 text-xs text-green-600">Salvo com sucesso.</p>}
            {brandSaveStatus === "error" && <p className="-mt-4 mb-6 text-xs text-red-500">Não foi possível salvar.</p>}

            <label className="mb-1 block text-xs font-semibold text-card-foreground">Logo</label>
            <div className="mb-3 flex items-center gap-3">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt="Logo do cliente"
                  className="h-14 w-14 rounded-md border border-border bg-background object-contain"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                  Sem logo
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadStatus === "saving"}
                className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-card-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                {uploadStatus === "saving" ? "Enviando..." : "Enviar logo"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                onChange={handleLogoChange}
                className="hidden"
              />
            </div>
            {uploadStatus === "saved" && <p className="text-xs text-green-600">Logo atualizado.</p>}
            {uploadStatus === "error" && <p className="text-xs text-red-500">Não foi possível enviar o logo.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build limpo.

- [ ] **Step 4: Checagem visual completa**

Abrir `/tiago/conta?key=b9d179192160c98b579807d25f8a956e`. Confirmar:
- Seção "Marca" abaixo da seção "Fuso horário", com color picker + campo de texto mostrando o hex, botão "Salvar cor" próprio.
- Trocar a cor, clicar "Salvar cor", ver "Salvo com sucesso." — recarregar a página e confirmar que a cor persistiu (não é só state local).
- Ir em `/tiago?key=...` (Dashboard) e confirmar que a cor nova está aplicada de verdade.
- Voltar em Conta, clicar "Enviar logo", escolher uma imagem PNG/JPEG pequena — confirmar que o preview do logo aparece depois do upload, e que recarregar a página mantém o logo (persistiu).
- Reverter a cor pro roxo padrão da Clique Boost (`#7C3AED` ou o valor original) e salvar, deixando o cliente de teste como estava antes da verificação.
- `read_console_messages` sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/components/ContaPageClient.tsx
git commit -m "Adiciona seção Marca (cor + logo) na página Conta"
```
