import Link from "next/link";
import type { ReactNode } from "react";

// Título + pestañas de COMERCIAL (Clientes / Leads) + un espacio a la derecha para botones.
export function EncabezadoComercial({ activa, derecha, verVendedores = true }: { activa: "clientes" | "leads" | "vendedores"; derecha?: ReactNode; verVendedores?: boolean }) {
  const pest = (k: "clientes" | "leads" | "vendedores", href: string, texto: string) => (
    <Link href={href} className={`rounded-md px-4 py-1.5 text-sm font-semibold uppercase tracking-wide ${activa === k ? "bg-stone-800 text-white" : "border border-stone-300 bg-white text-stone-600 hover:border-stone-500"}`}>{texto}</Link>
  );
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Comercial</h1>
        <div className="flex gap-2">{pest("clientes", "/comercial", "Clientes")}{pest("leads", "/comercial/leads", "Leads")}{verVendedores && pest("vendedores", "/comercial/vendedores", "Vendedores")}</div>
      </div>
      <div className="flex items-center gap-2">{derecha}</div>
    </div>
  );
}
