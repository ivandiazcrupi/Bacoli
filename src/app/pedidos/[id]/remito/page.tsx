import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { deFecha, hoy } from "@/lib/fechas";
import { exigirOficina } from "@/lib/session";
import { BarraImpresion } from "../../remito/BarraImpresion";
import { RemitoDoc } from "../../remito/RemitoDoc";

export default async function RemitoPedido({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ precios?: string }> }) {
  await exigirOficina();
  const { id } = await params;
  const { precios } = await searchParams;
  const [pedido, empresa] = await Promise.all([
    db.pedido.findUnique({ where: { id }, include: { cliente: true, punto: true, items: { include: { producto: true }, orderBy: { producto: { orden: "asc" } } } } }),
    db.empresa.findUnique({ where: { id: "principal" } }),
  ]);
  if (!pedido) notFound();

  if (pedido.remitoNumero === null) {
    return (
      <main className="mx-auto max-w-xl space-y-3 px-4 py-10">
        <p>Este pedido todavía no tiene remito. Volvé al pedido y tocá “Remito” para emitirlo.</p>
        <Link href={`/pedidos/${id}`} className="underline">← Volver al pedido</Link>
      </main>
    );
  }
  const conPrecios = precios === "1";
  return (
    <div className="bg-stone-200 print:bg-white">
      <style>{"@page { size: A4; margin: 0 }"}</style>
      <BarraImpresion volver={`/pedidos/${id}`} textoVolver="Volver al pedido" conPrecios={conPrecios} enlacePrecios={`/pedidos/${id}/remito${conPrecios ? "" : "?precios=1"}`} />
      <div className="py-6 print:py-0">
        <RemitoDoc
          empresa={empresa}
          conPrecios={conPrecios}
          r={{
            numero: pedido.remitoNumero,
            fecha: pedido.fechaEntrega ? deFecha(pedido.fechaEntrega) : hoy(),
            conFactura: pedido.conFactura,
            numeroFactura: pedido.numeroFactura,
            nota: pedido.nota,
            cliente: { nombre: pedido.cliente.nombre, razonSocial: pedido.cliente.razonSocial, cuit: pedido.cliente.cuit },
            sucursal: { alias: pedido.punto.alias, direccion: pedido.punto.direccion, barrio: pedido.punto.barrio, telefono: pedido.punto.telefono },
            items: pedido.items.map((i) => ({ sku: i.sku, descripcion: i.producto.descripcion ?? i.nombre, cantidad: i.cantidad, unidad: i.unidad, precioUnitario: Number(i.precioUnitario) })),
          }}
        />
      </div>
    </div>
  );
}
