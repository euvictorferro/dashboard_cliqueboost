"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/layout/Logo";

export default function SairPage() {
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/logout", { method: "POST" }).finally(() => {
      setTimeout(() => router.push("/login"), 1500);
    });
  }, [router]);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-sm flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <Logo />
      <h1 className="text-xl font-semibold text-foreground">Você saiu</h1>
      <p className="text-sm text-muted-foreground">Redirecionando pro login...</p>
    </div>
  );
}
