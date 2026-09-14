# Fase 1 — Shell mobile (tab bar + header)

Status: aprovado, pronto pra virar plano de implementação.

## Contexto

O app iOS (Capacitor) carrega `dash.cliqueboost.io` direto num WKWebView. O
layout hoje é só desktop: `Sidebar.tsx` é uma coluna fixa de 224px (`w-56`),
`Header.tsx` é uma barra fininha com botão de colapsar sidebar. Não existe
nenhum breakpoint mobile no app inteiro (`grep sm:/md:/lg:` só aparece 1x,
num widget). No simulador, a sidebar de desktop aparece inteira e cortada.

Esta fase troca só o **shell** (menu de navegação + moldura da página) por
uma versão mobile abaixo de 768px, no padrão tab bar estilo Instagram. As
páginas internas (Dashboard, Conteúdos, Tasks, etc.) continuam como estão —
cada uma vira uma fase própria depois desta.

## Objetivo

- Abaixo de `md` (768px): sem sidebar, barra de navegação fixa embaixo com
  5 abas (Dashboard, Conteúdos, Tarefas, Calendário, Conta), header simples
  fixo em cima só com o nome da página.
- Acima de `md`: **zero mudança visual ou de comportamento** — mesma
  sidebar, mesmo header, mesmo código, só ganham `hidden md:flex`.
- Nenhum elemento do shell (tab bar, header, conteúdo da página) fica
  cortado ou embaixo da home indicator do iPhone.

## Não-objetivos (ficam pra fases seguintes)

- Responsividade do conteúdo interno de cada página (Dashboard, Conteúdos,
  Tasks, Calendário, Conta, Booster AI, Atas, Bunker).
- Busca (⌘K) em versão mobile — não faz sentido em touch, fica ausente do
  mobile por enquanto.

## Design

### Breakpoint

Um só: `md` (768px, padrão do Tailwind). Sem detecção de user-agent/device,
sem JS pra decidir shell — é só CSS (`hidden md:flex` / `flex md:hidden`),
os dois shells coexistem no DOM. Mais barato que JS e sem flash de layout
errado no load.

### Componentes novos

**`src/components/layout/BottomTabBar.tsx`**
Barra fixa (`fixed inset-x-0 bottom-0`), 5 itens com ícone + label pequeno,
reaproveitando os ícones SVG que já existem em `Sidebar.tsx`
(`DashboardIcon`, `ContentIcon`, `TasksIcon`, `CalendarIcon` — falta um pra
Conta, ver abaixo). Altura da barra + `padding-bottom: env(safe-area-inset-bottom)`
pra não ficar atrás da home indicator.

Itens (nessa ordem): Dashboard (`/${clientId}`), Conteúdos
(`/${clientId}/conteudos`), Tarefas (`/${clientId}/tasks`), Calendário
(`/${clientId}/calendario`), Conta (`/${clientId}/conta`).

Estado ativo: mesma prop `active: ActiveKey` que `Sidebar` já recebe —
reaproveita o tipo, não inventa um novo.

**`src/components/layout/MobileHeader.tsx`**
Barra fixa no topo (`fixed inset-x-0 top-0`), só `pageLabel` centralizado
ou à esquerda (sem breadcrumb de cliente, sem botão de colapsar — não
existe o que colapsar no mobile). `padding-top: env(safe-area-inset-top)`
pra não ficar atrás do notch/Dynamic Island.

### `AppFrame.tsx`

Passa a renderizar os dois pares lado a lado, controlados só por classes:

```tsx
<div className="hidden md:flex ...">
  <Sidebar ... />
  <div className="flex min-w-0 flex-1 flex-col">
    <Header ... />
    <div className="min-w-0">{children}</div>
  </div>
</div>

<div className="flex flex-col md:hidden">
  <MobileHeader pageLabel={pageLabel} />
  <main className="flex-1 pb-[calc(56px+env(safe-area-inset-bottom))]">
    {children}
  </main>
  <BottomTabBar clientId={clientId} active={active} />
</div>
```

`children` é renderizado uma única vez por shell ativo (não duplicado no
DOM ao mesmo tempo — um dos dois blocos é `display:none` via `hidden`, o
outro visível; o React ainda monta os dois, então cuidado com efeitos que
disparam 2x — ver "Riscos" abaixo). O `padding-bottom` do `<main>` mobile é
o que garante que nenhuma página cubra a tab bar (requisito "nada pode
ficar cortado" no nível do shell).

Todo o resto de `AppFrame` (CmdK, BoosterAiWidget, OnboardingTour,
UpdateCredentialsModal, RatingPopup) continua renderizado uma vez só, fora
dos dois blocos — são overlays, não fazem parte do shell visual.

### Conta / "Mais"

Hoje "Conta" não é uma aba de navegação — é o `AccountCard` fixo embaixo da
sidebar. No mobile ela vira uma aba de verdade, apontando pra rota que já
existe (`/[client]/conta`). Essa página, nesta fase, só precisa carregar
sem cortar nada — o conteúdo dela em si (formulários, etc.) é responsividade
de página, fase própria.

Atas e Bunker (que hoje ficam dentro do submenu "Social Media" da sidebar)
não entram na tab bar. Nesta fase eles ficam **inacessíveis no mobile** —
não é regressão silenciosa: vou adicionar 2 links simples dentro da página
Conta ("Atas", "Bunker" — Bunker escondido em produção, igual já acontece
hoje) como lista de texto, sem exigir trabalho de layout novo.

### Ícone que falta

`Sidebar.tsx` não tem ícone de "Conta"/perfil — preciso desenhar um (SVG
simples, mesmo estilo `stroke="currentColor" strokeWidth="1.5"` dos outros,
18x18) em `BottomTabBar.tsx`.

## Erros e casos de borda

- **Rotas sem `pageLabel`/`active` compatível com a tab bar** (ex.: página
  de um card de conteúdo aberto em detalhe): a tab bar mostra o item pai
  como ativo (mesma lógica que a sidebar já usa hoje via `ActiveKey`), sem
  necessidade de mudança.
- **Teclado do iOS abrindo em inputs perto da tab bar**: fora do escopo
  desta fase (é responsividade de página) — só observo se atrapalha ao
  testar.

## Riscos

- Montar os dois shells ao mesmo tempo no DOM (só um visível via CSS)
  significa que qualquer `useEffect` dentro de `Sidebar`/`Header` roda mesmo
  quando escondidos. Hoje nenhum dos dois tem efeito próprio (o estado que
  importa — `mustResetCredentials`, `hasSeenOnboarding`, etc. — vive em
  `AppFrame`, não neles), então não deve duplicar chamadas de API. Confirmo
  isso ao ler o código antes de implementar; se algum efeito vazar pra
  dentro de `Sidebar`/`Header`/`BottomTabBar`, a correção é mover esse
  efeito pra `AppFrame` (fonte única), não adicionar guard de device.

## Teste

- Visual no simulador iPhone 17: tab bar visível e completa, sem
  sobreposição com home indicator; header sem sobrepor notch; conteúdo
  scrollável sem nada atrás da tab bar.
- `npm run build` — garante que o desktop (`md:` pra cima) não regrediu
  visualmente nem quebrou tipagem.
- Sem teste automatizado novo: é CSS/layout puro, sem lógica de negócio
  (nenhuma branch condicional em runtime além do que o Tailwind resolve).
