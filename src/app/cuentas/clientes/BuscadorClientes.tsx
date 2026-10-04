"use client";

import { useRouter } from "next/navigation";
import { FiltroLista } from "../FiltroLista";

// Buscador de la pestaña Clientes: el mismo desplegable con texto que usan Facturas y Remitos.
export function BuscadorClientes({ q, opciones }: { q: string; opciones: string[] }) {
  const router = useRouter();
  return (
    <div className="w-72">
      <FiltroLista titulo="Cliente" opciones={opciones} valor={q} vacio="Todos los clientes" aceptaLibre clase="!h-9 !text-sm"
        onCambio={(v) => router.push(v ? `/cuentas/clientes?q=${encodeURIComponent(v)}` : "/cuentas/clientes")} />
    </div>
  );
}
