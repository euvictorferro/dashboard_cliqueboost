// src/app/admin/login/page.tsx
import { Logo } from "@/components/layout/Logo";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12 sm:px-10">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <Logo />
        </div>

        <div className="mb-6">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight text-foreground md:text-5xl">
            Admin — Clique Boost
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">Entra com o email e senha da agência.</p>
        </div>

        <AdminLoginForm />
      </div>
    </div>
  );
}
