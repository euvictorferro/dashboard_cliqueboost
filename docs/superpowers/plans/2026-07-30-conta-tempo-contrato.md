# Conta — Tempo de Contrato Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um card só-leitura "Tempo de contrato" na página Conta, calculado a partir de uma nova coluna `contract_start_date` na tabela `client_settings`.

**Architecture:** Reaproveita `client_settings` (mesma tabela de Fuso horário/Brand). Uma função pura de formatação (`contractDuration.ts`), a rota GET existente devolve o campo calculado, e o componente cliente renderiza um card extra sem inputs.

**Tech Stack:** Next.js App Router, Supabase (Postgres), TypeScript.

## Global Constraints

- `client_settings.client_id` é a chave primária — para qualquer teste que precise renderizar página real, usar o cliente sandbox Tiago com disciplina "confirmar vazio antes → testar → apagar → confirmar vazio depois" (nunca um `client_id` de cliente real sem essa checagem).
- Nenhuma UI de edição da data — o card é 100% leitura.
- Duração: "X meses" se < 12 meses; "X anos e Y meses" se ≥ 12 meses (Y = 0 ainda mostra "e 0 meses"? Não — se Y === 0, mostrar só "X anos"). `null` → "Ainda não configurado".
- Migration é aditiva (`add column if not exists`), não popula nenhum cliente.

---

### Task 1: Migration + contractDuration.ts + clientSettings.ts + rota GET

**Files:**
- Create: `supabase/migrations/0008_client_settings_contract.sql`
- Create: `src/lib/contractDuration.ts`
- Test: `src/lib/contractDuration.test.ts`
- Modify: `src/lib/clientSettings.ts`
- Modify: `src/app/api/conta/[client]/route.ts`

**Interfaces:**
- Consumes: `ClientSettings` type e `fetchClientSettings` existentes em `src/lib/clientSettings.ts` (ver estado atual abaixo).
- Produces: `formatContractDuration(startDate: string | null, now: Date): string` (exportada de `src/lib/contractDuration.ts`); `ClientSettings.contractStart: string | null`; resposta GET de `/api/conta/[client]` ganha `contractStart: string | null` e `contractDuration: string`.

Estado atual de `src/lib/clientSettings.ts` (não mexer na estrutura, só estender):

```ts
// src/lib/clientSettings.ts
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
// ... updateClientSettings e updateClientBrand ficam como estão, não mexer
```

Estado atual de `src/app/api/conta/[client]/route.ts` (GET handler — a estrutura exata pode variar um pouco, leia o arquivo antes de editar; o handler resolve `client`, valida `CLIENTS.find` → 404, `verifyClientToken` → 401, chama `fetchClientSettings` e devolve JSON):

```ts
// GET handler devolve hoje algo como:
return NextResponse.json({ timeZone: settings.timeZone, brandColor: settings.brandColor, logoUrl: settings.logoUrl });
```

- [ ] **Step 1: Criar a migration**

```sql
-- supabase/migrations/0008_client_settings_contract.sql
alter table client_settings add column if not exists contract_start_date date;
```

- [ ] **Step 2: Escrever o teste de `contractDuration.ts` (falhando)**

```ts
// src/lib/contractDuration.test.ts
import { describe, it, expect } from "vitest";
import { formatContractDuration } from "./contractDuration";

describe("formatContractDuration", () => {
  const now = new Date("2026-07-30T12:00:00Z");

  it("retorna 'Ainda não configurado' quando startDate é null", () => {
    expect(formatContractDuration(null, now)).toBe("Ainda não configurado");
  });

  it("retorna em meses quando < 12 meses", () => {
    // 2026-06-30 -> 2026-07-30 = 1 mês
    expect(formatContractDuration("2026-06-30", now)).toBe("1 mês");
    // 2025-09-30 -> 2026-07-30 = 10 meses
    expect(formatContractDuration("2025-09-30", now)).toBe("10 meses");
  });

  it("retorna em anos e meses quando >= 12 meses", () => {
    // 2025-07-30 -> 2026-07-30 = exatamente 12 meses = 1 ano
    expect(formatContractDuration("2025-07-30", now)).toBe("1 ano");
    // 2025-01-30 -> 2026-07-30 = 18 meses = 1 ano e 6 meses
    expect(formatContractDuration("2025-01-30", now)).toBe("1 ano e 6 meses");
    // 2024-07-30 -> 2026-07-30 = 24 meses = 2 anos
    expect(formatContractDuration("2024-07-30", now)).toBe("2 anos");
  });

  it("trata 1 mês exato no singular e o resto no plural", () => {
    expect(formatContractDuration("2026-06-30", now)).toBe("1 mês");
    expect(formatContractDuration("2026-05-30", now)).toBe("2 meses");
  });
});
```

Se o projeto não usa `vitest` (confira `package.json`), use o test runner já configurado no projeto (procure outro arquivo `*.test.ts` existente pra copiar o padrão de import/runner). Não introduza um runner novo.

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `npm test -- contractDuration` (ou o comando de teste equivalente do projeto)
Expected: FAIL — `formatContractDuration` não existe ainda.

- [ ] **Step 4: Implementar `contractDuration.ts`**

