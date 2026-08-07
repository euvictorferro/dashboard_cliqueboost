"use client";

import { useEffect, useState } from "react";

type AdminClient = {
  id: string;
  name: string;
  active: boolean;
  instagramBusinessId: string | null;
  clickupListId: string | null;
  trelloBoardId: string | null;
  adAccountId: string | null;
  adsActive: boolean;
  planName: string | null;
  paymentStatus: string | null;
  hasLogin: boolean;
};

type NewClientForm = {
  id: string;
  name: string;
  email: string;
  password: string;
  instagramBusinessId: string;
  clickupListId: string;
  trelloBoardId: string;
};

const EMPTY_FORM: NewClientForm = {
  id: "",
  name: "",
  email: "",
  password: "",
  instagramBusinessId: "",
  clickupListId: "",
  trelloBoardId: "",
};

function StatusChip({ active }: { active: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        active ? "bg-brand-success/15 text-brand-success" : "bg-muted text-muted-foreground"
      }`}
    >
      {active ? "Ativo" : "Pausado"}
    </span>
  );
}

function generatePassword(): string {
  return crypto.randomUUID().slice(0, 12);
}

export function ClientesPageClient() {
  const [clients, setClients] = useState<AdminClient[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<NewClientForm>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);
  const [editing, setEditing] = useState<AdminClient | null>(null);

  function load() {
    fetch("/api/admin/clients")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "erro");
        return data.clients as AdminClient[];
      })
      .then((list) => setClients(list))
      .catch(() => setError("Não foi possível carregar os clientes agora."));
  }

  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data?.error === "id_duplicado" ? "Já existe um cliente com esse id." : "Não foi possível criar o cliente.");
        return;
      }
      setCreatedCredentials({ email: data.email, password: data.password });
      setForm(EMPTY_FORM);
      load();
    } catch {
      setCreateError("Não foi possível criar o cliente.");
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveEdit(patch: Record<string, unknown>) {
    if (!editing) return;
    await fetch(`/api/admin/clients/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setEditing(null);
    load();
  }

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-6 py-8 sm:px-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Clientes</h1>
        <button
          type="button"
          onClick={() => {
            setShowCreate(true);
            setCreatedCredentials(null);
          }}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          Novo cliente
        </button>
      </div>

      {error && <p className="text-sm text-brand-danger">{error}</p>}

      {clients === null && !error && <p className="text-sm text-muted-foreground">Carregando...</p>}

      {clients && (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-card">
          <div className="grid grid-cols-[minmax(0,1fr)_140px_140px_100px_90px] gap-3 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Nome</span>
            <span>Plano</span>
            <span>Pagamento</span>
            <span>Integrações</span>
            <span>Status</span>
          </div>
          {clients.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setEditing(c)}
              className="grid w-full grid-cols-[minmax(0,1fr)_140px_140px_100px_90px] items-center gap-3 border-t border-border px-4 py-3 text-left text-sm transition-colors hover:bg-muted/60"
            >
              <span className="truncate font-medium text-foreground">{c.name}</span>
              <span className="truncate text-muted-foreground">{c.planName ?? "—"}</span>
              <span className="truncate text-muted-foreground">{c.paymentStatus ?? "—"}</span>
              <span className="truncate text-xs text-muted-foreground">
                {[c.instagramBusinessId && "IG", c.clickupListId && "ClickUp", c.trelloBoardId && "Trello"].filter(Boolean).join(" · ") || "—"}
              </span>
              <StatusChip active={c.active} />
            </button>
          ))}
          {clients.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground">Nenhum cliente ainda.</p>}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-[var(--radius-card)] bg-card p-6 shadow-[var(--shadow-soft)]">
            {createdCredentials ? (
              <div className="flex flex-col gap-4">
                <h2 className="text-lg font-semibold text-foreground">Cliente criado</h2>
                <p className="text-sm text-muted-foreground">Anota agora — a senha não fica salva aqui.</p>
                <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/60 p-3 text-sm">
                  <span>Email: {createdCredentials.email}</span>
                  <span>Senha: {createdCredentials.password}</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    navigator.clipboard.writeText(`Email: ${createdCredentials.email}\nSenha: ${createdCredentials.password}`)
                  }
                  className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
                >
                  Copiar
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold text-foreground">Novo cliente</h2>
                <input
                  placeholder="id (slug, ex: tiago)"
                  value={form.id}
                  onChange={(e) => setForm({ ...form, id: e.target.value })}
                  required
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none"
                />
                <input
                  placeholder="Nome"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none"
                />
                <input
                  placeholder="Email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none"
                />
                <div className="flex gap-2">
                  <input
                    placeholder="Senha"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    minLength={8}
                    className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, password: generatePassword() })}
                    className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
                  >
                    Gerar senha
                  </button>
                </div>
                <input
                  placeholder="Instagram Business ID (opcional)"
                  value={form.instagramBusinessId}
                  onChange={(e) => setForm({ ...form, instagramBusinessId: e.target.value })}
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none"
                />
                <input
                  placeholder="ClickUp List ID (opcional)"
                  value={form.clickupListId}
                  onChange={(e) => setForm({ ...form, clickupListId: e.target.value })}
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none"
                />
                <input
                  placeholder="Trello Board ID (opcional)"
                  value={form.trelloBoardId}
                  onChange={(e) => setForm({ ...form, trelloBoardId: e.target.value })}
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none"
                />
                {createError && <p className="text-xs text-brand-danger">{createError}</p>}
                <div className="mt-2 flex justify-end gap-2">
                  <button type="button" onClick={() => setShowCreate(false)} className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-60"
                  >
                    {creating ? "Criando..." : "Criar"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {editing && <EditClientModal client={editing} onClose={() => setEditing(null)} onSave={handleSaveEdit} />}
    </div>
  );
}

function EditClientModal({
  client,
  onClose,
  onSave,
}: {
  client: AdminClient;
  onClose: () => void;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const [name, setName] = useState(client.name);
  const [planName, setPlanName] = useState(client.planName ?? "");
  const [paymentStatus, setPaymentStatus] = useState(client.paymentStatus ?? "");
  const [active, setActive] = useState(client.active);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-[var(--radius-card)] bg-card p-6 shadow-[var(--shadow-soft)]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave({ name, planName: planName || null, paymentStatus: paymentStatus || null, active });
          }}
          className="flex flex-col gap-3"
        >
          <h2 className="text-lg font-semibold text-foreground">Editar {client.name}</h2>
          <a href={`/${client.id}`} className="text-sm text-brand-primary hover:underline">
            Ver dashboard →
          </a>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none"
          />
          <input
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
            placeholder="Plano"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none"
          />
          <input
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
            placeholder="Status de pagamento"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none"
          />
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="custom-checkbox" />
            Ativo
          </label>
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
              Cancelar
            </button>
            <button type="submit" className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90">
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
