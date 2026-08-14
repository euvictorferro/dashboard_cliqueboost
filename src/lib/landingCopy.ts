// src/lib/landingCopy.ts
// Bilingual copy for the public landing page. One dictionary, two locales — no i18n library
// (single page, no routing split needed; see docs/superpowers/specs/2026-08-14-landing-page-design.md).

export type Locale = "en" | "pt";

export type LandingCopy = {
  header: { navCta: string; toggleLabel: string };
  hero: { eyebrow: string; headline: string; subheadline: string; cta: string };
  painPoints: {
    title: string;
    items: { title: string; body: string }[];
    closing: string;
  };
  promise: { headline: string; body: string };
  services: {
    title: string;
    subtitle: string;
    items: { title: string; body: string }[];
    aiNote: string;
  };
  process: { title: string; steps: { title: string; body: string }[] };
  testimonials: { title: string; subtitle: string };
  tech: { title: string; body: string };
  faq: { title: string; items: { q: string; a: string }[] };
  form: {
    title: string;
    subtitle: string;
    nameLabel: string;
    nicheLabel: string;
    nicheOptions: string[];
    marketLabel: string;
    painLabel: string;
    submit: string;
    successMessage: string;
  };
  footer: { tagline: string; contactLabel: string; rights: string };
};

export const landingCopy: Record<Locale, LandingCopy> = {
  en: {
    header: { navCta: "Apply Now", toggleLabel: "PT" },
    hero: {
      eyebrow: "Marketing Agency for Brokers",
      headline: "You close deals. We build the brand that gets you the calls.",
      subheadline:
        "Clique Boost runs the marketing engine behind top real estate and insurance brokers in the U.S. — content, ads, design, and strategy — so leads show up before you even open your laptop.",
      cta: "Apply to Work With Us",
    },
    painPoints: {
      title: "Sound familiar?",
      items: [
        {
          title: "Your Instagram hasn't grown in months",
          body: "Clients Google you before they call you — and what they find looks abandoned.",
        },
        {
          title: "You don't have time to be a marketer too",
          body: "You're closing deals, not editing reels and writing captions at midnight.",
        },
        {
          title: "Referrals alone aren't enough anymore",
          body: "Without consistent visibility, your pipeline depends entirely on who remembers to call you.",
        },
      ],
      closing: "None of that is a talent problem. It's a marketing problem — and it's fixable.",
    },
    promise: {
      headline: "You sell. You film. We handle everything else.",
      body: "Clique Boost is a full-service marketing team built specifically for brokers — real estate, insurance, and financial professionals who need a brand that works while they're closing deals.",
    },
    services: {
      title: "Everything your brand needs, handled",
      subtitle: "One team, one retainer, zero juggling freelancers.",
      items: [
        { title: "Website Design", body: "A site built to convert visitors into leads, not just look nice." },
        { title: "Social Media Strategy", body: "A content calendar and positioning built around your niche and market." },
        { title: "Viral Content Creation", body: "Short-form content designed to actually get seen — and remembered." },
        {
          title: "Paid Traffic (Multi-Platform)",
          body: "Meta, Google, LinkedIn, Pinterest, and X Ads — leads on the platforms where your clients already are.",
        },
        { title: "Video Editing", body: "Professional-grade edits from your raw footage — ready to post." },
        { title: "Post Design", body: "Branded graphics that make every post look like it came from a real agency." },
        { title: "Copywriting", body: "Captions and ad copy written to convert, not just fill space." },
      ],
      aiNote: "Need to automate client intake or internal workflows with AI? We build that too — on request.",
    },
    process: {
      title: "How it works",
      steps: [
        { title: "Apply", body: "Tell us about your market and where you're stuck." },
        { title: "Strategy Call", body: "We map out what your brand actually needs — no generic package." },
        { title: "Onboarding", body: "We set up your content system, ad accounts, and calendar." },
        { title: "Content & Leads Start Flowing", body: "You keep selling. We keep producing and running traffic." },
      ],
    },
    testimonials: {
      title: "Trusted by brokers who'd rather sell than post",
      subtitle: "A few of the professionals we work with.",
    },
    tech: {
      title: "Built with our own technology",
      body: "Every Clique Boost client gets access to a private dashboard — real Instagram metrics, content calendar, tasks, and reporting in one place. It's proof we don't just talk about marketing — we build the systems for it.",
    },
    faq: {
      title: "Questions, answered",
      items: [
        {
          q: "How much does this cost?",
          a: "Marketing 360 is a monthly retainer scoped to your market and goals — we'll walk you through pricing on the strategy call.",
        },
        {
          q: "Is there a contract?",
          a: "We work on a month-to-month basis after the initial onboarding period — no long lock-in.",
        },
        {
          q: "How fast will I see results?",
          a: "Content and brand consistency show up in weeks; paid traffic leads typically start within the first 30 days.",
        },
        {
          q: "Do you only work with real estate and insurance?",
          a: "We specialize in brokers and financial professionals — real estate, life insurance, and related financial services.",
        },
        {
          q: "Do I need to film my own content?",
          a: "Yes — you're the face of your brand. We handle editing, strategy, and everything around it.",
        },
      ],
    },
    form: {
      title: "Ready to stop chasing leads?",
      subtitle: "Apply below — we review every application personally.",
      nameLabel: "Full name",
      nicheLabel: "Your niche",
      nicheOptions: ["Real Estate", "Insurance", "Other financial services"],
      marketLabel: "Where do you work? (city/state)",
      painLabel: "What's your biggest challenge right now?",
      submit: "Submit Application",
      successMessage: "Thanks — we received your application and will reach out shortly.",
    },
    footer: {
      tagline: "Marketing 360 for brokers who'd rather sell than post.",
      contactLabel: "Contact",
      rights: "All rights reserved.",
    },
  },
  pt: {
    header: { navCta: "Aplicar Agora", toggleLabel: "EN" },
    hero: {
      eyebrow: "Agência de Marketing para Corretores",
      headline: "Você fecha negócios. A gente constrói a marca que traz as ligações.",
      subheadline:
        "A Clique Boost roda o motor de marketing por trás dos principais corretores de imóveis e seguros dos EUA — conteúdo, anúncios, design e estratégia — pra leads aparecerem antes de você nem abrir o notebook.",
      cta: "Aplicar Para Trabalhar Com a Gente",
    },
    painPoints: {
      title: "Isso parece familiar?",
      items: [
        {
          title: "Seu Instagram não cresce há meses",
          body: "Clientes te procuram no Google antes de ligar — e o que encontram parece abandonado.",
        },
        {
          title: "Você não tem tempo pra também ser marketeiro",
          body: "Você deveria estar fechando negócios, não editando reels e escrevendo legenda de madrugada.",
        },
        {
          title: "Só indicação não é mais suficiente",
          body: "Sem visibilidade constante, seu pipeline depende inteiramente de quem lembra de te ligar.",
        },
      ],
      closing: "Nada disso é falta de talento. É um problema de marketing — e tem solução.",
    },
    promise: {
      headline: "Você vende. Você grava. A gente cuida do resto.",
      body: "A Clique Boost é um time de marketing completo, feito especificamente pra corretores — de imóveis, seguros e profissionais financeiros que precisam de uma marca que trabalha enquanto eles fecham negócios.",
    },
    services: {
      title: "Tudo que sua marca precisa, resolvido",
      subtitle: "Um time, um contrato, zero freelancer pra gerenciar.",
      items: [
        { title: "Criação de Site", body: "Um site feito pra converter visitante em lead, não só bonito." },
        { title: "Estratégia de Redes Sociais", body: "Calendário de conteúdo e posicionamento construídos em volta do seu nicho e mercado." },
        { title: "Conteúdo Viral", body: "Conteúdo em formato curto feito pra realmente ser visto — e lembrado." },
        {
          title: "Tráfego Pago (Multi-Plataforma)",
          body: "Meta, Google, LinkedIn, Pinterest e X Ads — leads nas plataformas onde seus clientes já estão.",
        },
        { title: "Edição de Vídeo", body: "Edições de nível profissional a partir do seu material bruto — prontas pra postar." },
        { title: "Design de Posts", body: "Peças com identidade que fazem cada post parecer que veio de uma agência de verdade." },
        { title: "Copywriting", body: "Legendas e textos de anúncio escritos pra converter, não só preencher espaço." },
      ],
      aiNote: "Precisa automatizar atendimento ou fluxos internos com IA? A gente também faz — sob consulta.",
    },
    process: {
      title: "Como funciona",
      steps: [
        { title: "Aplique", body: "Conte pra gente sobre seu mercado e onde você está travado." },
        { title: "Chamada de Estratégia", body: "A gente mapeia o que sua marca realmente precisa — sem pacote genérico." },
        { title: "Onboarding", body: "A gente configura seu sistema de conteúdo, contas de anúncio e calendário." },
        { title: "Conteúdo e Leads Começam a Rodar", body: "Você continua vendendo. A gente continua produzindo e rodando tráfego." },
      ],
    },
    testimonials: {
      title: "Confiado por corretores que preferem vender a postar",
      subtitle: "Alguns dos profissionais com quem trabalhamos.",
    },
    tech: {
      title: "Construído com tecnologia própria",
      body: "Todo cliente Clique Boost tem acesso a um dashboard privado — métricas reais do Instagram, calendário de conteúdo, tarefas e relatórios em um só lugar. É prova de que a gente não só fala de marketing — a gente constrói os sistemas pra isso.",
    },
    faq: {
      title: "Perguntas respondidas",
      items: [
        {
          q: "Quanto custa?",
          a: "O Marketing 360 é um contrato mensal dimensionado pro seu mercado e objetivos — a gente explica os valores na chamada de estratégia.",
        },
        {
          q: "Tem contrato de fidelidade?",
          a: "A gente trabalha mês a mês depois do período inicial de onboarding — sem fidelidade longa.",
        },
        {
          q: "Em quanto tempo vejo resultado?",
          a: "Consistência de marca e conteúdo aparece em semanas; leads de tráfego pago geralmente começam nos primeiros 30 dias.",
        },
        {
          q: "Vocês atendem só imóveis e seguros?",
          a: "A gente é especializado em corretores e profissionais financeiros — imóveis, seguro de vida e serviços financeiros relacionados.",
        },
        {
          q: "Preciso gravar meu próprio conteúdo?",
          a: "Sim — você é o rosto da sua marca. A gente cuida da edição, estratégia e de tudo em volta disso.",
        },
      ],
    },
    form: {
      title: "Pronto pra parar de correr atrás de lead?",
      subtitle: "Aplique abaixo — a gente revisa cada aplicação pessoalmente.",
      nameLabel: "Nome completo",
      nicheLabel: "Seu nicho",
      nicheOptions: ["Imóveis", "Seguros", "Outros serviços financeiros"],
      marketLabel: "Onde você atua? (cidade/estado)",
      painLabel: "Qual seu maior desafio hoje?",
      submit: "Enviar Aplicação",
      successMessage: "Obrigado — recebemos sua aplicação e vamos entrar em contato em breve.",
    },
    footer: {
      tagline: "Marketing 360 pra corretores que preferem vender a postar.",
      contactLabel: "Contato",
      rights: "Todos os direitos reservados.",
    },
  },
};
