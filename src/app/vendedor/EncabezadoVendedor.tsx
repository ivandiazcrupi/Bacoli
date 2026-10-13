import Link from "next/link";
import type { ReactNode } from "react";

export function EncabezadoVendedor({ activa, titulo, derecha }: { activa: "pedidos" | "clientes"; titulo?: string; derecha?: ReactNode }) {
  const pest = (k: string, href: string, texto: string) => (
    <Link href={href} className={`rounded-md px-4 py-1.5 text-sm font-semibold uppercase tracking-wide ${activa === k ? "bg-stone-800 text-white" : "border border-stone-300 bg-white text-stone-600 hover:border-stone-500"}`}>{texto}</Link>
  );
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-bold tracking-tight">{titulo ?? "Mis pedidos"}</h1>
        <div className="flex gap-2">{pest("pedidos", "/vendedor", "Mis pedidos")}{pest("clientes", "/vendedor/clientes", "Mis clientes")}</div>
      </div>
      <div className="flex items-center gap-2">{derecha}</div>
    </div>
  );
}
