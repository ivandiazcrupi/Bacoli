import { webPagado, textoPagoWeb } from "@/lib/webpago";
import { BotonConfirmarPago } from "./BotonConfirmarPago";
import { oracion, titulo } from "@/lib/mayusculas";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecera } from "@/components/Cabecera";
import { desgloseIva, importeVigente } from "@/lib/cuenta";
import { db } from "@/lib/db";
import { estadoDelDia } from "@/lib/dias";
import { deFecha, diaMes, nombreDia } from "@/lib/fechas";
import { formatoPesos } from "@/lib/numeros";
import { enlaceWhatsApp } from "@/lib/telefonos";
import { exigirOficina } from "@/lib/session";
import { cancelarPedido, reabrirPedido } from "../actions";
import { formatoRemito } from "@/lib/remito";
import { BotonRemito } from "../BotonRemito";
import { NumeroFactura } from "../NumeroFactura";
import { BotonNoEntregado } from "./BotonNoEntregado";
import { CONTENEDOR_PEDIDOS } from "../Encabezado";
import { datosEntrega, ordenarItems } from "../filas";
import { BotonConAviso, TablaPedido } from "./Acciones";
import { BotonVolver } from "@/components/BotonVolver";
import { FormularioCobranza } from "../FormularioCobranza";
import { actualizarCobranza } from "../actions";

const ETIQUETA = { PENDIENTE: "Pendiente", ENTREGADO: "Entregado", NO_ENTREGADO: "No entregado", CANCELADO: "Cancelado" } as const;
const COLOR = { PENDIENTE: "text-stone-700", ENTREGADO: "text-verde-700", NO_ENTREGADO: "text-rojo-700", CANCELADO: "text-stone-500" } as const;

