"use client";

import { ReactNode } from "react";
import AuthGate from "./AuthGate";
import NavLinks from "./NavLinks";

export const card = "bg-slate-800 border border-slate-700 rounded-xl p-3";
export const input = "bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-emerald-500";
export const btn = "bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 font-semibold text-sm px-4 py-2 rounded-lg transition-colors";
export const btn2 = "bg-slate-700 hover:bg-slate-600 text-sm px-3 py-1.5 rounded-lg";

export default function PageShell({ title, roles, children }: { title: string; roles?: string[]; children: ReactNode }) {
  return (
    <AuthGate roles={roles}>
      <div className="min-h-screen bg-slate-900 text-slate-100">
        <header className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
          <h1 className="text-lg font-bold">{title}</h1>
          <NavLinks />
        </header>
        <main className="max-w-5xl mx-auto p-3 space-y-3">{children}</main>
      </div>
    </AuthGate>
  );
}

/** Sortable-free simple table. numeric columns get a totals row when `totals` is set. */
export function Table({
  cols, rows, totals,
}: {
  cols: { key: string; label: string; money?: boolean; num?: boolean }[];
  rows: Record<string, any>[];
  totals?: boolean;
}) {
  const fmt = (c: { money?: boolean; num?: boolean }, v: any) =>
    v === null || v === undefined || v === "" ? "—" :
    c.money ? "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 }) :
    c.num ? Number(v).toLocaleString("en-IN") : String(v);
  if (!rows.length) return <p className="text-slate-500 text-sm text-center py-6">No data for this period</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-slate-400 text-xs border-b border-slate-700">
            {cols.map((c) => <th key={c.key} className={`py-2 px-2 font-medium ${c.money || c.num ? "text-right" : "text-left"}`}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-800">
              {cols.map((c) => (
                <td key={c.key} className={`py-2 px-2 whitespace-nowrap ${c.money || c.num ? "text-right tabular-nums" : ""}`}>{fmt(c, r[c.key])}</td>
              ))}
            </tr>
          ))}
          {totals && (
            <tr className="font-semibold bg-slate-900/60">
              {cols.map((c, i) => (
                <td key={c.key} className={`py-2 px-2 ${c.money || c.num ? "text-right tabular-nums" : ""}`}>
                  {i === 0 ? "Total" : c.money || c.num ? fmt(c, rows.reduce((s, r) => s + Number(r[c.key] || 0), 0)) : ""}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
