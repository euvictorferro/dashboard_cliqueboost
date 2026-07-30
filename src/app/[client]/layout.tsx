import { fetchClientSettings } from "@/lib/clientSettings";
import { hexToHslTriplet } from "@/lib/hexColor";

export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ client: string }>;
}) {
  const { client } = await params;

  let brandColor: string | null = null;
  try {
    brandColor = (await fetchClientSettings(client)).brandColor;
  } catch (err) {
    console.error(`[conta] falha ao buscar brandColor de ${client}, usando padrão:`, err);
  }

  if (!brandColor) return <>{children}</>;

  return (
    <div className="contents" style={{ "--brand-primary": hexToHslTriplet(brandColor) } as React.CSSProperties}>
      {children}
    </div>
  );
}
