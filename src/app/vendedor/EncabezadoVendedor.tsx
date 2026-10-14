import type { ReactNode } from "react";
import { PestanasSeccion } from "@/components/PestanasSeccion";

export type PestañaVendedor = "estadisticas" | "pedidos" | "clientes";

const ITEMS: { id: PestañaVendedor; texto: string; href: string }[] = [
  { id: "estadisticas", texto: "Estadísticas", href: "/vendedor" },
  { id: "pedidos", texto: "Pedidos", href: "/vendedor/pedidos" },
  { id: "clientes", texto: "Clientes", href: "/vendedor/clientes" },
];

// Título "Mi hoja" (con botones a la derecha) y las solapas del vendedor, iguales a las del resto del sistema.
export function EncabezadoVendedor({ activa, derecha }: { activa: PestañaVendedor; derecha?: ReactNode; titulo?: string }) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Mi hoja</h1>
        <div className="flex flex-wrap items-center gap-2">{derecha}</div>
      </div>
      <PestanasSeccion items={ITEMS} activa={activa} etiqueta="Vendedor" />
    </>
  );
}
