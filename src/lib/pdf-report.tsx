import path from "path";
import {
  Document,
  Page,
  View,
  Text,
  Svg,
  Circle,
  Rect,
  Polyline,
  Defs,
  LinearGradient,
  Stop,
  Image,
  Font,
} from "@react-pdf/renderer";
import type { Client } from "./clients";
import type { OrganicSnapshot } from "./metrics";
import type { AudienceSnapshot, DemographicSlice } from "./audience";
import { roundToPercentages } from "./audience";

// ponytail: fontes estáticas em public/fonts (extraídas do @fontsource, não buscadas do CDN da
// Google em runtime) — arquivos por peso genuinamente distintos, o que a API do Google não
// garante quando serve fonte variável (mesmo hash pra pesos diferentes quebraria o negrito no PDF).
Font.register({
  family: "Montserrat",
  fonts: [400, 500, 600, 700, 800].map((weight) => ({
    src: path.join(process.cwd(), `public/fonts/montserrat-${weight}.woff`),
    fontWeight: weight,
  })),
});
Font.register({
  family: "Roboto",
  fonts: [400, 500, 700].map((weight) => ({
    src: path.join(process.cwd(), `public/fonts/roboto-${weight}.woff`),
    fontWeight: weight,
  })),
});

// ponytail: o HTML de referência foi desenhado em px de navegador (96dpi). O react-pdf trata
// número solto como pt (72dpi) — por isso setamos dpi=96 em cada <Page> e escrevemos toda medida
// vinda da referência como string "Npx" (deixa o react-pdf converter certinho), em vez de copiar
// o número cru como se fosse pt. Sem isso, tudo que não foi manualmente reduzido fica ~33% maior.
const DPI = 96;

const COLORS = {
  purple: "#8A2BE2",
  blue: "#007BFF",
  green: "#00C49A",
  red: "#FF4136",
  white: "#FFFFFF",
  black: "#151515",
  grey100: "#E0E0E0",
  grey300: "#A9A9A9",
  grey700: "#4F4F4F",
  sunken: "#F7F7F8",
};

