import { webPagado, textoPagoWeb } from "@/lib/webpago";
import { BotonConfirmarPago } from "./BotonConfirmarPago";
import { oracion, titulo } from "@/lib/mayusculas";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecera } from "@/components/Cabecera";
import { importeVigente } from "@/lib/cuenta";
import { db } from "@/lib/db";
import { deFecha, diaMes, nombreDia } from "@/lib/fechas";
import { formatoPesos } from "@/lib/numeros";
import { exigirOficina } from "@/lib/session";
import { cancelarPedido, reabrirPedido } from "../actions";
import { formatoRemito } from "@/lib/remito";
import { BotonRemito } from "../BotonRemito";
import { NumeroFactura } from "../NumeroFactura";
import { BotonNoEntregado } from "./BotonNoEntregado";
import { CONTENEDOR_PEDIDOS } from "../Encabezado";
import { datosEntrega, ordenarItems } from "../filas";
import { BotonConAviso, TablaPedido } from "./Acciones";

const ETIQUETA = { PENDIENTE: "Pendiente", ENTREGADO: "Entregado", NO_ENTREGADO: "No entregado", CANCELADO: "Cancelado" } as const;
const COLOR = { PENDIENTE: "text-stone-700", ENTREGADO: "text-verde-700", NO_ENTREGADO: "text-rojo-700", CANCELADO: "text-stone-500" } as const;

