"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type ChartType = "line" | "bar";

export function TrendChart({
  data,
  metricLabel,
}: {
  data: { date: string; value: number }[];
  metricLabel: string;
}) {
  const [type, setType] = useState<ChartType>("line");

  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-card-foreground">{metricLabel} ao longo do período</h3>
        <div className="flex gap-1 rounded-md border border-border p-0.5">
          {(["line", "bar"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`rounded px-2 py-1 text-xs ${
                type === t ? "bg-brand-primary text-white" : "text-muted-foreground"
              }`}
            >
              {t === "line" ? "Linha" : "Barras"}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        {type === "line" ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" fontSize={12} stroke="hsl(var(--muted-foreground))" />
            <YAxis fontSize={12} stroke="hsl(var(--muted-foreground))" />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="hsl(var(--brand-primary))" strokeWidth={2} dot={false} />
          </LineChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" fontSize={12} stroke="hsl(var(--muted-foreground))" />
            <YAxis fontSize={12} stroke="hsl(var(--muted-foreground))" />
            <Tooltip />
            <Bar dataKey="value" fill="hsl(var(--brand-primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
