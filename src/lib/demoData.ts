// src/lib/demoData.ts
// ponytail: dados mockados só pra essa conta de demonstração (gravação de vídeo/apresentação
// pros clientes) — não é um fallback genérico pra qualquer cliente sem lista/board configurado
// (isso mascararia erro de configuração real de um cliente de verdade). Ações de escrita
// (comentar, marcar checklist, adicionar label/membro, editar descrição) só confirmam sucesso
// sem persistir de verdade — a UI reage na hora, mas some no reload. Aceitável pra um demo.
import type { TaskItem, TaskStatus, TaskListMember } from "./clickup";
import type {
  ContentList,
  ContentActivity,
  ContentBoardLabel,
  ContentBoardMember,
} from "./trello";

export const DEMO_CLIENT_ID = "demo";

const now = () => Date.now();
const days = (n: number) => n * 24 * 60 * 60 * 1000;

// ---------- Tasks (ClickUp) ----------

export const DEMO_TASK_STATUSES: TaskStatus[] = [
  { status: "a fazer", color: "#8b8d97", type: "open", orderindex: 0 },
  { status: "em produção", color: "#3384f5", type: "custom", orderindex: 1 },
  { status: "concluído", color: "#6bc950", type: "closed", orderindex: 2 },
];

export const DEMO_TASK_MEMBERS: TaskListMember[] = [
  { id: "demo-m1", name: "Ana Souza", color: "#e91e63", initials: "AS" },
  { id: "demo-m2", name: "Bruno Lima", color: "#3f51b5", initials: "BL" },
  { id: "demo-m3", name: "Clique Boost", color: "#7b61ff", initials: "CB" },
];

function task(
  id: string,
  name: string,
  status: (typeof DEMO_TASK_STATUSES)[number],
  opts: Partial<TaskItem> = {}
): TaskItem {
  return {
    id,
    name,
    status: status.status,
    statusColor: status.color,
    statusType: status.type,
    statusOrder: status.orderindex,
    dueDate: null,
    startDate: null,
    assignees: [DEMO_TASK_MEMBERS[0]],
    description: "",
    priority: null,
    tags: [],
    timeEstimate: null,
    timeSpent: 0,
    dateCreated: now() - days(2),
    creator: { name: "Clique Boost", color: "#7b61ff", initials: "CB" },
    ...opts,
  };
}

const [aFazer, emProducao, concluido] = DEMO_TASK_STATUSES;

export const DEMO_TASKS: TaskItem[] = [
  task("demo-task-1", "Gravar reels da semana (bastidores + depoimento)", emProducao, {
    dueDate: now() + days(2),
    startDate: now() - days(1),
    assignees: [DEMO_TASK_MEMBERS[0]],
    description: "3 reels sobre bastidores + 1 depoimento de cliente.",
    priority: { label: "Alta", color: "#f2394a" },
    tags: ["conteúdo", "reels"],
    timeEstimate: 3 * 60 * 60 * 1000,
    timeSpent: 45 * 60 * 1000,
  }),
  task("demo-task-2", "Revisar copy dos posts de terça", aFazer, {
    dueDate: now() + days(1),
    assignees: [DEMO_TASK_MEMBERS[1]],
    description: "Ajustar tom de voz conforme feedback do cliente.",
    priority: { label: "Normal", color: "#f2c94c" },
    tags: ["copywriting"],
  }),
  task("demo-task-3", "Publicar carrossel sobre resultados do mês", concluido, {
    dueDate: now() - days(1),
    startDate: now() - days(4),
    assignees: [DEMO_TASK_MEMBERS[0]],
    description: "Carrossel com prints do dashboard e números do mês.",
    priority: { label: "Alta", color: "#f2394a" },
    tags: ["conteúdo", "relatório"],
    timeEstimate: 2 * 60 * 60 * 1000,
    timeSpent: 2 * 60 * 60 * 1000,
  }),
  task("demo-task-4", "Planejar pauta do mês que vem", aFazer, {
    dueDate: now() + days(6),
    assignees: [DEMO_TASK_MEMBERS[2]],
    description: "Levantar temas com base no que performou melhor esse mês.",
    priority: { label: "Normal", color: "#f2c94c" },
    tags: ["planejamento"],
  }),
  task("demo-task-5", "Responder comentários e DMs pendentes", aFazer, {
    dueDate: now() + days(1),
    assignees: [DEMO_TASK_MEMBERS[1]],
    tags: ["engajamento"],
  }),
  task("demo-task-6", "Editar vídeo — tour pelo escritório", emProducao, {
    dueDate: now() + days(3),
    startDate: now(),
    assignees: [DEMO_TASK_MEMBERS[0]],
    description: "Cortes + legendas + trilha sonora.",
    priority: { label: "Normal", color: "#f2c94c" },
    tags: ["vídeo"],
    timeEstimate: 4 * 60 * 60 * 1000,
    timeSpent: 90 * 60 * 1000,
  }),
  task("demo-task-7", "Criativo novo pra campanha de tráfego pago", emProducao, {
    dueDate: now() + days(2),
    startDate: now() - days(1),
    assignees: [DEMO_TASK_MEMBERS[2]],
    priority: { label: "Alta", color: "#f2394a" },
    tags: ["ads", "design"],
  }),
  task("demo-task-8", "Agendar posts da próxima semana", concluido, {
    dueDate: now() - days(2),
    startDate: now() - days(3),
    assignees: [DEMO_TASK_MEMBERS[1]],
    tags: ["planejamento"],
    timeEstimate: 60 * 60 * 1000,
    timeSpent: 50 * 60 * 1000,
  }),
  task("demo-task-9", "Relatório mensal pro cliente", concluido, {
    dueDate: now() - days(5),
    startDate: now() - days(6),
    assignees: [DEMO_TASK_MEMBERS[2]],
    description: "PDF exportado direto do dashboard.",
    tags: ["relatório"],
    timeEstimate: 60 * 60 * 1000,
    timeSpent: 45 * 60 * 1000,
  }),
];