const AGE_ORDER = ["13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
const AGE_BAR_COLORS = ["#C9A7F0", "#A96CE8", "#9748E0", "#8A2BE2", "#6C22B3", "#4E1880", "#33104F"];

function topWithOthers(slices: DemographicSlice[], n: number, othersLabel: string): DemographicSlice[] {
  const sorted = [...slices].sort((a, b) => b.pct - a.pct);
  const top = sorted.slice(0, n);
  const rest = sorted.slice(n).reduce((sum, s) => sum + s.pct, 0);
  return rest > 0 ? [...top, { key: "__others", label: othersLabel, pct: rest }] : top;
}

function sparklineCoords(trend: { value: number }[]): { x: number; y: number }[] {
  if (trend.length === 0) return [{ x: 0, y: 54 }, { x: 400, y: 54 }];
  const max = Math.max(1, ...trend.map((t) => t.value));
  const min = Math.min(...trend.map((t) => t.value));
  const range = Math.max(1, max - min);
  const stepX = 400 / Math.max(1, trend.length - 1);
  return trend.map((t, i) => ({ x: i * stepX, y: 54 - ((t.value - min) / range) * 48 }));
}

// ponytail: Montserrat/Roboto não têm glyph de emoji, e o react-pdf não faz fallback pra outra
// fonte — emoji real vindo da legenda do post (ex: 🎆✨) vira caractere quebrado no PDF.
function stripEmoji(text: string): string {
  return text
    .replace(/[\u{1F1E6}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}️‍]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function GradientRect({ id, radius = "0px" }: { id: string; radius?: string }) {
  return (
    <Svg
      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={COLORS.purple} />
          <Stop offset="100%" stopColor={COLORS.blue} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={100} height={100} fill={`url(#${id})`} rx={radius} ry={radius} />
    </Svg>
  );
}

function Donut({ sizePx, slices }: { sizePx: number; slices: { pct: number; color: string }[] }) {
  const r = sizePx * 0.4;
  const cx = sizePx / 2;
  const cy = sizePx / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  return (
    <Svg width={`${sizePx}px`} height={`${sizePx}px`} viewBox={`0 0 ${sizePx} ${sizePx}`}>
      <Circle cx={cx} cy={cy} r={r} fill="none" stroke={COLORS.grey100} strokeWidth={sizePx * 0.16} />
      {slices.map((s, i) => {
        const len = Math.max(0.01, (s.pct / 100) * circumference);
        // ponytail: react-pdf (via pdfkit) não suporta strokeDashoffset e rejeita valores 0 no
        // dasharray — em vez de "pular" até a posição da fatia via dashoffset, giro o próprio
        // círculo pro ângulo inicial da fatia e uso um dasharray de 2 valores (fatia, resto).
        const startAngle = -90 + (offset / circumference) * 360;
        const el = (
          <Circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={sizePx * 0.16}
            strokeDasharray={`${len} ${Math.max(0.01, circumference - len)}`}
            transform={`rotate(${startAngle} ${cx} ${cy})`}
          />
        );
        offset += len;
        return el;
      })}
    </Svg>
  );
}

function Legend({
  items,
  fontSize = "13px",
  dot = "10px",
}: {
  items: { label: string; pct: number; color: string }[];
  fontSize?: string;
  dot?: string;
}) {
  return (
    <View style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
      {items.map((it) => (
        <View key={it.label} style={{ flexDirection: "row", alignItems: "center", gap: "8px" }}>
          <View style={{ width: dot, height: dot, borderRadius: "3px", backgroundColor: it.color }} />
          <Text style={{ flex: 1, fontSize, fontFamily: "Roboto" }}>{it.label}</Text>
          <Text style={{ fontSize, fontFamily: "Roboto", fontWeight: 700 }}>{it.pct}%</Text>
        </View>
      ))}
    </View>
  );
}

// ponytail: sem flex:1 aqui de propósito — um Card sozinho numa coluna (Alcance, Top 5 posts)
// não deve esticar pra ocupar a altura sobrando da página. Quem usa Card lado a lado numa linha
// (Gênero/Idade, Países/Cidades, mini-donuts) passa flex:1 explicitamente via style.
function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View
      style={{
        borderRadius: "14px",
        padding: "20px",
        borderWidth: "1px",
        borderColor: COLORS.grey100,
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        ...style,
      }}
    >
      {children}
    </View>
  );
}

function Eyebrow({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <Text
      style={{
        fontSize: "12px",
        fontWeight: 600,
        letterSpacing: "0.4px",
        textTransform: "uppercase",
        color: COLORS.grey700,
        fontFamily: "Roboto",
        ...style,
      }}
    >
      {children}
    </Text>
  );
}

function PageHeader({ eyebrow, client, period }: { eyebrow: string; client: string; period: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-end",
        borderBottomWidth: "1px",
        borderBottomColor: COLORS.grey100,
        paddingBottom: "14px",
      }}
    >
      <View style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <Text
          style={{
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: COLORS.purple,
            fontFamily: "Montserrat",
          }}
        >
          {eyebrow}
        </Text>
        <Text style={{ fontSize: "18px", fontWeight: 700, fontFamily: "Montserrat" }}>{client}</Text>
      </View>
      <Text style={{ fontSize: "13px", fontWeight: 500, color: COLORS.grey700, fontFamily: "Roboto" }}>
        {period}
      </Text>
    </View>
  );
}

