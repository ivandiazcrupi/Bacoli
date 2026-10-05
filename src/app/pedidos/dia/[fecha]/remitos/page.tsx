import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { aFecha, esFechaValida } from "@/lib/fechas";
import { porReparto } from "@/lib/ruta";
import { exigirOficina } from "@/lib/session";
import { BarraImpresion } from "../../../remito/BarraImpresion";
import { datosRemito } from "../../../remito/datos";
import { RemitoDoc } from "../../../remito/RemitoDoc";

// Todos los remitos del día, uno por hoja, en el orden del reparto.
export default async function RemitosDelDia({ params }: { params: Promise<{ fecha: string }> }) {
  await exigirOficina();
  const { fecha } = await params;
  if (!esFechaValida(fecha)) notFound();
  const [pedidos, empresa] = await Promise.all([
    db.pedido.findMany({
      where: { fechaEntrega: aFecha(fecha), estado: { not: "CANCELADO" }, remitoNumero: { not: null }, webOrden: null, origen: { not: "COBRANZA" }, conFactura: false },
      include: { cliente: true, punto: true, salida: true, items: { include: { producto: true } } },
    }),
    db.empresa.findUnique({ where: { id: "principal" } }),
  ]);
  pedidos.sort(porReparto);
  return (
    <div className="bg-stone-200 print:bg-white">
      <style>{"@page { size: A4; margin: 0 }"}</style>
      <BarraImpresion volver={`/pedidos/dia/${fecha}`} textoVolver="Volver a la hoja del día" />
      {pedidos.length === 0 ? (
        <p className="p-10">No hay remitos emitidos para este día.</p>
      ) : (
        <div className="space-y-6 py-6 print:space-y-0 print:py-0">
          {pedidos.map((p) => (
            <div key={p.id} className="[&:not(:last-child)]:break-after-page">
              <RemitoDoc
                empresa={empresa}
                r={{
                  numero: p.remitoNumero!,
                  fecha,
                  conFactura: p.conFactura,
                  numeroFactura: p.numeroFactura,
                  nota: p.nota,
                  cliente: datosRemito(p).cliente,
                  sucursal: datosRemito(p).sucursal,
                  items: datosRemito(p).items,
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
