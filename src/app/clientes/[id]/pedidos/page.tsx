import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecera } from "@/components/Cabecera";
import { cabeceraTabla } from "@/components/campos";
import { importeVigente } from "@/lib/cuenta";
import { db } from "@/lib/db";
import { deFecha, diaMes, nombreDia } from "@/lib/fechas";
import { titulo } from "@/lib/mayusculas";
import { formatoPesos } from "@/lib/numeros";
import { formatoRemito } from "@/lib/remito";
import { exigirOficina } from "@/lib/session";

const ESTADO = {
  PENDIENTE: { texto: "Pendiente", clase: "bg-crema-200 text-verde-900" },
  ENTREGADO: { texto: "Entregado", clase: "bg-verde-100 text-verde-800" },
  NO_ENTREGADO: { texto: "No entregado", clase: "bg-rojo-100 text-rojo-800" },
  CANCELADO: { texto: "Cancelado", clase: "bg-stone-200 text-stone-600" },
} as const;

// Historial de pedidos de un cliente: el más reciente primero. Tocar un pedido lo abre.
export default async function PedidosDelCliente({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirOficina();
  const { id } = await params;
  const cliente = await db.cliente.findUnique({ where: { id } });
  if (!cliente) notFound();

  const pedidos = await db.pedido.findMany({
    where: { clienteId: id },
    include: { items: true, punto: true },
    orderBy: [{ fechaEntrega: { sort: "desc", nulls: "first" } }, { creadoEn: "desc" }],
  });

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-6 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link href={`/clientes/${id}`} className="text-sm text-stone-600">← {cliente.nombre}</Link>
            <h1 className="text-2xl font-bold">Pedidos de {cliente.nombre}</h1>
            <p className="text-sm text-stone-600">{pedidos.length} {pedidos.length === 1 ? "pedido" : "pedidos"}</p>
          </div>
          <Link href={`/clientes/${id}/cuenta`} className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium">Cuenta corriente</Link>
        </div>

        {pedidos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 p-4 text-stone-600">Este cliente todavía no tiene pedidos.</p>
        ) : (
          <div className="space-y-2">
            <div className={`hidden grid-cols-[8rem_1.6fr_2.4fr_1fr_1fr_1fr] gap-3 rounded-t-xl px-4 py-3 lg:grid ${cabeceraTabla}`}>
              <span>Día</span><span>Sucursal</span><span>Pedido</span><span className="text-right">Monto</span><span>Comprobante</span><span>Estado</span>
            </div>
            {pedidos.map((p) => {
              const fecha = p.fechaEntrega ? deFecha(p.fechaEntrega) : null;
              const monto = importeVigente(p.items, Number(p.ivaPct), "PENDIENTE"); // lo pedido, con IVA si lleva factura
              const est = ESTADO[p.estado];
              return (
                <Link
                  key={p.id}
                  href={`/pedidos/${p.id}`}
                  className="grid items-center gap-x-3 gap-y-1 rounded-xl border border-stone-300 bg-white p-4 shadow-sm hover:border-verde-700 lg:grid-cols-[8rem_1.6fr_2.4fr_1fr_1fr_1fr]"
                >
                  <span className="text-sm font-medium">{fecha ? `${nombreDia(fecha)} ${diaMes(fecha)}` : <span className="text-stone-500">Sin asignar</span>}</span>
                  <span className="text-sm">{titulo(p.punto.direccion)} <span className="text-stone-500">· {p.punto.barrio}</span></span>
                  <span className="text-sm">{p.items.map((i) => `${i.cantidad} ${i.nombre}`).join(" · ")}</span>
                  <span className="text-sm font-semibold tabular-nums lg:text-right">{formatoPesos(monto)}</span>
                  <span className="text-sm">
                    {p.conFactura
                      ? (p.numeroFactura ? <>Factura <b>{p.numeroFactura}</b></> : <span className="text-rojo-700">Factura sin número</span>)
                      : (p.remitoNumero ? <>Remito <b>{formatoRemito(p.remitoNumero)}</b></> : <span className="text-stone-500">Remito sin emitir</span>)}
                  </span>
                  <span><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${est.clase}`}>{est.texto}</span></span>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
