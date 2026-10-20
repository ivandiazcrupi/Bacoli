import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { exigirVendedor, vendedorDeUsuario } from "@/lib/session";
import { datosNuevoPedido } from "../../pedidos/actions";
import { BandaTotales } from "../BandaTotales";
import { PedidoMovil } from "../PedidoMovil";

// El vendedor carga un pedido a uno de SUS clientes (pensado para el celular). Entra directo a Pedidos: la oficina le asigna el día.
export default async function CargarPedidoVendedor({ searchParams }: { searchParams: Promise<{ punto?: string }> }) {
  const usuario = await exigirVendedor();
  const vendedor = await vendedorDeUsuario(usuario.id);
  const { punto } = await searchParams;
  const inicial = punto ? await datosNuevoPedido(punto) : null; // viene de "cargar cliente": ya queda elegido
  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto w-full max-w-xl space-y-4 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Cargar pedido</h1>
          <Link href="/vendedor" className="text-sm font-semibold text-stone-500 underline decoration-stone-300 underline-offset-4">Salir</Link>
        </div>
        <BandaTotales vendedor={vendedor} />
        <PedidoMovil inicial={inicial} comisionPct={Number(vendedor?.comisionPct ?? 0)} />
      </main>
    </>
  );
}
