"use client";

import { useState } from "react";
import { CLIENTS } from "@/lib/clients";
import { Sidebar, type ActiveKey } from "./Sidebar";
import { Header } from "./Header";
import { CmdK } from "./CmdK";

export function AppFrame({
  clientId,
  accessKey,
  active,
  pageLabel,
  children,
}: {
  clientId: string;
  accessKey: string;
  active: ActiveKey;
  pageLabel: string;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const client = CLIENTS.find((c) => c.id === clientId);

  return (
    <div className="flex min-h-full">
      <Sidebar clientId={clientId} accessKey={accessKey} active={active} collapsed={collapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          clientName={client?.name ?? clientId}
          pageLabel={pageLabel}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
        />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      <CmdK clientId={clientId} accessKey={accessKey} />
    </div>
  );
}
