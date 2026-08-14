// src/app/[client]/atualizar-conta/page.tsx
import { Logo } from "@/components/layout/Logo";
import { UpdateCredentialsForm } from "@/components/login/UpdateCredentialsForm";

export default async function AtualizarContaPage({ params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center gap-6 px-4 py-16">
      <Logo />
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Atualize sua conta</h1>
        <p className="text-sm text-muted-foreground">
          Essa conta foi criada com um email temporário. Antes de continuar, coloque seu email e uma senha só sua.
        </p>
      </div>
      <UpdateCredentialsForm clientId={clientId} />
    </div>
  );
}
