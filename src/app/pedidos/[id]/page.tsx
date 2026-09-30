import { titulo } from "@/lib/mayusculas";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecera } from "@/components/Cabecera";
import { importeVigente } from "@/lib/cuenta";
import { db } from "@/lib/db";
import { deFecha, diaMes, nombreDia } from "@/lib/fechas";
import { formatoPesos } from "@/lib/numeros";
import { exigirOficina } from "@/lib/session";
import { cancelarPedido, marcarNoEntregado, reabrirPedido } from "../actions";
import { formatoRemito } from "@/lib/remito";
import { BotonRemito } from "../BotonRemito";
import { BotonConAviso, FormularioEntrega } from "./Acciones";

const ETIQUETA = { PENDIENTE: "Pendiente", ENTREGADO: "Entregado", NO_ENTREGADO: "No entregado", CANCELADO: "Cancelado" } as const;
const COLOR = { PENDIENTE: "text-stone-700", ENTREGADO: "text-verde-700", NO_ENTREGADO: "text-rojo-700", CANCELADO: "text-stone-500" } as const;
const formatoFecha = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" });

export default async function DetallePedido({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirOficina();
  const { id } = await params;
  const pedido = await db.pedido.findUnique({
    where: { id },
    include: { cliente: true, punto: { include: { zona: true } }, items: { orderBy: { producto: { orden: "asc" } } }, movimientos: { orderBy: { fecha: "asc" } } },
  });
  if (!pedido) notFound();

  const ivaPct = Number(pedido.ivaPct);
  const pedidoBase = pedido.items.reduce((s, i) => s + i.cantidad * Number(i.precioUnitario), 0);
  const total = importeVigente(pedido.items, ivaPct, pedido.estado === "ENTREGADO" ? "ENTREGADO" : "PENDIENTE");
  const fecha = pedido.fechaEntrega ? deFecha(pedido.fechaEntrega) : null;
  const abierto = pedido.estado === "PENDIENTE";

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto max-w-xl space-y-5 px-4 py-6">
        <div>
          <Link href="/pedidos" className="text-sm text-stone-600">← Pedidos</Link>
          <h1 className="text-2xl font-bold">{pedido.cliente.nombre}</h1>
          <p className="text-stone-600">{[pedido.punto.alias, titulo(pedido.punto.direccion), pedido.punto.barrio].filter(Boolean).join(" · ")} · {pedido.punto.zona.nombre}</p>
          <p className="mt-1 text-sm">
            <span className={`font-semibold ${COLOR[pedido.estado]}`}>{ETIQUETA[pedido.estado]}</span>
            <span className="text-stone-600"> · {fecha ? `${nombreDia(fecha)} ${diaMes(fecha)}` : "Sin asignar"} · {pedido.conFactura ? "con factura" : "con remito"}</span>
          </p>
          <p className="text-sm text-stone-600">
            {pedido.conFactura ? <>Factura: {pedido.numeroFactura ? <b>{pedido.numeroFactura}</b> : <span className="text-rojo-700">sin número todavía</span>}</> : null}
            {pedido.conFactura && pedido.remitoNumero ? " · " : ""}
            {pedido.remitoNumero ? <>Remito: <b>{formatoRemito(pedido.remitoNumero)}</b></> : !pedido.conFactura ? <span className="text-rojo-700">Remito sin emitir</span> : null}
          </p>
        </div>

        <section className="rounded-lg border border-stone-200 bg-white p-4">
          <ul className="divide-y divide-stone-100">
            {pedido.items.map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="font-medium">{i.nombre}</p>
                  <p className="text-xs text-stone-500">{i.sku ?? ""} · {formatoPesos(Number(i.precioUnitario))} por {i.unidad}</p>
                </div>
                <div className="text-right tabular-nums">
                  <p>{i.cantidad}{pedido.estado === "ENTREGADO" && i.cantidadEntregada !== null && i.cantidadEntregada !== i.cantidad ? <span className="text-rojo-700"> → {i.cantidadEntregada}</span> : ""}</p>
                  <p className="text-xs text-stone-500">{formatoPesos((pedido.estado === "ENTREGADO" ? (i.cantidadEntregada ?? i.cantidad) : i.cantidad) * Number(i.precioUnitario))}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-2 space-y-1 border-t border-stone-200 pt-3 text-sm">
            {pedido.conFactura && <div className="flex justify-between"><span className="text-stone-600">Subtotal</span><span className="tabular-nums">{formatoPesos(pedidoBase)}</span></div>}
            {pedido.conFactura && <div className="flex justify-between"><span className="text-stone-600">IVA {ivaPct}%</span><span className="tabular-nums">{formatoPesos(total - pedidoBase)}</span></div>}
            <div className="flex justify-between text-lg font-semibold"><span>Total</span><span className="tabular-nums">{formatoPesos(total)}</span></div>
          </div>
          {pedido.nota && <p className="mt-3 text-sm text-stone-600">Nota: {pedido.nota}</p>}
        </section>

        {abierto && <FormularioEntrega pedidoId={pedido.id} items={pedido.items.map((i) => ({ id: i.id, nombre: i.nombre, unidad: i.unidad, cantidad: i.cantidad, entregada: i.cantidadEntregada }))} />}

        <div className="grid grid-cols-2 gap-2">
          {pedido.estado !== "CANCELADO" && (
            <div className="col-span-2">
              <BotonRemito pedidoId={pedido.id} numero={pedido.remitoNumero ? `Remito ${formatoRemito(pedido.remitoNumero)} · imprimir` : null} clase="w-full rounded-lg border border-stone-800 bg-white px-3 py-3 font-semibold" />
            </div>
          )}
          {abierto && <Link href={`/pedidos/${pedido.id}/editar`} className="rounded-lg border border-stone-300 bg-white px-3 py-3 text-center font-medium">Editar pedido</Link>}
          {abierto && (
            <form action={marcarNoEntregado}>
              <input type="hidden" name="id" value={pedido.id} />
              <BotonConAviso texto="No entregado" aviso="¿Marcar como NO entregado? El pedido deja de sumar a la cuenta del cliente." clase="w-full rounded-lg border border-rojo-600 bg-white px-3 py-3 font-medium text-rojo-700" />
            </form>
          )}
          {!abierto && (
            <form action={reabrirPedido} className="col-span-2">
              <input type="hidden" name="id" value={pedido.id} />
              <BotonConAviso texto="Reabrir pedido" aviso="¿Volver el pedido a pendiente?" clase="w-full rounded-lg border border-stone-300 bg-white px-3 py-3 font-medium" />
            </form>
          )}
          {pedido.estado !== "CANCELADO" && (
            <form action={cancelarPedido} className="col-span-2">
              <input type="hidden" name="id" value={pedido.id} />
              <BotonConAviso texto="Cancelar pedido" aviso="¿Cancelar este pedido? Deja de sumar a la cuenta del cliente." clase="w-full rounded-lg px-3 py-3 text-sm font-medium text-rojo-700 underline" />
            </form>
          )}
        </div>

        <section className="space-y-2">
          <h2 className="font-semibold">Cuenta corriente</h2>
          <p className="text-sm text-stone-600">Lo que este pedido suma a la deuda del cliente. Se actualiza solo cuando se carga, se modifica, se entrega o se cancela.</p>
          <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white text-sm">
            {pedido.movimientos.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 p-3">
                <span><span className="block">{m.nota}</span><span className="block text-xs text-stone-500">{formatoFecha.format(m.fecha)}</span></span>
                <span className={`tabular-nums font-medium ${Number(m.monto) < 0 ? "text-verde-700" : ""}`}>{Number(m.monto) > 0 ? "+" : ""}{formatoPesos(Number(m.monto))}</span>
              </li>
            ))}
            {pedido.movimientos.length === 0 && <li className="p-3 text-stone-500">Sin movimientos.</li>}
          </ul>
        </section>
      </main>
    </>
  );
}
