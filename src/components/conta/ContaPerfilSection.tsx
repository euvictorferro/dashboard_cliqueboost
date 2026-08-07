"use client";

import type { ChangeEvent, RefObject } from "react";
import { ContaField } from "./ContaField";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function ContaPerfilSection({
  clientName,
  contactEmail,
  onEmailChange,
  emailSaveStatus,
  onSaveEmail,
  logoUrl,
  uploadStatus,
  fileInputRef,
  onLogoChange,
}: {
  clientName: string;
  contactEmail: string;
  onEmailChange: (value: string) => void;
  emailSaveStatus: SaveStatus;
  onSaveEmail: () => void;
  logoUrl: string | null;
  uploadStatus: SaveStatus;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onLogoChange: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  const emailBadge =
    emailSaveStatus === "saved"
      ? { label: "Salvo", tone: "success" as const }
      : emailSaveStatus === "error"
        ? { label: "Erro ao salvar", tone: "warning" as const }
        : undefined;

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-1 text-sm font-bold text-card-foreground">Perfil</h2>
      <p className="mb-5 text-xs text-muted-foreground">Informações básicas da sua conta.</p>

      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="flex shrink-0 flex-col items-center gap-2">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Foto de perfil" className="h-28 w-28 rounded-full border border-border object-cover" />
          ) : (
            <div className="flex h-28 w-28 items-center justify-center rounded-full border border-dashed border-border text-xs text-muted-foreground">
              Sem foto
            </div>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadStatus === "saving"}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-card-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {uploadStatus === "saving" ? "Enviando..." : "Trocar foto"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            onChange={onLogoChange}
            className="hidden"
          />
          {uploadStatus === "error" && <p className="text-xs text-red-500">Não foi possível enviar.</p>}
        </div>

        <div className="flex flex-1 flex-col gap-4">
          <ContaField label="Nome">{clientName}</ContaField>

          <div>
            <ContaField label="E-mail de contato" badge={emailBadge}>
              <input
                type="email"
                aria-label="E-mail de contato"
                value={contactEmail}
                onChange={(e) => onEmailChange(e.target.value)}
                placeholder="seu@email.com"
                className="w-full bg-transparent text-sm font-medium text-card-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground"
              />
            </ContaField>
            <button
              type="button"
              onClick={onSaveEmail}
              disabled={emailSaveStatus === "saving"}
              className="mt-2 rounded-md bg-brand-primary px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-primary/90 disabled:opacity-50"
            >
              {emailSaveStatus === "saving" ? "Salvando..." : "Salvar e-mail"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