```ts
// src/lib/contractDuration.ts
export function formatContractDuration(startDate: string | null, now: Date): string {
  if (!startDate) return "Ainda não configurado";

  const start = new Date(startDate + "T00:00:00Z");
  let months =
    (now.getUTCFullYear() - start.getUTCFullYear()) * 12 + (now.getUTCMonth() - start.getUTCMonth());
  if (now.getUTCDate() < start.getUTCDate()) months -= 1;
  if (months < 0) months = 0;

  if (months < 12) {
    return months === 1 ? "1 mês" : `${months} meses`;
  }

  const years = Math.floor(months / 12);
  const remainderMonths = months % 12;
  const yearsLabel = years === 1 ? "1 ano" : `${years} anos`;
  if (remainderMonths === 0) return yearsLabel;
  const monthsLabel = remainderMonths === 1 ? "1 mês" : `${remainderMonths} meses`;
  return `${yearsLabel} e ${monthsLabel}`;
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npm test -- contractDuration`
Expected: PASS — todos os casos.

- [ ] **Step 6: Estender `ClientSettings` e `fetchClientSettings`**

```ts
// src/lib/clientSettings.ts — mudanças
export type ClientSettings = {
  timeZone: string;
  brandColor: string | null;
  logoUrl: string | null;
  contractStart: string | null;
};

export async function fetchClientSettings(clientId: string): Promise<ClientSettings> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { data, error } = await supabase
    .from("client_settings")
    .select("time_zone, brand_color, logo_url, contract_start_date")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    timeZone: data?.time_zone ?? DEFAULT_TIME_ZONE,
    brandColor: data?.brand_color ?? null,
    logoUrl: data?.logo_url ?? null,
    contractStart: data?.contract_start_date ?? null,
  };
}
```

- [ ] **Step 7: Estender a rota GET `/api/conta/[client]`**

Leia o arquivo primeiro. Depois do `fetchClientSettings`, adicione ao JSON de resposta:

```ts
import { formatContractDuration } from "@/lib/contractDuration";
// ...
return NextResponse.json({
  timeZone: settings.timeZone,
  brandColor: settings.brandColor,
  logoUrl: settings.logoUrl,
  contractStart: settings.contractStart,
  contractDuration: formatContractDuration(settings.contractStart, new Date()),
});
```

- [ ] **Step 8: Rodar `tsc --noEmit` (ou `npm run build`) pra confirmar que não quebrou tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/0008_client_settings_contract.sql src/lib/contractDuration.ts src/lib/contractDuration.test.ts src/lib/clientSettings.ts src/app/api/conta/[client]/route.ts
git commit -m "feat: contractDuration + coluna contract_start_date + rota GET"
```

**Após este commit: PARE e peça para o Victor rodar a migration `0008_client_settings_contract.sql` no SQL Editor do Supabase antes de prosseguir pra Task 2** (mesmo handoff manual das migrations anteriores desta feature).

---

### Task 2: Card "Tempo de contrato" em ContaPageClient.tsx

**Files:**
- Modify: `src/components/ContaPageClient.tsx`

**Interfaces:**
- Consumes: resposta GET de `/api/conta/[client]` agora inclui `contractDuration: string` (produzido na Task 1).

- [ ] **Step 1: Adicionar estado e leitura do campo**

Em `ContaPageClient.tsx`, no `useEffect` que já busca `/api/conta/${clientId}`, adicione um estado novo e capture o campo:

```ts
const [contractDuration, setContractDuration] = useState<string>("Ainda não configurado");
```

No `.then((data) => { ... })` que já seta `timeZone`/`brandColor`/`logoUrl`, adicione:

```ts
setContractDuration(data.contractDuration);
```

E no cast de tipo do `.then(async (res) => { ... return data as {...} })`, adicione `contractDuration: string` à interface inline.

- [ ] **Step 2: Renderizar o card, só leitura, sem inputs**

Dentro do bloco `{status === "ready" && (...)}`, depois do card "Marca" (mesmo `div` de `flex flex-col gap-6`), adicione:

```tsx
<div className="rounded-[var(--radius-card)] bg-card p-6 shadow-[var(--shadow-soft)]">
  <h2 className="mb-1 text-sm font-bold text-card-foreground">Tempo de contrato</h2>
  <p className="text-sm text-foreground">{contractDuration}</p>
</div>
```

- [ ] **Step 3: Rodar `npx tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 4: Verificação visual ao vivo (cliente sandbox Tiago)**

1. Confirmar `client_settings` vazia pra `client_id=eq.tiago` (GET antes).
2. `PATCH`/`UPDATE` `client_settings` pra `client_id=tiago` setando `contract_start_date` de teste (ex: `2025-01-30`, deve mostrar "1 ano e 6 meses" em 2026-07-30).
3. Abrir a página Conta do Tiago no navegador (preview), confirmar que o card mostra a duração certa.
4. Reverter: `contract_start_date` de volta pra `null` (não deletar a linha inteira se ela já tinha `time_zone`/`brand_color` reais — só limpar essa coluna específica com `UPDATE ... SET contract_start_date = null WHERE client_id = 'tiago'`).
5. Confirmar via GET que voltou a mostrar "Ainda não configurado".

- [ ] **Step 5: Commit**

```bash
git add src/components/ContaPageClient.tsx
git commit -m "feat: card Tempo de contrato na página Conta"
```

## Verificação

- `npx tsc --noEmit` limpo.
- Testes de `contractDuration.ts` passando (todos os casos da Task 1).
- Página Conta do Tiago mostra a duração certa quando `contract_start_date` está setado, e "Ainda não configurado" quando `null`.
- `client_settings` sem resíduo de teste ao final (coluna `contract_start_date` de volta a `null` pro Tiago).
