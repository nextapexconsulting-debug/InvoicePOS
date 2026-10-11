"use client";

import Link from "next/link";
import { useAccess, logout } from "./AuthGate";

export default function NavLinks() {
  const a = useAccess();
  const owner = a.role === "owner";
  const links: [string, string][] = a.role === "super_admin"
    ? [["/admin", "Admin"]]
    : [
        ["/", "POS"],
        ["/orders", "Orders"],
        ...(owner
          ? ([["/dashboard", "Today / Profit"], ["/stock", "Stock"], ["/reports", "Reports"], ["/staff", "Staff"], ["/billing", "Billing"]] as [string, string][])
          : []),
        ["/menu", "Menu"],
      ];
  return (
    <details className="relative">
      <summary className="list-none cursor-pointer text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg select-none">
        ☰ Menu
      </summary>
      <div className="absolute right-0 mt-2 w-44 bg-slate-800 border border-slate-600 rounded-xl shadow-xl z-30 overflow-hidden">
        {links.map(([href, label]) => (
          <Link key={href} href={href} className="block px-4 py-2.5 text-sm hover:bg-slate-700">{label}</Link>
        ))}
        <div className="px-4 py-2 text-[11px] text-slate-500 border-t border-slate-700 truncate">{a.shop_name || a.email}</div>
        <button onClick={logout} className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-slate-700 border-t border-slate-700">
          Log out
        </button>
      </div>
    </details>
  );
}
