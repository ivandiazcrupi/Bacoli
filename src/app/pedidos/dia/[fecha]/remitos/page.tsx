import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { aFecha, esFechaValida } from "@/lib/fechas";
import { porReparto } from "@/lib/ruta";
import { exigirOficina } from "@/lib/session";
import { BarraImpresion } from "../../../remito/BarraImpresion";
import { RemitoDoc } from "../../../remito/RemitoDoc";

// Todos los remitos del día, uno por hoja, en el orden del reparto.
export default async function RemitosDelDia({ params, searchParams }: { params: Promise<{ fecha: string }>; searchParams: Promise<{ precios?: string }> }) {
  await exigirOficina();
  const { fecha } = await params;
  const { precios } = await searchParams;
  if (!esFechaValida(fecha)) notFound();
  const [pedidos, empresa] = await Promise.all([
    db.pedido.findMany({
      where: { fechaEntrega: aFecha(fecha), estado: { not: "CANCELADO" }, remitoNumero: { not: null } },
      include: { cliente: true, punto: true, salida: true, items: { include: { producto: true }, orderBy: { producto: { orden: "asc" } } } },
    }),
    db.empresa.findUnique({ where: { id: "principal" } }),
  ]);
  pedidos.sort(porReparto);
  const conPrecios = precios === "1";
  return (
    <div className="bg-stone-200 print:bg-white">
      <style>{"@page { size: A4; margin: 0 }"}</style>
      <BarraImpresion volver={`/pedidos/dia/${fecha}`} textoVolver="Volver a la hoja del día" conPrecios={conPrecios} enlacePrecios={`/pedidos/dia/${fecha}/remitos${conPrecios ? "" : "?precios=1"}`} />
      {pedidos.length === 0 ? (
        <p className="p-10">No hay remitos emitidos para este día.</p>
      ) : (
        <div className="space-y-6 py-6 print:space-y-0 print:py-0">
          {pedidos.map((p) => (
            <div key={p.id} className="[&:not(:last-child)]:break-after-page">
              <RemitoDoc
                empresa={empresa}
                conPrecios={conPrecios}
                r={{
                  numero: p.remitoNumero!,
                  fecha,
                  conFactura: p.conFactura,
                  numeroFactura: p.numeroFactura,
                  nota: p.nota,
                  cliente: { nombre: p.cliente.nombre, razonSocial: p.cliente.razonSocial, cuit: p.cliente.cuit },
                  sucursal: { alias: p.punto.alias, direccion: p.punto.direccion, barrio: p.punto.barrio, telefono: p.punto.telefono },
                  items: p.items.map((i) => ({ sku: i.sku, descripcion: i.producto.descripcion ?? i.nombre, cantidad: i.cantidad, unidad: i.unidad, precioUnitario: Number(i.precioUnitario) })),
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