function PostsMediaPage({ client, period, snapshot }: { client: string; period: string; snapshot: OrganicSnapshot }) {
  const m = snapshot.metrics;
  const maxLikes = Math.max(1, ...snapshot.topPosts.map((p) => p.likes));
  const coords = sparklineCoords(snapshot.trend);

  return (
    <Page
      size="A4"
      dpi={DPI}
      style={{ padding: "16mm 14mm", display: "flex", flexDirection: "column", gap: "8mm", fontFamily: "Roboto" }}
    >
      <PageHeader eyebrow="Posts e Mídia" client={client} period={period} />

      <View style={{ flexDirection: "row", gap: "14px" }}>
        <View style={{ flex: 1, borderRadius: "14px", padding: "20px", backgroundColor: COLORS.sunken }}>
          <Eyebrow>Novos seguidores</Eyebrow>
          <Text style={{ fontSize: "32px", fontWeight: 800, marginTop: "8px", fontFamily: "Montserrat" }}>
            {m.newFollowers.toLocaleString("pt-BR")}
          </Text>
        </View>
        <View style={{ flex: 1, borderRadius: "14px", padding: "20px", backgroundColor: COLORS.sunken }}>
          <Eyebrow>Seguidores perdidos</Eyebrow>
          <Text style={{ fontSize: "32px", fontWeight: 800, marginTop: "8px", fontFamily: "Montserrat" }}>
            {m.lostFollowers.toLocaleString("pt-BR")}
          </Text>
        </View>
        <View style={{ flex: 1, position: "relative", borderRadius: "14px", padding: "20px", overflow: "hidden" }}>
          {/* ponytail: sem radius aqui — o Rect não é quadrado, então rx/ry ficariam elípticos.
              O corte redondo já vem do overflow:hidden + borderRadius do View pai (igual aos outros cards). */}
          <GradientRect id="netCardGrad" />
          <View style={{ position: "relative" }}>
            <Eyebrow style={{ color: COLORS.white, opacity: 0.85 }}>Seguidores líquidos</Eyebrow>
            <Text
              style={{ fontSize: "32px", fontWeight: 800, marginTop: "8px", color: COLORS.white, fontFamily: "Montserrat" }}
            >
              {m.netFollowers.toLocaleString("pt-BR")}
            </Text>
          </View>
        </View>
      </View>

      <Card>
        <View>
          <Eyebrow>Alcance</Eyebrow>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: "12px", marginTop: "8px" }}>
            <Text style={{ fontSize: "34px", fontWeight: 800, fontFamily: "Montserrat" }}>
              {m.reach.toLocaleString("pt-BR")}
            </Text>
            {snapshot.changePct.reach !== null && (
              <Text
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: snapshot.changePct.reach >= 0 ? COLORS.green : COLORS.red,
                }}
              >
                {snapshot.changePct.reach >= 0 ? "+" : "-"}
                {Math.abs(snapshot.changePct.reach).toFixed(0)}%
              </Text>
            )}
          </View>
        </View>
        <Svg viewBox="0 0 400 60" width="100%" height="60px" preserveAspectRatio="none">
          <Polyline
            points={coords.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={COLORS.blue}
            strokeWidth="3px"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Card>

      <View style={{ flexDirection: "row", borderRadius: "14px", padding: "20px", backgroundColor: COLORS.sunken }}>
        {[
          { label: "Views", value: m.views },
          { label: "Curtidas", value: m.likes },
          { label: "Comentários", value: m.comments },
          { label: "Salvamentos", value: m.saves },
        ].map((stat, i) => (
          <View
            key={stat.label}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              paddingLeft: i > 0 ? "20px" : "0px",
              marginLeft: i > 0 ? "20px" : "0px",
              borderLeftWidth: i > 0 ? "1px" : "0px",
              borderLeftColor: COLORS.grey100,
            }}
          >
            <Text style={{ fontSize: "22px", fontWeight: 800, fontFamily: "Montserrat" }}>
              {stat.value.toLocaleString("pt-BR")}
            </Text>
            <Text style={{ fontSize: "12px", fontWeight: 500, color: COLORS.grey700 }}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <Card style={{ gap: "4px" }}>
        <Text
          style={{
            fontSize: "14px",
            fontWeight: 700,
            letterSpacing: "0.3px",
            textTransform: "uppercase",
            fontFamily: "Montserrat",
            marginBottom: "6px",
          }}
        >
          Top 5 posts
        </Text>
        {snapshot.topPosts.map((post, i) => (
          <View
            key={post.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: "14px",
              paddingVertical: "10px",
              borderTopWidth: "1px",
              borderTopColor: COLORS.grey100,
            }}
          >
            {post.thumbnailUrl ? (
              <Image
                src={post.thumbnailUrl}
                style={{ width: "44px", height: "44px", borderRadius: "8px", objectFit: "cover" }}
              />
            ) : (
              <View
                style={{ width: "44px", height: "44px", borderRadius: "8px", backgroundColor: post.thumbnailColor }}
              />
            )}
            <Text style={{ flex: 1, fontSize: "14px", fontWeight: 600 }}>{stripEmoji(post.title)}</Text>
            <Svg width="150px" height="6px" viewBox="0 0 150 6" preserveAspectRatio="none">
              <Defs>
                <LinearGradient id={`barGrad${i}`} x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0%" stopColor={COLORS.purple} />
                  <Stop offset="100%" stopColor={COLORS.blue} />
                </LinearGradient>
              </Defs>
              <Rect x={0} y={0} width={150} height={6} rx={3} fill={COLORS.sunken} />
              <Rect
                x={0}
                y={0}
                width={Math.max(8, (post.likes / maxLikes) * 150)}
                height={6}
                rx={3}
                fill={`url(#barGrad${i})`}
              />
            </Svg>
          </View>
        ))}
      </Card>
    </Page>
  );
}

