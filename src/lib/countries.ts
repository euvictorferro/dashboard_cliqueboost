// ponytail: tabela fixa, cobre os países mais prováveis de aparecer no público dos clientes.
// Fallback pro próprio código ISO se não estiver na lista — nunca quebra a UI.
export const COUNTRY_NAMES: Record<string, string> = {
  BR: "Brasil",
  US: "Estados Unidos",
  PT: "Portugal",
  AR: "Argentina",
  MX: "México",
  CO: "Colômbia",
  CL: "Chile",
  PE: "Peru",
  UY: "Uruguai",
  PY: "Paraguai",
  BO: "Bolívia",
  EC: "Equador",
  VE: "Venezuela",
  ES: "Espanha",
  FR: "França",
  DE: "Alemanha",
  IT: "Itália",
  GB: "Reino Unido",
  CA: "Canadá",
  JP: "Japão",
  CN: "China",
  IN: "Índia",
  AU: "Austrália",
  NL: "Países Baixos",
  TR: "Turquia",
  RU: "Rússia",
  ZA: "África do Sul",
  AE: "Emirados Árabes Unidos",
  IE: "Irlanda",
  CH: "Suíça",
};

export function countryName(code: string): string {
  return COUNTRY_NAMES[code.toUpperCase()] ?? code;
}
