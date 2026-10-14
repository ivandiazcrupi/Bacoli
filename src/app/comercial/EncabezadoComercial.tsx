import Link from "next/link";
import type { ReactNode } from "react";

export type PestañaComercial = "clientes" | "leads" | "vendedores" | "estadisticas";

const PESTAÑAS: { k: PestañaComercial; href: string; texto: string }[] = [
  { k: "clientes", href: "/comercial", texto: "Clientes" },
  { k: "leads", href: "/comercial/leads", texto: "Leads" },
  { k: "vendedores", href: "/comercial/vendedores", texto: "Vendedores" },
  { k: "estadisticas", href: "/comercial/estadisticas", texto: "Estadísticas" },
];

// Título de COMERCIAL (con botones a la derecha) y debajo el submenú: cuatro solapas con una línea que cruza la hoja.
export function EncabezadoComercial({ activa, derecha, titulo = "Comercial" }: { activa: PestañaComercial; derecha?: ReactNode; titulo?: string; verVendedores?: boolean }) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
        <div className="flex flex-wrap items-center gap-2">{derecha}</div>
      </div>
      <nav aria-label="Secciones de Comercial" className="flex gap-1 overflow-x-auto border-b border-stone-300">
        {PESTAÑAS.map((p) => (
          <Link
            key={p.k}
            href={p.href}
            aria-current={activa === p.k ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-[3px] px-5 py-2.5 text-sm font-bold uppercase tracking-wide ${activa === p.k ? "border-stone-800 text-stone-900" : "border-transparent text-stone-500 hover:border-[#c6c2b7] hover:text-stone-800"}`}
          >
            {p.texto}
          </Link>
        ))}
      </nav>
    </div>
  );
}