function AudiencePage({
  client,
  period,
  audience,
  reachBreakdown,
}: {
  client: string;
  period: string;
  audience: AudienceSnapshot;
  reachBreakdown?: OrganicSnapshot["reachBreakdown"];
}) {
  const genderColors: Record<string, string> = { F: COLORS.purple, M: COLORS.blue, U: COLORS.green };
  const gender = audience.followers.gender.map((s) => ({ ...s, color: genderColors[s.key] ?? COLORS.grey300 }));

  const ageSlices = AGE_ORDER
    .map((key) => audience.followers.age.find((s) => s.key === key))
    .filter((s): s is DemographicSlice => Boolean(s));
  const maxAge = Math.max(1, ...ageSlices.map((s) => s.pct));

  const countries = topWithOthers(audience.followers.country, 2, "Outros");
  const cities = topWithOthers(audience.followers.city, 3, "Outras");

  const followType = reachBreakdown?.byFollowType;
  const followPcts = followType ? roundToPercentages([followType.follower, followType.nonFollower]) : [0, 0];
  const mediaType = reachBreakdown?.byMediaType;
  const mediaPcts = mediaType ? roundToPercentages([mediaType.post, mediaType.story, mediaType.reel]) : [0, 0, 0];

  return (
    <Page
      size="A4"
      dpi={DPI}
      style={{ padding: "16mm 14mm", display: "flex", flexDirection: "column", gap: "8mm", fontFamily: "Roboto" }}
    >
      <PageHeader eyebrow="Público" client={client} period={period} />

      <View style={{ flexDirection: "row", gap: "14px" }}>
        <Card style={{ flex: 1 }}>
          <Eyebrow>Gênero</Eyebrow>
          <View style={{ flexDirection: "row", alignItems: "center", gap: "20px" }}>
            <Donut sizePx={96} slices={gender.map((g) => ({ pct: g.pct, color: g.color }))} />
            <Legend items={gender.map((g) => ({ label: g.label, pct: g.pct, color: g.color }))} />
          </View>
        </Card>
        <Card style={{ flex: 1 }}>
          <Eyebrow>Idade</Eyebrow>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: "8px", height: "96px" }}>
            {ageSlices.map((s, i) => (
              <View key={s.key} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height: "96px", gap: "6px" }}>
                <View
                  style={{
                    width: "100%",
                    height: `${Math.max(2, (s.pct / maxAge) * 80)}px`,
                    backgroundColor: AGE_BAR_COLORS[i],
                    borderTopLeftRadius: "4px",
                    borderTopRightRadius: "4px",
                  }}
                />
                <Text style={{ fontSize: "9px", color: COLORS.grey700 }}>{s.key}</Text>
              </View>
            ))}
          </View>
        </Card>
      </View>

      <View style={{ flexDirection: "row", gap: "14px" }}>
        <Card style={{ flex: 1, gap: "4px" }}>
          <Eyebrow style={{ marginBottom: "6px" }}>Países</Eyebrow>
          {countries.map((c) => (
            <View
              key={c.key}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: "10px",
                paddingVertical: "8px",
                borderTopWidth: "1px",
                borderTopColor: COLORS.grey100,
              }}
            >
              {c.key === "__others" ? (
                <View style={{ width: "16px", height: "16px" }} />
              ) : (
                <Image
                  src={`https://flagcdn.com/w40/${c.key.toLowerCase()}.png`}
                  style={{ width: "16px", height: "12px", borderRadius: "2px", objectFit: "cover" }}
                />
              )}
              <Text style={{ flex: 1, fontSize: "13px", fontWeight: 600 }}>{c.label}</Text>
              <Text style={{ fontSize: "13px", fontWeight: 700 }}>{c.pct}%</Text>
            </View>
          ))}
        </Card>
        <Card style={{ flex: 1, gap: "4px" }}>
          <Eyebrow style={{ marginBottom: "6px" }}>Cidades</Eyebrow>
          {cities.map((c) => (
            <View
              key={c.key}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: "10px",
                paddingVertical: "8px",
                borderTopWidth: "1px",
                borderTopColor: COLORS.grey100,
              }}
            >
              <Text style={{ flex: 1, fontSize: "13px", fontWeight: 600 }}>{c.label}</Text>
              <Text style={{ fontSize: "13px", fontWeight: 700 }}>{c.pct}%</Text>
            </View>
          ))}
        </Card>
      </View>

      {reachBreakdown && (
        <View style={{ flexDirection: "row", gap: "14px" }}>
          <Card style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: "20px" }}>
            <Donut
              sizePx={80}
              slices={[
                { pct: followPcts[0], color: COLORS.blue },
                { pct: followPcts[1], color: COLORS.purple },
              ]}
            />
            <View style={{ gap: "8px" }}>
              <Eyebrow style={{ marginBottom: "2px" }}>Seguidor vs. não-seguidor</Eyebrow>
              <View style={{ flexDirection: "row", alignItems: "center", gap: "8px" }}>
                <View style={{ width: "10px", height: "10px", borderRadius: "3px", backgroundColor: COLORS.blue }} />
                <Text style={{ fontSize: "13px" }}>Seguidor</Text>
                <Text style={{ fontSize: "13px", fontWeight: 700, marginLeft: "auto" }}>{followPcts[0]}%</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: "8px" }}>
                <View style={{ width: "10px", height: "10px", borderRadius: "3px", backgroundColor: COLORS.purple }} />
                <Text style={{ fontSize: "13px" }}>Não-seguidor</Text>
                <Text style={{ fontSize: "13px", fontWeight: 700, marginLeft: "auto" }}>{followPcts[1]}%</Text>
              </View>
            </View>
          </Card>
          <Card style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: "20px" }}>
            <Donut
              sizePx={80}
              slices={[
                { pct: mediaPcts[0], color: COLORS.purple },
                { pct: mediaPcts[1], color: COLORS.blue },
                { pct: mediaPcts[2], color: COLORS.green },
              ]}
            />
            <View style={{ gap: "6px" }}>
              <Eyebrow style={{ marginBottom: "2px" }}>Tipo de conteúdo</Eyebrow>
              {[
                { label: "Posts", pct: mediaPcts[0], color: COLORS.purple },
                { label: "Stories", pct: mediaPcts[1], color: COLORS.blue },
                { label: "Reels", pct: mediaPcts[2], color: COLORS.green },
              ].map((it) => (
                <View key={it.label} style={{ flexDirection: "row", alignItems: "center", gap: "8px" }}>
                  <View style={{ width: "9px", height: "9px", borderRadius: "2px", backgroundColor: it.color }} />
                  <Text style={{ fontSize: "12px" }}>{it.label}</Text>
                  <Text style={{ fontSize: "12px", fontWeight: 700, marginLeft: "auto" }}>{it.pct}%</Text>
                </View>
              ))}
            </View>
          </Card>
        </View>
      )}
    </Page>
  );
}

export function ReportDocument({
  client,
  period,
  organic,
  audience,
}: {
  client: Client;
  period: string;
  organic: OrganicSnapshot;
  audience: AudienceSnapshot;
}) {
  return (
    <Document>
      <PostsMediaPage client={client.name} period={period} snapshot={organic} />
      <AudiencePage client={client.name} period={period} audience={audience} reachBreakdown={organic.reachBreakdown} />
    </Document>
  );
}
