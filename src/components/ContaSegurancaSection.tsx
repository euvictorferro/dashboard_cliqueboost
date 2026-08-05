// src/components/ContaSegurancaSection.tsx
export function ContaSegurancaSection() {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-1 text-sm font-bold text-card-foreground">Segurança</h2>
      <p className="text-sm text-muted-foreground">
        Login por e-mail e senha ainda não existe — está no roadmap. Por enquanto, o acesso à
        sua conta é feito pelo link único enviado a você pela Clique Boost, sem necessidade de
        senha.
      </p>
    </div>
  );
}