// ---------- Conteúdos (Trello) ----------

export const DEMO_BOARD_LABELS: ContentBoardLabel[] = [
  { id: "demo-label-reels", name: "Reels", color: "purple" },
  { id: "demo-label-post", name: "Post", color: "green" },
  { id: "demo-label-video", name: "Vídeo", color: "blue" },
  { id: "demo-label-urgente", name: "Urgente", color: "red" },
];

export const DEMO_BOARD_MEMBERS: ContentBoardMember[] = [
  { id: "demo-m1", name: "Ana Souza", avatarUrl: null, initials: "AS" },
  { id: "demo-m2", name: "Bruno Lima", avatarUrl: null, initials: "BL" },
];

function card(
  id: string,
  name: string,
  listName: string,
  opts: Partial<ContentList["cards"][number]> = {}
): ContentList["cards"][number] {
  return {
    id,
    name,
    listName,
    description: "",
    labels: [],
    dueDate: null,
    assignees: [],
    attachments: [],
    coverImageUrl: null,
    checklist: null,
    ...opts,
  };
}

export const DEMO_CONTENT_LISTS: ContentList[] = [
  {
    id: "demo-list-ideias",
    name: "Ideias",
    cards: [
      card("demo-card-1", "Trend de áudio viral — adaptar pro nicho", "Ideias", {
        description: "Testar o áudio que está bombando essa semana, roteiro rápido de 15s.",
        labels: [DEMO_BOARD_LABELS[0]],
      }),
      card("demo-card-2", "Enquete no story sobre dores do cliente", "Ideias", {
        description: "Levantar as 3 maiores dúvidas pra virar conteúdo educativo.",
        labels: [DEMO_BOARD_LABELS[1]],
      }),
      card("demo-card-3", "Bastidores da equipe — dia a dia", "Ideias", {
        labels: [DEMO_BOARD_LABELS[0]],
      }),
    ],
  },
  {
    id: "demo-list-semana1",
    name: "Semana 1",
    cards: [
      card("demo-card-4", "Post — 3 erros que fazem você perder clientes", "Semana 1", {
        description: "Post educativo, carrossel de 5 slides.",
        labels: [DEMO_BOARD_LABELS[1]],
        dueDate: now() + days(1),
        assignees: [DEMO_BOARD_MEMBERS[1]],
        checklist: {
          total: 3,
          checked: 1,
          items: [
            { id: "demo-ci-1", name: "Escrever legenda", checked: true, checklistId: "demo-checklist-4" },
            { id: "demo-ci-2", name: "Criar arte no Canva", checked: false, checklistId: "demo-checklist-4" },
            { id: "demo-ci-3", name: "Aprovar com cliente", checked: false, checklistId: "demo-checklist-4" },
          ],
        },
      }),
      card("demo-card-5", "Reels — rotina de trabalho em 30s", "Semana 1", {
        labels: [DEMO_BOARD_LABELS[0]],
        dueDate: now() + days(2),
        assignees: [DEMO_BOARD_MEMBERS[0]],
      }),
    ],
  },
  {
    id: "demo-list-semana2",
    name: "Semana 2",
    cards: [
      card("demo-card-6", "Depoimento em vídeo — cliente satisfeito", "Semana 2", {
        description: "Editar depoimento gravado na call de sexta.",
        labels: [DEMO_BOARD_LABELS[2]],
        dueDate: now() + days(9),
        assignees: [DEMO_BOARD_MEMBERS[0]],
        checklist: {
          total: 2,
          checked: 0,
          items: [
            { id: "demo-ci-4", name: "Cortar melhores trechos", checked: false, checklistId: "demo-checklist-6" },
            { id: "demo-ci-5", name: "Adicionar legenda", checked: false, checklistId: "demo-checklist-6" },
          ],
        },
      }),
      card("demo-card-7", "Post — comparativo antes/depois", "Semana 2", {
        labels: [DEMO_BOARD_LABELS[1]],
        dueDate: now() + days(10),
      }),
      card("demo-card-8", "Story — enquete de satisfação", "Semana 2", {
        labels: [DEMO_BOARD_LABELS[1]],
      }),
    ],
  },
  {
    id: "demo-list-semana3",
    name: "Semana 3",
    cards: [
      card("demo-card-9", "Reels — tutorial rápido", "Semana 3", {
        labels: [DEMO_BOARD_LABELS[0], DEMO_BOARD_LABELS[3]],
        dueDate: now() + days(16),
        assignees: [DEMO_BOARD_MEMBERS[0]],
      }),
      card("demo-card-10", "Post — bastidores de um projeto entregue", "Semana 3", {
        labels: [DEMO_BOARD_LABELS[1]],
        dueDate: now() + days(17),
      }),
    ],
  },
  {
    id: "demo-list-semana4",
    name: "Semana 4",
    cards: [
      card("demo-card-11", "Vídeo — recap do mês", "Semana 4", {
        description: "Compilado dos melhores momentos do mês pras redes.",
        labels: [DEMO_BOARD_LABELS[2]],
        dueDate: now() + days(23),
        assignees: [DEMO_BOARD_MEMBERS[1]],
      }),
      card("demo-card-12", "Post — convite pra promoção do próximo mês", "Semana 4", {
        labels: [DEMO_BOARD_LABELS[1], DEMO_BOARD_LABELS[3]],
        dueDate: now() + days(24),
      }),
    ],
  },
  {
    id: "demo-list-postados",
    name: "Postados",
    cards: [
      card("demo-card-13", "Post — resultados do mês passado", "Postados", {
        labels: [DEMO_BOARD_LABELS[1]],
        dueDate: now() - days(3),
        assignees: [DEMO_BOARD_MEMBERS[0]],
        checklist: {
          total: 3,
          checked: 3,
          items: [
            { id: "demo-ci-6", name: "Escrever legenda", checked: true, checklistId: "demo-checklist-13" },
            { id: "demo-ci-7", name: "Criar arte", checked: true, checklistId: "demo-checklist-13" },
            { id: "demo-ci-8", name: "Publicar", checked: true, checklistId: "demo-checklist-13" },
          ],
        },
      }),
      card("demo-card-14", "Reels — trend da semana passada", "Postados", {
        labels: [DEMO_BOARD_LABELS[0]],
        dueDate: now() - days(5),
      }),
      card("demo-card-15", "Depoimento em vídeo publicado", "Postados", {
        labels: [DEMO_BOARD_LABELS[2]],
        dueDate: now() - days(8),
      }),
    ],
  },
];

// ---------- Atividade/comentários dos cards ----------

export const DEMO_CARD_ACTIVITY: ContentActivity[] = [
  {
    id: "demo-activity-1",
    date: now() - days(2),
    authorName: "Ana Souza",
    authorAvatarUrl: null,
    authorInitials: "AS",
    kind: "activity",
    text: "criou este card",
    textAfter: null,
    attachmentRef: null,
    isCreation: true,
  },
  {
    id: "demo-activity-2",
    date: now() - days(1),
    authorName: "Clique Boost",
    authorAvatarUrl: null,
    authorInitials: "CB",
    kind: "comment",
    text: "Já deixei o roteiro pronto, só falta gravar amanhã de manhã.",
    textAfter: null,
    attachmentRef: null,
    isCreation: false,
  },
];
