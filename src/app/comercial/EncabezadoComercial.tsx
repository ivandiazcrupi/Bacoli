import type { ReactNode } from "react";
import { PestanasSeccion } from "@/components/PestanasSeccion";
import { vendedoresDesbloqueado as esGerente } from "@/lib/claveVendedores";

export type PestañaComercial = "clientes" | "leads" | "vendedores" | "estadisticas" | "tienda";

const ITEMS: { id: PestañaComercial; texto: string; href: string }[] = [
  { id: "clientes", texto: "Clientes", href: "/comercial" },
  { id: "leads", texto: "Leads", href: "/comercial/leads" },
  { id: "vendedores", texto: "Vendedores", href: "/comercial/vendedores" },
  { id: "estadisticas", texto: "Estadísticas", href: "/comercial/estadisticas" },
  { id: "tienda", texto: "Tienda online", href: "/comercial/tienda" },
];

// Título de COMERCIAL (con botones a la derecha) y debajo las solapas, iguales a las de Pedidos y Cuenta corriente.
export async function EncabezadoComercial({ activa, derecha, titulo = "Comercial" }: { activa: PestañaComercial; derecha?: ReactNode; titulo?: string; verVendedores?: boolean }) {
  // Vendedores, Estadísticas y Tienda online son solo para gerentes: el resto ni ve esas solapas.
  const gerente = await esGerente();
  const items = gerente ? ITEMS : ITEMS.filter((i) => i.id === "clientes" || i.id === "leads");
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
        <div className="flex flex-wrap items-center gap-2">{derecha}</div>
      </div>
      <PestanasSeccion items={items} activa={activa} etiqueta="Comercial" />
    </>
  );
}