export default async function DetallePedido({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirOficina();
  const { id } = await params;
  const pedido = await db.pedido.findUnique({
    where: { id },
    include: { cliente: true, punto: { include: { zona: true } }, items: { include: { producto: { select: { orden: true } } } }, ncAplicaciones: { where: { nota: { anuladaEn: null } } } },
  });
  if (!pedido) notFound();

  // Cobranza: una parada para cobrar plata (sin productos ni cuenta corriente). Se ve y se edita en una pantalla simple.
  if (pedido.origen === "COBRANZA") {
    const cobrada = pedido.estado === "ENTREGADO";
    return (
      <>
        <Cabecera usuario={usuario} />
        <main className={CONTENEDOR_PEDIDOS}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Cobranza · {pedido.webNombre}</h1>
              <p className="mt-1 text-sm text-stone-600">
                {pedido.estado === "CANCELADO" ? "Cancelada." : cobrada ? `Cobrada${pedido.medioCobro ? ` (${pedido.medioCobro === "EFECTIVO" ? "efectivo" : pedido.medioCobro === "TRANSFERENCIA" ? "transferencia" : "otro medio"})` : ""}. Se marca desde la hoja de ruta.` : pedido.fechaEntrega ? `Está en la hoja de ruta del ${nombreDia(deFecha(pedido.fechaEntrega)).toLowerCase()} ${diaMes(deFecha(pedido.fechaEntrega))}.` : "Esperando día. Asignale un día y una camioneta desde Pedidos."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {pedido.estado === "PENDIENTE" && (
                <form action={cancelarPedido}>
                  <input type="hidden" name="id" value={pedido.id} />
                  <BotonConAviso texto="Cancelar cobranza" aviso="¿Cancelar esta cobranza? Se saca de la hoja de ruta." clase="h-10 whitespace-nowrap rounded-md border border-rojo-600 bg-white px-4 text-sm font-semibold text-rojo-700 shadow-sm hover:bg-rojo-50" />
                </form>
              )}
              <BotonVolver fallback="/pedidos?lista=cobranza" />
            </div>
          </div>
          {pedido.estado === "CANCELADO" || cobrada ? null : (
            <FormularioCobranza
              accion={actualizarCobranza.bind(null, pedido.id)}
              textoBoton="Guardar cambios"
              inicial={{ nombre: pedido.webNombre ?? "", barrio: pedido.webBarrio ?? "", direccion: titulo(pedido.webDireccion), telefono: pedido.webTelefono ?? "", monto: String(pedido.cobrarMonto ?? "").replace(".", ","), nota: pedido.nota ?? "" }}
            />
          )}
        </main>
      </>
    );
  }

  const web = !pedido.clienteId;
  const entrega = datosEntrega(pedido);
  const items = ordenarItems(pedido.items);
  const ivaPct = Number(pedido.ivaPct);
  const pedidoBase = web ? Number(pedido.webTotal ?? 0) : pedido.items.reduce((s, i) => s + i.cantidad * Number(i.precioUnitario) * (1 - Number(i.descuentoPct) / 100), 0);
  const pedidoBruto = web ? pedidoBase : pedido.items.reduce((s, i) => s + i.cantidad * Number(i.precioUnitario), 0);
  const total = importeVigente(pedido.items, ivaPct, pedido.estado === "ENTREGADO" ? "ENTREGADO" : "PENDIENTE", pedido.webTotal);
  const fecha = pedido.fechaEntrega ? deFecha(pedido.fechaEntrega) : null;
  const abierto = pedido.estado === "PENDIENTE";
  // Entregado / no entregado solo se marcan con la ruta ya lista (salió); los comprobantes cargados a mano no pasan por la ruta.
  const rutaSalio = pedido.manual || (pedido.fechaEntrega ? (await estadoDelDia(pedido.fechaEntrega)).estado !== "ARMANDO" : false);
  const motivoApagado = !pedido.fechaEntrega ? "Asignale un día y un vehículo, y dejá lista la hoja de ruta, para marcar la entrega." : "Dejá lista la hoja de ruta de ese día para marcar la entrega.";
  const btn = "flex h-10 w-full items-center gap-2 whitespace-nowrap rounded-md border px-3 text-sm font-semibold";
  const fechaLarga = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
  const cargado = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" }).format(pedido.creadoEn);
  const horaCarga = pedido.creadoEn.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" });
  const wa = enlaceWhatsApp(entrega.telefono);
  const direccion = web ? [entrega.direccion, entrega.barrio].filter(Boolean).join(" · ") : [titulo(pedido.punto?.direccion), pedido.punto?.barrio, pedido.punto?.zona.nombre].filter(Boolean).join(" · ");
  const pastilla = { PENDIENTE: "bg-[#fdf8e3] text-[#8a6a05]", ENTREGADO: "bg-verde-50 text-verde-700", NO_ENTREGADO: "bg-rojo-50 text-rojo-700", CANCELADO: "bg-rojo-50 text-rojo-700" } as const;
  const celda = (etiqueta: string, valor: React.ReactNode, detalle?: React.ReactNode) => (
    <div className="min-w-0 px-5 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">{etiqueta}</p>
      <div className="mt-1 text-[17px] font-bold leading-tight text-stone-900">{valor}</div>
      {detalle && <div className="mt-0.5 text-[12.5px] font-normal text-stone-500">{detalle}</div>}
    </div>
  );
  const cobroTexto = pedido.estado !== "ENTREGADO" ? <span className="text-[15px] font-semibold text-stone-400">Sin entregar</span>
    : pedido.cobro === "COBRADO" ? <span className="text-verde-700">Pagado{pedido.medioCobro ? ` · ${pedido.medioCobro === "EFECTIVO" ? "Efectivo" : pedido.medioCobro === "TRANSFERENCIA" ? "Transferencia" : pedido.medioCobro === "MERCADO_PAGO" ? "Mercado Pago" : pedido.medioCobro === "CHEQUE" ? "Cheque" : "Otro"}` : ""}</span>
    : pedido.cobro === "CUENTA_CORRIENTE" ? <span className="text-sky-700">En cuenta corriente</span> : <span className="text-rojo-700">Sin cobrar</span>;

  // Acciones del costado (formularios aparte del de la entrega).
  const lateral = (
    <section className="rounded-xl border border-stone-300 bg-white p-4 shadow-sm" aria-label="Acciones del pedido">
      <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">Acciones</h2>
      <div className="space-y-2">
        {!web && !pedido.conFactura && pedido.estado !== "CANCELADO" && (
          <BotonRemito pedidoId={pedido.id} numero={pedido.remitoNumero ? `Imprimir remito ${formatoRemito(pedido.remitoNumero)}` : null} textoSinNumero="Emitir remito" clase={`${btn} border-stone-400 bg-white text-stone-800 hover:bg-crema-100`} />
        )}
        {(abierto || pedido.estado === "NO_ENTREGADO") && <Link href={`/pedidos/${pedido.id}/editar`} className={`${btn} border-stone-400 bg-white text-stone-800 hover:bg-crema-100`}>✎ Editar pedido</Link>}
        {abierto && fecha && rutaSalio && <BotonNoEntregado pedidoId={pedido.id} clase={`${btn} border-stone-400 bg-white text-rojo-700 hover:bg-rojo-50`} />}
        {!abierto && (
          <form action={reabrirPedido}>
            <input type="hidden" name="id" value={pedido.id} />
            <BotonConAviso texto="↺ Reabrir pedido" aviso="¿Volver el pedido a pendiente?" clase={`${btn} border-stone-400 bg-white text-stone-800 hover:bg-crema-100`} />
          </form>
        )}
        {pedido.estado !== "CANCELADO" && (
          <div className="border-t border-stone-200 pt-2">
            {pedido.clienteId && pedido.conFactura && pedido.numeroFactura?.trim() && pedido.ncAplicaciones.reduce((t, a) => t + Number(a.monto), 0) < total - 0.01 ? (
              <Link href={`/cuentas/${pedido.clienteId}/nc?factura=${pedido.id}`} title="Una factura emitida no se cancela: se anula con una nota de crédito" className={`${btn} border-rojo-600 bg-white text-rojo-700 hover:bg-rojo-50`}>Anular con nota de crédito</Link>
            ) : !web && pedido.estado === "ENTREGADO" && pedido.cobro === "COBRADO" ? (
              <>
                <button type="button" disabled className={`${btn} cursor-not-allowed border-stone-300 bg-white text-stone-400`}>Cancelar pedido</button>
                <p className="mt-1 text-[12px] text-stone-500">Para cancelarlo primero hay que deshacer el cobro.</p>
              </>
            ) : (
              <form action={cancelarPedido}>
                <input type="hidden" name="id" value={pedido.id} />
                <BotonConAviso texto="Cancelar pedido" aviso="¿Cancelar este pedido? Deja de sumar a la cuenta del cliente. Si tiene remito, el remito queda como ANULADO." clase={`${btn} border-rojo-600 bg-white text-rojo-700 hover:bg-rojo-50`} />
              </form>
            )}
          </div>
        )}
      </div>
    </section>
  );

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        {/* Encabezado: quién, dónde y en qué estado está */}
        <section className="overflow-hidden rounded-xl border border-stone-300 bg-white shadow-sm" aria-label="Datos del pedido">
          <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight">{entrega.nombre}</h1>
                <span className={`inline-flex h-7 items-center rounded-full px-3 text-[13px] font-bold ${pastilla[pedido.estado]}`}>{ETIQUETA[pedido.estado]}</span>
                <span className="inline-flex h-7 items-center rounded-full border border-stone-300 bg-crema-100 px-3 text-[12px] font-bold uppercase tracking-wide text-stone-600">{web ? "Tienda online" : pedido.conFactura ? "Con factura" : "Con remito"}</span>
              </div>
              <p className="mt-1.5 text-[14px] text-stone-700">{direccion}</p>
              {entrega.telefono && <p className="mt-0.5 text-[13.5px] text-stone-600">Tel. {wa ? <a href={wa} target="_blank" rel="noreferrer" className="font-semibold text-verde-800 hover:underline">{entrega.telefono} · WhatsApp</a> : entrega.telefono}</p>}
            </div>
            <BotonVolver fallback={fecha ? `/pedidos/dia/${fecha}` : "/pedidos"} />
          </div>
          <div className={`grid grid-cols-2 divide-x divide-y divide-stone-200 border-t border-stone-300 sm:divide-y-0 ${web ? "sm:grid-cols-4" : "sm:grid-cols-4"}`}>
            {celda("Fecha de carga", fechaLarga(cargado), `${horaCarga} hs`)}
            {celda("Fecha de entrega", fecha ? fechaLarga(fecha) : <span className="text-stone-400">Sin día</span>, fecha ? nombreDia(fecha) : "todavía sin asignar")}
            {web ? celda("Pedido de la tienda", <>N° {pedido.webOrden}</>, Number(pedido.webExtra ?? 0) > 0 ? `Incluye ${formatoPesos(Number(pedido.webExtra))} agregado por fuera` : undefined) : celda(
              pedido.conFactura ? "N° de factura" : "N° de remito",
              pedido.conFactura
                ? <NumeroFactura pedidoId={pedido.id} inicial={pedido.numeroFactura ?? ""} bloqueado={pedido.estado === "CANCELADO"} />
                : (pedido.remitoNumero ? formatoRemito(pedido.remitoNumero) : <span className="text-rojo-700">Sin emitir</span>),
            )}
            {web ? celda("Pago", <div className="[&>span]:items-start"><BotonConfirmarPago
              pedidoId={pedido.id}
              nombre={entrega.nombre}
              monto={formatoPesos(Number(pedido.webTotal ?? 0))}
              pagado={webPagado(pedido.webOrden, pedido.webPago)}
              medio={textoPagoWeb(pedido.webPago)}
              detalle={pedido.webPagoPor && pedido.webPagoEn ? `Confirmó ${pedido.webPagoPor} · ${pedido.webPagoEn.toLocaleString("es-AR", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" })}` : null}
              puedeCambiar={pedido.estado === "PENDIENTE" && pedido.webPago !== "PAGO_MP"}
            /></div>) : celda("Cobro", cobroTexto)}
          </div>
        </section>

        <TablaPedido
          pedidoId={pedido.id}
          abierto={abierto}
          entregado={pedido.estado === "ENTREGADO"}
          items={items.map((i) => ({ id: i.id, nombre: i.nombre, sku: i.sku, unidad: i.unidad, precio: Number(i.precioUnitario), cantidad: i.cantidad, entregada: i.cantidadEntregada, sinCargo: i.sinCargo, motivoSinCargo: i.motivoSinCargo, descuentoPct: Number(i.descuentoPct) }))}
          totales={{ tasas: web || pedido.webTotal !== null ? [] : desgloseIva(pedido.items, ivaPct, pedido.estado === "ENTREGADO" ? "ENTREGADO" : "PENDIENTE").tasas.map((t) => ({ tasa: t.tasa, iva: t.iva })).filter((t) => t.tasa > 0), bruto: pedidoBruto, descuento: pedidoBruto - pedidoBase, base: pedidoBase, iva: total - pedidoBase, ivaPct, total, conFactura: pedido.conFactura, sinCargoPaquetes: pedido.items.reduce((t, i) => t + i.sinCargo, 0), sinCargoValor: pedido.items.reduce((t, i) => t + i.sinCargo * Number(i.precioUnitario), 0) }}
          web={web}
          pagoMp={webPagado(pedido.webOrden, pedido.webPago)}
          pagoTexto={textoPagoWeb(pedido.webPago)}
          sinPagoWeb={web && !webPagado(pedido.webOrden, pedido.webPago)}
          nota={oracion(pedido.nota)}
          lateral={lateral}
          rutaSalio={rutaSalio}
          motivoApagado={motivoApagado}
        />
      </main>
    </>
  );
}
