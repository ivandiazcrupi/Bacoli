import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { exigirOficina } from "@/lib/session";
import { NuevoPedido } from "../NuevoPedido";

export default async function NuevoPedidoPagina() {
  const usuario = await exigirOficina();
  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto max-w-xl space-y-4 px-4 py-6">
        <div>
          <Link href="/pedidos" className="text-sm text-stone-600">← Pedidos</Link>
          <h1 className="text-2xl font-bold">Nuevo pedido</h1>
          <p className="text-sm text-stone-600">Se carga sin fecha y queda en “Sin asignar”. Después lo arrastras a su día.</p>
        </div>
        <NuevoPedido esDueno={usuario.rol === "DUENO"} />
      </main>
    </>
  );
}
