// src/lib/demoData.ts
// ponytail: dados mockados só pra essa conta de demonstração (gravação de vídeo/apresentação
// pros clientes) — não é um fallback genérico pra qualquer cliente sem lista/board configurado
// (isso mascararia erro de configuração real de um cliente de verdade).
import type { TaskItem, TaskStatus, TaskListMember } from "./clickup";
import type { ContentList } from "./trello";

export const DEMO_CLIENT_ID = "demo";

const now = () => Date.now();
const days = (n: number) => n * 24 * 60 * 60 * 1000;

export const DEMO_TASK_STATUSES: TaskStatus[] = [
  { status: "a fazer", color: "#8b8d97", type: "open", orderindex: 0 },
  { status: "em andamento", color: "#3384f5", type: "custom", orderindex: 1 },
  { status: "concluído", color: "#6bc950", type: "closed", orderindex: 2 },
];

export const DEMO_TASK_MEMBERS: TaskListMember[] = [
  { id: "demo-1", name: "Ana Souza", color: "#e91e63", initials: "AS" },
  { id: "demo-2", name: "Bruno Lima", color: "#3f51b5", initials: "BL" },
];

export const DEMO_TASKS: TaskItem[] = [
  {
    id: "demo-task-1",
    name: "Gravar reels da semana",
    status: "em andamento",
    statusColor: "#3384f5",
    statusType: "custom",
    statusOrder: 1,
    dueDate: now() + days(2),
    startDate: now() - days(1),
    assignees: [{ id: "demo-1", name: "Ana Souza", color: "#e91e63", initials: "AS" }],
    description: "3 reels sobre bastidores + 1 depoimento de cliente.",
    priority: { label: "Alta", color: "#f2394a" },
    tags: ["conteúdo", "reels"],
    timeEstimate: 3 * 60 * 60 * 1000,
    timeSpent: 45 * 60 * 1000,
    dateCreated: now() - days(3),
    creator: { name: "Clique Boost", color: "#7b61ff", initials: "CB" },
  },
  {
    id: "demo-task-2",
    name: "Revisar copy dos posts de terça",
    status: "a fazer",
    statusColor: "#8b8d97",
    statusType: "open",
    statusOrder: 0,
    dueDate: now() + days(1),
    startDate: null,
    assignees: [{ id: "demo-2", name: "Bruno Lima", color: "#3f51b5", initials: "BL" }],
    description: "Ajustar tom de voz conforme feedback do cliente.",
    priority: { label: "Normal", color: "#f2c94c" },
    tags: ["copywriting"],
    timeEstimate: null,
    timeSpent: 0,
    dateCreated: now() - days(1),
    creator: { name: "Clique Boost", color: "#7b61ff", initials: "CB" },
  },
  {
    id: "demo-task-3",
    name: "Publicar carrossel sobre resultados do mês",
    status: "concluído",
    statusColor: "#6bc950",
    statusType: "closed",
    statusOrder: 2,
    dueDate: now() - days(1),
    startDate: now() - days(4),
    assignees: [{ id: "demo-1", name: "Ana Souza", color: "#e91e63", initials: "AS" }],
    description: "Carrossel com prints do dashboard e números do mês.",
    priority: { label: "Alta", color: "#f2394a" },
    tags: ["conteúdo", "relatório"],
    timeEstimate: 2 * 60 * 60 * 1000,
    timeSpent: 2 * 60 * 60 * 1000,
    dateCreated: now() - days(6),
    creator: { name: "Clique Boost", color: "#7b61ff", initials: "CB" },
  },
];

export const DEMO_CONTENT_LISTS: ContentList[] = [
  {
    id: "demo-list-ideias",
    name: "Ideias",
    cards: [
      {
        id: "demo-card-1",
        name: "Trend de áudio viral — adaptar pro nicho",
        listName: "Ideias",
        description: "Testar o áudio que está bombando essa semana.",
        labels: [{ id: "l1", name: "Reels", color: "purple" }],
        dueDate: null,
        assignees: [],
        attachments: [],
        coverImageUrl: null,
        checklist: null,
      },
    ],
  },
  {
    id: "demo-list-producao",
    name: "Em produção",
    cards: [
      {
        id: "demo-card-2",
        name: "Depoimento em vídeo — cliente satisfeito",
        listName: "Em produção",
        description: "Editar depoimento gravado na call de sexta.",
        labels: [{ id: "l2", name: "Vídeo", color: "blue" }],
        dueDate: now() + days(2),
        assignees: [{ id: "demo-1", name: "Ana Souza", avatarUrl: null, initials: "AS" }],
        attachments: [],
        coverImageUrl: null,
        checklist: { total: 3, checked: 1, items: [] },
      },
    ],
  },
  {
    id: "demo-list-agendado",
    name: "Agendado",
    cards: [
      {
        id: "demo-card-3",
        name: "Post — 3 erros que fazem você perder clientes",
        listName: "Agendado",
        description: "Post educativo, agendado pra quinta-feira.",
        labels: [{ id: "l3", name: "Post", color: "green" }],
        dueDate: now() + days(4),
        assignees: [],
        attachments: [],
        coverImageUrl: null,
        checklist: null,
      },
    ],
  },
];
