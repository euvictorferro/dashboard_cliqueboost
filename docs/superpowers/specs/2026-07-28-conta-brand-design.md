# Página Conta — Brand (cor + logo) — Design

## Contexto

Continuação da página "Conta" (roadmap Fase A, item 5). O primeiro pedaço (fuso horário) já está pronto e revisado. Este é o segundo pedaço: Brand — cor principal e logo do cliente. Ordem confirmada com o Victor: Brand → Tempo de contrato → Briefing → Indicação de amigos, cada um com seu próprio ciclo de design.

## Decisões confirmadas com o Victor

- Editável: cor principal (color picker) + logo (upload de imagem). Nome só é exibido (já existe em `CLIENTS`, não editável). Fontes ficam de fora.
- A cor escolhida muda a aparência de verdade do dashboard daquele cliente (não é só um preview cosmético) — sobrescreve `--brand-primary` em todas as páginas dele.
- O logo fica só dentro da página Conta (preview) — a Sidebar continua sempre com a marca Clique Boost, não é substituída.

## Arquitetura

**Migration** — adiciona 2 colunas nullable em `client_settings` (tabela já existente): `brand_color text` (hex, ex: `"#7C3AED"`), `logo_url text` (URL pública do Supabase Storage). `null` em qualquer uma das duas significa "usar o padrão da Clique Boost" (cor roxa atual / sem logo).

**Supabase Storage** — bucket novo `client-logos` (público, leitura sem autenticação — é só o logo, não é dado sensível). Criado via chamada à Storage API com a Service Role Key (não precisa de acesso especial de Management API, é uma operação de dados normal). Cada logo fica em `client-logos/{clientId}/logo.<ext>` — um upload novo sobrescreve o anterior (mesmo caminho).

**`src/lib/clientSettings.ts` (modificar)** — `fetchClientSettings` passa a retornar também `brandColor: string | null` e `logoUrl: string | null`. Nova função `updateClientBrand(clientId, { brandColor, logoUrl })` (upsert parcial, só mexe nessas 2 colunas).

**`src/lib/hexColor.ts` (novo)** — `hexToHslTriplet(hex: string): string`, converte `"#7C3AED"` pro formato de 3 componentes que as CSS variables do projeto já usam (`"263 84% 52%"`). Matemática pura, sem biblioteca.

**`src/app/[client]/layout.tsx` (novo)** — layout compartilhado por todas as páginas de um cliente (`/[client]/*`: dashboard, tasks, atas, conteúdos, calendário, bunker, conta). Busca `brandColor` do cliente e, se existir, envolve `{children}` numa `<div style={{ "--brand-primary": hexToHslTriplet(brandColor) }}>` — sobrescrevendo a variável só pra essa árvore. Sem cor customizada, não faz nada (usa o padrão global do `globals.css`). Não faz nenhuma validação de auth/cliente — isso continua responsabilidade de cada `page.tsx`, como já é hoje.

**Rotas de API:**
- `GET /api/conta/[client]` (já existe) — passa a retornar também `{ brandColor, logoUrl }` junto com `{ timeZone }`.
- `PUT /api/conta/[client]/brand` (novo) — recebe `{ brandColor }`, valida formato hex (`/^#[0-9a-f]{6}$/i`), chama `updateClientBrand`.
- `POST /api/conta/[client]/logo` (novo) — recebe upload via `FormData` (arquivo de imagem, máx. 2MB, `image/png`/`image/jpeg`/`image/svg+xml`), sobe pro bucket `client-logos`, salva a URL pública via `updateClientBrand`.

**`src/components/ContaPageClient.tsx` (modificar)** — nova seção "Marca", abaixo da seção de fuso horário já existente, com preview do logo atual (ou um placeholder), botão de upload, color picker nativo (`<input type="color">`) com preview ao lado, e botão "Salvar" próprio (independente do salvar de fuso horário — cada seção salva por si).

## Fora de escopo

- Seleção de fonte.
- Substituir o logo da Sidebar (Clique Boost continua lá).
- Ajuste automático de contraste/variações de cor pro modo escuro (a cor customizada vale igual em claro e escuro nesta versão — sem o ajuste de luminosidade que a paleta padrão tem entre os dois modos).
- Qualquer validação de "cor legível" (contraste mínimo) — o cliente pode escolher uma cor que fique ruim visualmente, sem aviso.

## Testes / verificação

- Sem suíte de testes automatizada (padrão já estabelecido) — verificação via `npx tsc --noEmit`, `npm run build`, dados reais/teste via curl, upload real de teste, e checagem visual: trocar a cor de um cliente de teste e confirmar que botões/destaques em pelo menos 2 páginas diferentes (Dashboard e Calendário, por exemplo) realmente mudam de cor, enquanto outro cliente sem customização continua no roxo padrão.
