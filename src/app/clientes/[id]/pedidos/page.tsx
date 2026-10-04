import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecera } from "@/components/Cabecera";
import { importeVigente } from "@/lib/cuenta";
import { db } from "@/lib/db";
import { deFecha } from "@/lib/fechas";
import { titulo } from "@/lib/mayusculas";
import { formatoRemito } from "@/lib/remito";
import { exigirOficina } from "@/lib/session";
import { BotonVolver } from "@/components/BotonVolver";
import { formatoPesos } from "@/lib/numeros";
import { Resumen } from "@/app/cuentas/estilo";
import { TablaPedidos } from "./TablaPedidos";

// Historial de pedidos de un cliente: el más reciente primero. Tocar un pedido lo abre.
export default async function PedidosDelCliente({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirOficina();
  const { id } = await params;
  const cliente = await db.cliente.findUnique({ where: { id } });
  if (!cliente) notFound();

  const pedidos = await db.pedido.findMany({
    where: { clienteId: id },
    include: { items: true, punto: true },
    orderBy: [{ creadoEn: "desc" }],
  });

  const vigentes = pedidos.filter((p) => p.estado === "PENDIENTE" || p.estado === "ENTREGADO");
  const sinPagar = pedidos.filter((p) => p.estado === "ENTREGADO" && !p.pagado).reduce((t, p) => t + importeVigente(p.items, Number(p.ivaPct), "PENDIENTE"), 0);

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-6 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-bold">Pedidos de {cliente.nombre}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/cuentas/${id}`} className="rounded-md border border-stone-400 bg-white px-3.5 py-2 text-sm font-semibold text-stone-800 shadow-sm hover:bg-crema-100">Cuenta corriente</Link>
            <BotonVolver fallback={`/clientes/${id}`} />
          </div>
        </div>

        {pedidos.length > 0 && (
          <Resumen datos={[
            { titulo: "Pedidos", valor: pedidos.length },
            { titulo: "Monto total", valor: formatoPesos(vigentes.reduce((t, p) => t + importeVigente(p.items, Number(p.ivaPct), "PENDIENTE"), 0)) },
            { titulo: "Entregado sin pagar", valor: formatoPesos(sinPagar), rojo: sinPagar > 0 },
          ]} />
        )}

        {pedidos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 p-4 text-stone-600">Este cliente todavía no tiene pedidos.</p>
        ) : (
          <TablaPedidos
            filas={pedidos.map((p) => ({
              id: p.id,
              cargado: new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" }).format(p.creadoEn),
              entrega: p.fechaEntrega ? deFecha(p.fechaEntrega) : null,
              sucursal: p.punto ? `${p.punto.barrio} · ${titulo(p.punto.direccion)}` : "—",
              pedido: p.items.map((i) => `${i.cantidad} ${i.nombre}`).join(" · "),
              monto: importeVigente(p.items, Number(p.ivaPct), "PENDIENTE"), // lo pedido, con IVA si lleva factura
              comprobante: p.conFactura ? (p.numeroFactura ?? "") : p.remitoNumero ? formatoRemito(p.remitoNumero) : "",
              comprobanteFalta: p.conFactura ? "Factura sin número" : "Remito sin emitir",
              estado: p.estado,
              pagado: p.pagado,
              medio: p.medioCobro,
              aCuenta: p.cobro === "CUENTA_CORRIENTE",
            }))}
          />
        )}
      </main>
    </>
  );
}
