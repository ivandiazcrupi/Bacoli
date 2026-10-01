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
import { CONTENEDOR_PEDIDOS } from "../Encabezado";
import { BotonConAviso, TablaPedido } from "./Acciones";

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
  const paquetes = pedido.items.reduce((s, i) => s + i.cantidad, 0);
  const boton = "h-9 rounded-md border border-stone-400 bg-white px-3 text-sm font-medium shadow-sm hover:bg-crema-100";
  const dato = (titulo: string, valor: React.ReactNode) => (
    <div className="text-center">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-600">{titulo}</p>
      <p className="text-sm font-semibold">{valor}</p>
    </div>
  );

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{pedido.cliente.nombre}</h1>
            <p className="mt-1 text-sm text-stone-600">{[pedido.punto.alias, titulo(pedido.punto.direccion), pedido.punto.barrio].filter(Boolean).join(" · ")} · {pedido.punto.zona.nombre}</p>
          </div>
          <Link href={fecha ? `/pedidos/dia/${fecha}` : "/pedidos"} className="rounded-md border border-stone-400 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-crema-100">← {fecha ? "Hoja de ruta" : "Pedidos"}</Link>
        </div>

        <section aria-label="Datos del pedido" className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-stone-300 bg-white px-5 py-3 shadow-sm sm:grid-cols-3 lg:grid-cols-5">
          {dato("Estado", <span className={COLOR[pedido.estado]}>{ETIQUETA[pedido.estado]}</span>)}
          {dato("Día", fecha ? `${nombreDia(fecha)} ${diaMes(fecha)}` : "Sin día")}
          {dato("Comprobante", pedido.conFactura ? "Con factura" : "Con remito")}
          {dato(
            pedido.conFactura ? "N° de factura" : "N° de remito",
            pedido.conFactura
              ? (pedido.numeroFactura ? pedido.numeroFactura : <span className="text-rojo-700">Sin número todavía</span>)
              : (pedido.remitoNumero ? formatoRemito(pedido.remitoNumero) : <span className="text-rojo-700">Sin emitir</span>),
          )}
          {dato("Paquetes", paquetes)}
        </section>

        {pedido.estado !== "CANCELADO" && (
          <div className="flex flex-wrap items-center gap-2">
            <BotonRemito pedidoId={pedido.id} numero={pedido.remitoNumero ? `Remito ${formatoRemito(pedido.remitoNumero)} · imprimir` : null} clase={boton} />
            {abierto && <Link href={`/pedidos/${pedido.id}/editar`} className={`${boton} inline-flex items-center`}>Editar pedido</Link>}
            {abierto && (
              <form action={marcarNoEntregado}>
                <input type="hidden" name="id" value={pedido.id} />
                <BotonConAviso texto="No entregado" aviso="¿Marcar como NO entregado? El pedido deja de sumar a la cuenta del cliente." clase={`${boton} text-rojo-700`} />
              </form>
            )}
            {!abierto && (
              <form action={reabrirPedido}>
                <input type="hidden" name="id" value={pedido.id} />
                <BotonConAviso texto="Reabrir pedido" aviso="¿Volver el pedido a pendiente?" clase={boton} />
              </form>
            )}
            <form action={cancelarPedido} className="ml-auto">
              <input type="hidden" name="id" value={pedido.id} />
              <BotonConAviso texto="Cancelar pedido" aviso="¿Cancelar este pedido? Deja de sumar a la cuenta del cliente." clase="text-sm font-medium text-rojo-700 underline" />
            </form>
          </div>
        )}
        {pedido.estado === "CANCELADO" && (
          <form action={reabrirPedido}>
            <input type="hidden" name="id" value={pedido.id} />
            <BotonConAviso texto="Reabrir pedido" aviso="¿Volver el pedido a pendiente?" clase={boton} />
          </form>
        )}

        <TablaPedido
          pedidoId={pedido.id}
          abierto={abierto}
          entregado={pedido.estado === "ENTREGADO"}
          items={pedido.items.map((i) => ({ id: i.id, nombre: i.nombre, sku: i.sku, unidad: i.unidad, precio: Number(i.precioUnitario), cantidad: i.cantidad, entregada: i.cantidadEntregada }))}
          totales={{ base: pedidoBase, iva: total - pedidoBase, ivaPct, total, conFactura: pedido.conFactura }}
          nota={pedido.nota}
        />

        <section className="space-y-2">
          <h2 className="text-center text-xs font-semibold uppercase tracking-wide text-stone-600">Cuenta corriente de este pedido</h2>
          <div className="overflow-hidden rounded-xl border border-stone-300 bg-white text-sm shadow-sm">
            {pedido.movimientos.map((m) => (
              <div key={m.id} className="grid grid-cols-[1fr_auto] items-center gap-3 border-t border-stone-300 px-5 py-2 first:border-t-0 sm:grid-cols-[10rem_1fr_9rem]">
                <span className="hidden text-center text-xs text-stone-500 sm:block">{formatoFecha.format(m.fecha)}</span>
                <span className="text-center">{m.nota}</span>
                <span className={`text-center font-semibold tabular-nums ${Number(m.monto) < 0 ? "text-verde-700" : ""}`}>{Number(m.monto) > 0 ? "+" : ""}{formatoPesos(Number(m.monto))}</span>
              </div>
            ))}
            {pedido.movimientos.length === 0 && <p className="p-3 text-center text-stone-500">Sin movimientos.</p>}
          </div>
        </section>
      </main>
    </>
  );
}