export default async function DetallePedido({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirOficina();
  const { id } = await params;
  const pedido = await db.pedido.findUnique({
    where: { id },
    include: { cliente: true, punto: { include: { zona: true } }, items: { include: { producto: { select: { orden: true } } } } },
  });
  if (!pedido) notFound();

  const web = !pedido.clienteId;
  const entrega = datosEntrega(pedido);
  const items = ordenarItems(pedido.items);
  const ivaPct = Number(pedido.ivaPct);
  const pedidoBase = web ? Number(pedido.webTotal ?? 0) : pedido.items.reduce((s, i) => s + i.cantidad * Number(i.precioUnitario) * (1 - Number(i.descuentoPct) / 100), 0);
  const pedidoBruto = web ? pedidoBase : pedido.items.reduce((s, i) => s + i.cantidad * Number(i.precioUnitario), 0);
  const total = importeVigente(pedido.items, ivaPct, pedido.estado === "ENTREGADO" ? "ENTREGADO" : "PENDIENTE", pedido.webTotal);
  const fecha = pedido.fechaEntrega ? deFecha(pedido.fechaEntrega) : null;
  const abierto = pedido.estado === "PENDIENTE";
  const btn = "h-10 whitespace-nowrap rounded-md border px-4 text-sm font-semibold shadow-sm";
  const celda = (titulo: string, valor: React.ReactNode) => (
    <div className="min-w-0">
      <p className="border-b border-stone-300 bg-crema-100 px-3 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-stone-600">{titulo}</p>
      <p className="px-3 py-2.5 text-center text-base font-semibold">{valor}</p>
    </div>
  );

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{entrega.nombre}</h1>
            <p className="mt-1 text-sm text-stone-600">
              {web ? [entrega.barrio, entrega.direccion, entrega.telefono].filter(Boolean).join(" · ") : `${[pedido.punto?.alias, titulo(pedido.punto?.direccion), pedido.punto?.barrio].filter(Boolean).join(" · ")} · ${pedido.punto?.zona.nombre}`}
            </p>
          </div>
          <Link href={fecha ? `/pedidos/dia/${fecha}` : "/pedidos"} className="rounded-md border border-stone-400 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-crema-100">← {fecha ? "Hoja de ruta" : "Pedidos"}</Link>
        </div>

        <section aria-label="Datos del pedido" className={`grid grid-cols-2 divide-x divide-stone-300 overflow-hidden rounded-xl border border-stone-300 bg-white shadow-sm sm:grid-cols-4`}>
          {celda("Estado", <span className={COLOR[pedido.estado]}>{ETIQUETA[pedido.estado]}</span>)}
          {celda("Día", fecha ? `${nombreDia(fecha)} ${diaMes(fecha)}` : "Sin día")}
          {web && celda("Pedido de la tienda", `N° ${pedido.webOrden}`)}
          {web && celda("Pago", <BotonConfirmarPago
            pedidoId={pedido.id}
            nombre={entrega.nombre}
            monto={formatoPesos(Number(pedido.webTotal ?? 0))}
            pagado={webPagado(pedido.webOrden, pedido.webPago)}
            medio={textoPagoWeb(pedido.webPago)}
            detalle={pedido.webPagoPor && pedido.webPagoEn ? `Confirmó ${pedido.webPagoPor} · ${pedido.webPagoEn.toLocaleString("es-AR", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" })}` : null}
            puedeCambiar={pedido.estado === "PENDIENTE" && pedido.webPago !== "PAGO_MP"}
          />)}
          {!web && celda("Comprobante", pedido.conFactura ? "Factura" : "Remito")}
          {!web && celda(
            pedido.conFactura ? "N° de factura" : "N° de remito",
            pedido.conFactura
              ? <NumeroFactura pedidoId={pedido.id} inicial={pedido.numeroFactura ?? ""} bloqueado={pedido.estado === "CANCELADO"} />
              : (pedido.remitoNumero ? formatoRemito(pedido.remitoNumero) : <span className="text-rojo-700">Sin emitir</span>),
          )}
        </section>

        {/* Barra de acciones: a la izquierda lo que se hace con la entrega, a la derecha editar o cancelar. */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-300 bg-white px-4 py-3 shadow-sm" role="toolbar" aria-label="Acciones del pedido">
          <div className="flex flex-wrap items-center gap-2">
            {abierto && <button type="submit" form="form-entrega" className={`${btn} border-verde-700 bg-verde-700 text-white hover:bg-verde-800`}>✓ Confirmar entrega</button>}
            {!web && !pedido.conFactura && pedido.estado !== "CANCELADO" && (
              <BotonRemito pedidoId={pedido.id} numero={pedido.remitoNumero ? `Imprimir remito ${formatoRemito(pedido.remitoNumero)}` : null} textoSinNumero="Emitir remito" clase={`${btn} border-stone-400 bg-white text-stone-800 hover:bg-crema-100`} />
            )}
            {abierto && fecha && <BotonNoEntregado pedidoId={pedido.id} clase={`${btn} border-stone-400 bg-white text-rojo-700 hover:bg-rojo-50`} />}
            {!abierto && (
              <form action={reabrirPedido}>
                <input type="hidden" name="id" value={pedido.id} />
                <BotonConAviso texto="↺ Reabrir pedido" aviso="¿Volver el pedido a pendiente?" clase={`${btn} border-stone-400 bg-white text-stone-800 hover:bg-crema-100`} />
              </form>
            )}
          </div>
          {pedido.estado !== "CANCELADO" && (
            <div className="flex flex-wrap items-center gap-2">
              {(abierto || pedido.estado === "NO_ENTREGADO") && <Link href={`/pedidos/${pedido.id}/editar`} className={`${btn} inline-flex items-center border-stone-400 bg-white text-stone-800 hover:bg-crema-100`}>✎ Editar pedido</Link>}
              {!web && pedido.estado === "ENTREGADO" && pedido.cobro === "COBRADO" ? (
                <button type="button" disabled title="Primero deshacé el cobro (en la hoja de ruta o en CUENTA)" className={`${btn} cursor-not-allowed border-stone-300 bg-white text-stone-400`}>Cancelar pedido</button>
              ) : (
                <form action={cancelarPedido}>
                  <input type="hidden" name="id" value={pedido.id} />
                  <BotonConAviso texto="Cancelar pedido" aviso="¿Cancelar este pedido? Deja de sumar a la cuenta del cliente. Si tiene remito, el remito queda como ANULADO." clase={`${btn} border-rojo-600 bg-white text-rojo-700 hover:bg-rojo-50`} />
                </form>
              )}
            </div>
          )}
        </div>

        {!web && pedido.estado === "ENTREGADO" && pedido.cobro === "COBRADO" && <p className="text-right text-xs text-stone-600">Para cancelarlo primero hay que deshacer el cobro.</p>}

        <TablaPedido
          pedidoId={pedido.id}
          abierto={abierto}
          entregado={pedido.estado === "ENTREGADO"}
          items={items.map((i) => ({ id: i.id, nombre: i.nombre, sku: i.sku, unidad: i.unidad, precio: Number(i.precioUnitario), cantidad: i.cantidad, entregada: i.cantidadEntregada, sinCargo: i.sinCargo, motivoSinCargo: i.motivoSinCargo, descuentoPct: Number(i.descuentoPct) }))}
          totales={{ bruto: pedidoBruto, descuento: pedidoBruto - pedidoBase, base: pedidoBase, iva: total - pedidoBase, ivaPct, total, conFactura: pedido.conFactura, sinCargoPaquetes: pedido.items.reduce((t, i) => t + i.sinCargo, 0), sinCargoValor: pedido.items.reduce((t, i) => t + i.sinCargo * Number(i.precioUnitario), 0) }}
          web={web}
          pagoMp={webPagado(pedido.webOrden, pedido.webPago)}
          pagoTexto={textoPagoWeb(pedido.webPago)}
          sinPagoWeb={web && !webPagado(pedido.webOrden, pedido.webPago)}
          nota={oracion(pedido.nota)}
        />
      </main>
    </>
  );
}
