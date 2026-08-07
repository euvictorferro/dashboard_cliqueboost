import Link from "next/link";
import { ErrorScreen } from "@/components/layout/ErrorScreen";

export default function NotFound() {
  return (
    <ErrorScreen
      emoji="🔍"
      title="Página não encontrada"
      message="Esse endereço não existe ou foi movido. Se você é cliente da Clique Boost, use o link enviado pela nossa equipe."
      action={
        <Link
          href="/login"
          className="rounded-2xl border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Ir para o login
        </Link>
      }
    />
  );
}
