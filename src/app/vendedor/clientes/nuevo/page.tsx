import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { exigirVendedor } from "@/lib/session";
import { FormCliente } from "./FormCliente";

// El vendedor carga un cliente nuevo (si cierra uno, tiene que reponerlo). Queda como cliente suyo y sigue directo al pedido.
export default async function CargarClienteVendedor() {
  const usuario = await exigirVendedor();
  const zonas = await db.zona.findMany({ orderBy: { orden: "asc" }, select: { id: true, nombre: true } });
  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto w-full max-w-xl space-y-4 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Cargar cliente</h1>
          <Link href="/vendedor/clientes" className="text-sm font-semibold text-stone-500 underline decoration-stone-300 underline-offset-4">Salir</Link>
        </div>
        <FormCliente zonas={zonas} />
      </main>
    </>
  );
}
