import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { exigirOficina } from "@/lib/session";
import { CONTENEDOR_PEDIDOS } from "../Encabezado";
import { NuevoPedido } from "../NuevoPedido";
import { NuevoPedidoWeb } from "../NuevoPedidoWeb";
import { FormularioCobranza } from "../FormularioCobranza";
import { crearCobranza } from "../actions";
import { BotonVolver } from "@/components/BotonVolver";

export default async function NuevoPedidoPagina({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const usuario = await exigirOficina();
  const tipo = (await searchParams).tipo;
  const minorista = tipo === "minorista";
  const cobranza = tipo === "cobranza";
  const productos = minorista ? await db.producto.findMany({ where: { activo: true }, orderBy: { orden: "asc" }, select: { id: true, nombre: true, sku: true, unidad: true } }) : [];
  const pastilla = "rounded-md px-5 py-2.5 text-sm font-semibold";
  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pedido nuevo</h1>
            <p className="mt-1 text-sm text-stone-600">Se carga sin día y queda en la lista de Pedidos. Después se le asigna el día.</p>
          </div>
          <BotonVolver fallback="/pedidos" />
        </div>
        <div className="flex gap-2" role="group" aria-label="Tipo de pedido">
          <Link href="/pedidos/nuevo" className={`${pastilla} ${!minorista && !cobranza ? "bg-stone-800 text-white" : "border border-stone-400 bg-white text-stone-700 hover:bg-crema-100"}`}>Mayorista</Link>
          <Link href="/pedidos/nuevo?tipo=minorista" className={`${pastilla} ${minorista ? "bg-stone-800 text-white" : "border border-stone-400 bg-white text-stone-700 hover:bg-crema-100"}`}>Minorista (tienda)</Link>
          <Link href="/pedidos/nuevo?tipo=cobranza" className={`${pastilla} ${cobranza ? "bg-stone-800 text-white" : "border border-stone-400 bg-white text-stone-700 hover:bg-crema-100"}`}>Cobranza</Link>
        </div>
        {cobranza ? <FormularioCobranza accion={crearCobranza} textoBoton="Cargar cobranza" limpiarAlGuardar /> : minorista ? <NuevoPedidoWeb productos={productos} /> : <NuevoPedido esDueno={usuario.rol === "DUENO"} />}
      </main>
    </>
  );
}
