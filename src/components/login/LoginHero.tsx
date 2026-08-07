// ponytail: a referência usa uma foto de stock (unsplash) como hero. Pra não depender de asset
// externo (e sem imagem de marca própria pronta), a mesma composição visual (card com inset,
// diagonais coloridas) é recriada com um gradient CSS puro, sem hospedar/baixar imagem nenhuma.
export function LoginHero() {
  return (
    <div className="hidden h-full p-4 lg:block">
      <div
        className="h-full w-full rounded-3xl"
        style={{
          background:
            "repeating-linear-gradient(115deg, hsl(var(--brand-primary)) 0%, hsl(var(--brand-accent)) 12%, hsl(263 60% 25%) 24%)",
        }}
      />
    </div>
  );
}
