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

function sparklinePoints(trend: { value: number }[]): string {
  if (trend.length === 0) return "0,54 400,54";
  const max = Math.max(1, ...trend.map((t) => t.value));
  const min = Math.min(...trend.map((t) => t.value));
  const range = Math.max(1, max - min);
  const stepX = 400 / Math.max(1, trend.length - 1);
  return trend
    .map((t, i) => `${(i * stepX).toFixed(1)},${(54 - ((t.value - min) / range) * 48).toFixed(1)}`)
    .join(" ");
}

// ponytail: Montserrat/Roboto não têm glyph de emoji, e o react-pdf não faz fallback pra outra
// fonte — emoji real vindo da legenda do post (ex: 🎆✨) vira caractere quebrado no PDF.
function stripEmoji(text: string): string {
  return text
    .replace(/[\u{1F1E6}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\uFE0F\u200D]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function GradientRect({ id, radius = 0 }: { id: string; radius?: number }) {
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

function Donut({ size, slices }: { size: number; slices: { pct: number; color: string }[] }) {
  const r = size * 0.4;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={cx} cy={cy} r={r} fill="none" stroke={COLORS.grey100} strokeWidth={size * 0.16} />
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
            strokeWidth={size * 0.16}
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

function Legend({ items }: { items: { label: string; pct: number; color: string }[] }) {
  return (
    <View style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
      {items.map((it) => (
        <View key={it.label} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: it.color }} />
          <Text style={{ flex: 1, fontSize: 11, fontFamily: "Roboto" }}>{it.label}</Text>
          <Text style={{ fontSize: 11, fontFamily: "Roboto", fontWeight: 700 }}>{it.pct}%</Text>
        </View>
      ))}
    </View>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View
      style={{
        flex: 1,
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: COLORS.grey100,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        ...style,
      }}
    >
      {children}
    </View>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: 0.4,
        textTransform: "uppercase",
        color: COLORS.grey700,
        fontFamily: "Roboto",
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
        borderBottomWidth: 1,
        borderBottomColor: COLORS.grey100,
        paddingBottom: 14,
      }}
    >
      <View style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Text
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: COLORS.purple,
            fontFamily: "Montserrat",
          }}
        >
          {eyebrow}
        </Text>
        <Text style={{ fontSize: 18, fontWeight: 700, fontFamily: "Montserrat" }}>{client}</Text>
      </View>
      <Text style={{ fontSize: 13, fontWeight: 500, color: COLORS.grey700, fontFamily: "Roboto" }}>{period}</Text>
    </View>
  );
}

