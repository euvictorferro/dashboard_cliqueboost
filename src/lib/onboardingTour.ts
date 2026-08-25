import type { ActiveKey } from "@/components/layout/Sidebar";

export type TourStep = {
  page: ActiveKey;
  target: string; // valor do atributo data-tour no elemento a destacar
  title: string;
  text: string;
};

// Cada passo aponta pra um elemento real (via data-tour="...") numa página real. O botão
// "Próximo" navega de verdade quando o próximo passo é de outra página.
export const TOUR_STEPS: TourStep[] = [
  { page: "dashboard", target: "dashboard-metrics", title: "Suas métricas", text: "Aqui você acompanha seus números dia a dia — seguidores, alcance, curtidas e mais." },
  { page: "dashboard", target: "dashboard-tabs", title: "Orgânico e Ads", text: "Alterne entre o desempenho orgânico do seu perfil e o dos anúncios pagos." },
  { page: "dashboard", target: "nav-tasks", title: "Tasks", text: "Ali no menu você acompanha as tarefas em andamento pra sua conta." },
  { page: "tasks", target: "tasks-board", title: "Board de tarefas", text: "Suas tarefas em andamento, estilo Kanban." },
  { page: "tasks", target: "nav-atas", title: "Atas", text: "Ali ficam os resumos de todas as nossas reuniões." },
  { page: "atas", target: "atas-list", title: "Atas de reunião", text: "Aqui você acessa o resumo e a gravação de cada reunião com a gente." },
  { page: "atas", target: "nav-booster-ai", title: "Booster AI", text: "E aqui um assistente que já conhece a sua conta." },
  { page: "booster-ai", target: "booster-ai-composer", title: "Pergunte qualquer coisa", text: "Pergunte sobre métricas, tarefas ou atas — a qualquer hora, em qualquer página, pelo balãozinho no canto da tela." },
];

export const TOUR_PAGE_PATH: Record<ActiveKey, string> = {
  dashboard: "",
  tasks: "/tasks",
  atas: "/atas",
  "booster-ai": "/booster-ai",
  conta: "/conta",
  conteudos: "/conteudos",
  calendario: "/calendario",
  bunker: "/bunker",
};

export const TOUR_ACTIVE_KEY = "cliqueboost-tour-active";
export const TOUR_STEP_KEY = "cliqueboost-tour-step";
export const TOUR_START_EVENT = "cliqueboost:start-tour";
