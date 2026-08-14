"use client";

import { useEffect, useState } from "react";
import { CLIENTS } from "@/lib/clients";
import { Sidebar, type ActiveKey } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { CmdK } from "@/components/layout/CmdK";
import { RatingPopup } from "@/components/layout/RatingPopup";
import { UpdateCredentialsModal } from "@/components/login/UpdateCredentialsModal";

function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function AppFrame({
  clientId,
  active,
  pageLabel,
  children,
}: {
  clientId: string;
  active: ActiveKey;
  pageLabel: string;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [pendingMonthRef, setPendingMonthRef] = useState<string | null>(null);
  const [mustResetCredentials, setMustResetCredentials] = useState(false);
  const client = CLIENTS.find((c) => c.id === clientId);

  // ponytail: checa uma vez por carregamento se a conta é temporária — sem realtime, se o
  // admin mudar a flag no meio da sessão o cliente só vê o popup no próximo load.
  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { mustResetCredentials: boolean } | null) => {
        if (data?.mustResetCredentials) setMustResetCredentials(true);
      })
      .catch(() => {});
  }, [clientId]);

  const dismissedKey = `rating-dismissed-${clientId}`;
  const dismissCountKey = `rating-dismiss-count-${clientId}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(dismissedKey) === todayKey()) return;

    fetch(`/api/ratings/${clientId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { show: boolean; monthRef: string | null } | null) => {
        if (data?.show && data.monthRef) setPendingMonthRef(data.monthRef);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  function handleDismiss() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(dismissedKey, todayKey());
      const count = Number(window.localStorage.getItem(dismissCountKey) ?? "0");
      window.localStorage.setItem(dismissCountKey, String(count + 1));
    }
    setPendingMonthRef(null);
  }

  function handleSubmitted() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(dismissCountKey);
    }
    setPendingMonthRef(null);
  }

  const dismissCount = typeof window !== "undefined" ? Number(window.localStorage.getItem(dismissCountKey) ?? "0") : 0;

  return (
    <div className="flex min-h-full items-start">
      <div className={`flex min-h-full flex-1 items-start ${mustResetCredentials ? "pointer-events-none blur-sm" : ""}`}>
        <Sidebar clientId={clientId} active={active} pageLabel={pageLabel} collapsed={collapsed} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header
            clientName={client?.name ?? clientId}
            pageLabel={pageLabel}
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed((c) => !c)}
          />
          <div className="min-w-0">{children}</div>
        </div>
      </div>
      <CmdK clientId={clientId} />
      {mustResetCredentials && <UpdateCredentialsModal onDone={() => setMustResetCredentials(false)} />}
      {pendingMonthRef && (
        <RatingPopup
          clientId={clientId}
          monthRef={pendingMonthRef}
          dismissCount={dismissCount}
          onClose={handleDismiss}
          onSubmitted={handleSubmitted}
        />
      )}
    </div>
  );
}
