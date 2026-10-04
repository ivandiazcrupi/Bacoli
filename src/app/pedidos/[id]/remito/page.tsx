import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { deFecha, hoy } from "@/lib/fechas";
import { exigirOficina } from "@/lib/session";
import { BarraImpresion } from "../../remito/BarraImpresion";
import { RemitoDoc } from "../../remito/RemitoDoc";
import { datosRemito } from "../../remito/datos";
import { BotonVolver } from "@/components/BotonVolver";

export default async function RemitoPedido({ params }: { params: Promise<{ id: string }> }) {
  await exigirOficina();
  const { id } = await params;
  const [pedido, empresa] = await Promise.all([
    db.pedido.findUnique({ where: { id }, include: { cliente: true, punto: true, items: { include: { producto: true } } } }),
    db.empresa.findUnique({ where: { id: "principal" } }),
  ]);
  if (!pedido || pedido.webOrden) notFound();

  if (pedido.remitoNumero === null) {
    return (
      <main className="mx-auto max-w-xl space-y-3 px-4 py-10">
        <p>Este pedido todavía no tiene remito. Volvé al pedido y tocá “Remito” para emitirlo.</p>
        <BotonVolver fallback={`/pedidos/${id}`} />
      </main>
    );
  }
  const datos = datosRemito(pedido);
  return (
    <div className="bg-stone-200 print:bg-white">
      <style>{"@page { size: A4; margin: 0 }"}</style>
      <BarraImpresion volver={`/pedidos/${id}`} textoVolver="Volver al pedido" />
      <div className="py-6 print:py-0">
        <RemitoDoc
          empresa={empresa}
          anulado={pedido.estado === "CANCELADO"}
          r={{
            numero: pedido.remitoNumero,
            fecha: pedido.fechaEntrega ? deFecha(pedido.fechaEntrega) : hoy(),
            conFactura: pedido.conFactura,
            numeroFactura: pedido.numeroFactura,
            nota: pedido.nota,
            cliente: datos.cliente,
            sucursal: datos.sucursal,
            items: datos.items,
          }}
        />
      </div>
    </div>
  );
}