function PostsMediaPage({ client, period, snapshot }: { client: string; period: string; snapshot: OrganicSnapshot }) {
  const m = snapshot.metrics;
  const maxLikes = Math.max(1, ...snapshot.topPosts.map((p) => p.likes));

  return (
    <Page size="A4" style={{ padding: 32, display: "flex", flexDirection: "column", gap: 12, fontFamily: "Roboto" }}>
      <PageHeader eyebrow="Posts e Mídia" client={client} period={period} />

      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1, borderRadius: 12, padding: 12, backgroundColor: COLORS.sunken }}>
          <Eyebrow>Novos seguidores</Eyebrow>
          <Text style={{ fontSize: 22, fontWeight: 800, marginTop: 5, fontFamily: "Montserrat" }}>
            {m.newFollowers.toLocaleString("pt-BR")}
          </Text>
        </View>
        <View style={{ flex: 1, borderRadius: 12, padding: 12, backgroundColor: COLORS.sunken }}>
          <Eyebrow>Seguidores perdidos</Eyebrow>
          <Text style={{ fontSize: 22, fontWeight: 800, marginTop: 5, fontFamily: "Montserrat" }}>
            {m.lostFollowers.toLocaleString("pt-BR")}
          </Text>
        </View>
        <View style={{ flex: 1, position: "relative", borderRadius: 12, padding: 12, overflow: "hidden" }}>
          <GradientRect id="netCardGrad" radius={12} />
          <View style={{ position: "relative" }}>
            <Text style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", color: COLORS.white, opacity: 0.85 }}>
              Seguidores líquidos
            </Text>
            <Text style={{ fontSize: 22, fontWeight: 800, marginTop: 5, color: COLORS.white, fontFamily: "Montserrat" }}>
              {m.netFollowers.toLocaleString("pt-BR")}
            </Text>
          </View>
        </View>
      </View>

      <Card>
        <View>
          <Eyebrow>Alcance</Eyebrow>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10, marginTop: 5 }}>
            <Text style={{ fontSize: 24, fontWeight: 800, fontFamily: "Montserrat" }}>{m.reach.toLocaleString("pt-BR")}</Text>
            {snapshot.changePct.reach !== null && (
              <Text style={{ fontSize: 12, fontWeight: 700, color: snapshot.changePct.reach >= 0 ? COLORS.green : COLORS.red }}>
                {snapshot.changePct.reach >= 0 ? "+" : "-"}
                {Math.abs(snapshot.changePct.reach).toFixed(0)}%
              </Text>
            )}
          </View>
        </View>
        <Svg viewBox="0 0 400 60" width="100%" height={32}>
          <Defs>
            <LinearGradient id="sparkGrad" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor={COLORS.purple} />
              <Stop offset="100%" stopColor={COLORS.blue} />
            </LinearGradient>
          </Defs>
          <Polyline
            points={sparklinePoints(snapshot.trend)}
            fill="none"
            stroke="url(#sparkGrad)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Card>

      <View style={{ flexDirection: "row", borderRadius: 12, padding: 14, backgroundColor: COLORS.sunken }}>
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
              paddingLeft: i > 0 ? 14 : 0,
              marginLeft: i > 0 ? 14 : 0,
              borderLeftWidth: i > 0 ? 1 : 0,
              borderLeftColor: COLORS.grey100,
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: 800, fontFamily: "Montserrat" }}>{stat.value.toLocaleString("pt-BR")}</Text>
            <Text style={{ fontSize: 10, color: COLORS.grey700, marginTop: 3 }}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <Card>
        <Text style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", fontFamily: "Montserrat" }}>
          Top 5 posts
        </Text>
        {snapshot.topPosts.map((post, i) => (
          <View
            key={post.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingVertical: 5,
              borderTopWidth: 1,
              borderTopColor: COLORS.grey100,
            }}
          >
            {post.thumbnailUrl ? (
              <Image
                src={post.thumbnailUrl}
                style={{ width: 34, height: 34, borderRadius: 6, objectFit: "cover" }}
              />
            ) : (
              <View style={{ width: 34, height: 34, borderRadius: 6, backgroundColor: post.thumbnailColor }} />
            )}
            <Text style={{ flex: 1, fontSize: 10, fontWeight: 600 }}>{stripEmoji(post.title)}</Text>
            <Svg width={90} height={5}>
              <Defs>
                <LinearGradient id={`barGrad${i}`} x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0%" stopColor={COLORS.purple} />
                  <Stop offset="100%" stopColor={COLORS.blue} />
                </LinearGradient>
              </Defs>
              <Rect x={0} y={0} width={90} height={5} rx={2.5} fill={COLORS.sunken} />
              <Rect
                x={0}
                y={0}
                width={Math.max(5, (post.likes / maxLikes) * 90)}
                height={5}
                rx={2.5}
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
    <Page size="A4" style={{ padding: 32, display: "flex", flexDirection: "column", gap: 12, fontFamily: "Roboto" }}>
      <PageHeader eyebrow="Público" client={client} period={period} />

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Card>
          <Eyebrow>Gênero</Eyebrow>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <Donut size={72} slices={gender.map((g) => ({ pct: g.pct, color: g.color }))} />
            <Legend items={gender.map((g) => ({ label: g.label, pct: g.pct, color: g.color }))} />
          </View>
        </Card>
        <Card>
          <Eyebrow>Idade</Eyebrow>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, height: 58 }}>
            {ageSlices.map((s, i) => (
              <View key={s.key} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height: 58 }}>
                <View
                  style={{
                    width: "100%",
                    height: Math.max(2, (s.pct / maxAge) * 44),
                    backgroundColor: AGE_BAR_COLORS[i],
                    borderTopLeftRadius: 2,
                    borderTopRightRadius: 2,
                  }}
                />
                <Text style={{ fontSize: 6.5, color: COLORS.grey700, marginTop: 4 }}>{s.key}</Text>
              </View>
            ))}
          </View>
        </Card>
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Card style={{ gap: 2 }}>
          <Eyebrow>Países</Eyebrow>
          {countries.map((c) => (
            <View
              key={c.key}
              style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5, borderTopWidth: 1, borderTopColor: COLORS.grey100 }}
            >
              {c.key === "__others" ? (
                <View style={{ width: 16, height: 12 }} />
              ) : (
                <Image
                  src={`https://flagcdn.com/w40/${c.key.toLowerCase()}.png`}
                  style={{ width: 16, height: 12, borderRadius: 2, objectFit: "cover" }}
                />
              )}
              <Text style={{ flex: 1, fontSize: 11, fontWeight: 600 }}>{c.label}</Text>
              <Text style={{ fontSize: 11, fontWeight: 700 }}>{c.pct}%</Text>
            </View>
          ))}
        </Card>
        <Card style={{ gap: 2 }}>
          <Eyebrow>Cidades</Eyebrow>
          {cities.map((c) => (
            <View
              key={c.key}
              style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5, borderTopWidth: 1, borderTopColor: COLORS.grey100 }}
            >
              <Text style={{ flex: 1, fontSize: 11, fontWeight: 600 }}>{c.label}</Text>
              <Text style={{ fontSize: 11, fontWeight: 700 }}>{c.pct}%</Text>
            </View>
          ))}
        </Card>
      </View>

      {reachBreakdown && (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Card style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <Donut
              size={62}
              slices={[
                { pct: followPcts[0], color: COLORS.blue },
                { pct: followPcts[1], color: COLORS.purple },
              ]}
            />
            <View style={{ gap: 5 }}>
              <Eyebrow>Seguidor vs. não-seguidor</Eyebrow>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: COLORS.blue }} />
                <Text style={{ fontSize: 11 }}>Seguidor</Text>
                <Text style={{ fontSize: 11, fontWeight: 700, marginLeft: "auto" }}>{followPcts[0]}%</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: COLORS.purple }} />
                <Text style={{ fontSize: 11 }}>Não-seguidor</Text>
                <Text style={{ fontSize: 11, fontWeight: 700, marginLeft: "auto" }}>{followPcts[1]}%</Text>
              </View>
            </View>
          </Card>
          <Card style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <Donut
              size={62}
              slices={[
                { pct: mediaPcts[0], color: COLORS.purple },
                { pct: mediaPcts[1], color: COLORS.blue },
                { pct: mediaPcts[2], color: COLORS.green },
              ]}
            />
            <View style={{ gap: 4 }}>
              <Eyebrow>Tipo de conteúdo</Eyebrow>
              {[
                { label: "Posts", pct: mediaPcts[0], color: COLORS.purple },
                { label: "Stories", pct: mediaPcts[1], color: COLORS.blue },
                { label: "Reels", pct: mediaPcts[2], color: COLORS.green },
              ].map((it) => (
                <View key={it.label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: it.color }} />
                  <Text style={{ fontSize: 10 }}>{it.label}</Text>
                  <Text style={{ fontSize: 10, fontWeight: 700, marginLeft: "auto" }}>{it.pct}%</Text>
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
