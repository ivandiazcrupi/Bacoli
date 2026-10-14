import type { ReactNode } from "react";
import { PestanasSeccion } from "@/components/PestanasSeccion";

export type PestañaComercial = "clientes" | "leads" | "vendedores" | "estadisticas";

const ITEMS: { id: PestañaComercial; texto: string; href: string }[] = [
  { id: "clientes", texto: "Clientes", href: "/comercial" },
  { id: "leads", texto: "Leads", href: "/comercial/leads" },
  { id: "vendedores", texto: "Vendedores", href: "/comercial/vendedores" },
  { id: "estadisticas", texto: "Estadísticas", href: "/comercial/estadisticas" },
];

// Título de COMERCIAL (con botones a la derecha) y debajo las solapas, iguales a las de Pedidos y Cuenta corriente.
export function EncabezadoComercial({ activa, derecha, titulo = "Comercial" }: { activa: PestañaComercial; derecha?: ReactNode; titulo?: string; verVendedores?: boolean }) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
        <div className="flex flex-wrap items-center gap-2">{derecha}</div>
      </div>
      <PestanasSeccion items={ITEMS} activa={activa} etiqueta="Comercial" />
    </>
  );
}
