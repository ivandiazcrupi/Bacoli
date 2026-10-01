import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { exigirOficina } from "@/lib/session";
import { CONTENEDOR_PEDIDOS } from "../Encabezado";
import { NuevoPedido } from "../NuevoPedido";

export default async function NuevoPedidoPagina() {
  const usuario = await exigirOficina();
  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pedido nuevo</h1>
            <p className="mt-1 text-sm text-stone-600">Se carga sin día y queda en la lista de Pedidos. Después se le asigna el día.</p>
          </div>
          <Link href="/pedidos" className="rounded-md border border-stone-400 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-crema-100">← Pedidos</Link>
        </div>
        <NuevoPedido esDueno={usuario.rol === "DUENO"} />
      </main>
    </>
  );
}
