import { countryName } from "./countries";

export const AUDIENCE_TIMEFRAMES = [
  { id: "this_week", label: "Esta semana" },
  { id: "this_month", label: "Este mês" },
  { id: "last_30_days", label: "Últimos 30 dias" },
  { id: "last_90_days", label: "Últimos 90 dias" },
] as const;

export type AudienceTimeframeId = (typeof AUDIENCE_TIMEFRAMES)[number]["id"];

export type DemographicSlice = { key: string; label: string; pct: number };

export type DemographicSet = {
  gender: DemographicSlice[];
  age: DemographicSlice[];
  country: DemographicSlice[];
  city: DemographicSlice[];
};

export type AudienceSnapshot = {
  followers: DemographicSet;
  engaged: DemographicSet;
  /** false quando a Meta não retornou dado suficiente (conta abaixo do mínimo de seguidores/engajamentos) */
  hasEnoughData: boolean;
};

const GENDER_LABELS: Record<string, string> = { F: "Feminino", M: "Masculino", U: "Não informado" };

export function genderLabel(code: string): string {
  return GENDER_LABELS[code.toUpperCase()] ?? code;
}

// ponytail: mock determinístico, mesmo padrão do getOrganicSnapshot em metrics.ts —
// cobre dev local e clientes sem instagramBusinessId, sem depender da Graph API.
function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 0xffffffff;
  };
}

function mockSet(seed: string): DemographicSet {
  const rand = seededRandom(seed);

  const femalePct = Math.round(50 + rand() * 30);
  const gender: DemographicSlice[] = [
    { key: "F", label: genderLabel("F"), pct: femalePct },
    { key: "M", label: genderLabel("M"), pct: 100 - femalePct },
  ];

  const ageBrackets = ["13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
  const ageRaw = ageBrackets.map(() => rand());
  const ageSum = ageRaw.reduce((a, b) => a + b, 0);
  const age: DemographicSlice[] = ageBrackets.map((key, i) => ({
    key,
    label: key,
    pct: Math.round((ageRaw[i] / ageSum) * 100),
  }));

  const countries = ["BR", "US", "PT", "AR"];
  const countryRaw = countries.map((_, i) => rand() * (countries.length - i));
  const countrySum = countryRaw.reduce((a, b) => a + b, 0);
  const country: DemographicSlice[] = countries
    .map((code, i) => ({ key: code, label: countryName(code), pct: Math.round((countryRaw[i] / countrySum) * 100) }))
    .sort((a, b) => b.pct - a.pct);

  const cities = ["São Paulo", "Rio de Janeiro", "Orlando", "Miami", "Lisboa"];
  const cityRaw = cities.map((_, i) => rand() * (cities.length - i));
  const citySum = cityRaw.reduce((a, b) => a + b, 0);
  const city: DemographicSlice[] = cities
    .map((label, i) => ({ key: label, label, pct: Math.round((cityRaw[i] / citySum) * 100) }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5);

  return { gender, age, country, city };
}

export function getAudienceSnapshot(clientId: string, timeframe: AudienceTimeframeId): AudienceSnapshot {
  return {
    followers: mockSet(`${clientId}-${timeframe}-followers`),
    engaged: mockSet(`${clientId}-${timeframe}-engaged`),
    hasEnoughData: true,
  };
}
