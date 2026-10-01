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
import { LibroCuenta, columnasDeMovimiento } from "@/components/LibroCuenta";
import { datosEntrega, ordenarItems } from "../filas";
import { BotonConAviso, TablaPedido } from "./Acciones";

const ETIQUETA = { PENDIENTE: "Pendiente", ENTREGADO: "Entregado", NO_ENTREGADO: "No entregado", CANCELADO: "Cancelado" } as const;
const COLOR = { PENDIENTE: "text-stone-700", ENTREGADO: "text-verde-700", NO_ENTREGADO: "text-rojo-700", CANCELADO: "text-stone-500" } as const;
const MEDIO: Record<string, string> = { EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia", CHEQUE: "Cheque", MERCADO_PAGO: "Mercado Pago", OTRO: "Otro" };
const formatoFecha = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" });

export default async function DetallePedido({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirOficina();
  const { id } = await params;
  const pedido = await db.pedido.findUnique({
    where: { id },
    include: { cliente: true, punto: { include: { zona: true } }, items: { include: { producto: { select: { orden: true } } } }, movimientos: { orderBy: { fecha: "asc" } } },
  });
  if (!pedido) notFound();

  const web = !pedido.clienteId;
  const entrega = datosEntrega(pedido);
  const items = ordenarItems(pedido.items);
  const ivaPct = Number(pedido.ivaPct);
  const pedidoBase = web ? Number(pedido.webTotal ?? 0) : pedido.items.reduce((s, i) => s + i.cantidad * Number(i.precioUnitario), 0);
  const total = importeVigente(pedido.items, ivaPct, pedido.estado === "ENTREGADO" ? "ENTREGADO" : "PENDIENTE", pedido.webTotal);
  const fecha = pedido.fechaEntrega ? deFecha(pedido.fechaEntrega) : null;
  const abierto = pedido.estado === "PENDIENTE";
  const boton = "h-9 rounded-md border border-stone-400 bg-white px-3 text-sm font-medium shadow-sm hover:bg-crema-100";
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

        <section aria-label="Datos del pedido" className={`grid grid-cols-2 divide-x divide-stone-300 overflow-hidden rounded-xl border border-stone-300 bg-white shadow-sm ${web ? "sm:grid-cols-5" : "sm:grid-cols-4"}`}>
          {celda("Estado", <span className={COLOR[pedido.estado]}>{ETIQUETA[pedido.estado]}</span>)}
          {celda("Día", fecha ? `${nombreDia(fecha)} ${diaMes(fecha)}` : "Sin día")}
          {web && celda("Pedido de la tienda", `N° ${pedido.webOrden}`)}
          {web && celda("Pago", pedido.webPago === "PAGO_MP" ? "Mercado Pago" : <span className="text-rojo-700">Pendiente</span>)}
          {!web && celda("Comprobante", pedido.conFactura ? "Factura" : "Remito")}
          {celda(
            pedido.conFactura ? "N° de factura" : "N° de remito",
            pedido.conFactura
              ? (pedido.numeroFactura ? pedido.numeroFactura : <span className="text-rojo-700">Sin cargar</span>)
              : (pedido.remitoNumero ? formatoRemito(pedido.remitoNumero) : <span className="text-rojo-700">Sin emitir</span>),
          )}
        </section>

        {pedido.estado !== "CANCELADO" ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <BotonRemito pedidoId={pedido.id} numero={pedido.remitoNumero ? `Imprimir remito ${formatoRemito(pedido.remitoNumero)}` : null} textoSinNumero="Emitir remito" clase={boton} />
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
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {abierto && <Link href={`/pedidos/${pedido.id}/editar`} className={`${boton} inline-flex items-center`}>Editar pedido</Link>}
              <form action={cancelarPedido}>
                <input type="hidden" name="id" value={pedido.id} />
                <BotonConAviso texto="Cancelar pedido" aviso="¿Cancelar este pedido? Deja de sumar a la cuenta del cliente." clase={`${boton} text-rojo-700`} />
              </form>
            </div>
          </div>
        ) : (
          <form action={reabrirPedido}>
            <input type="hidden" name="id" value={pedido.id} />
            <BotonConAviso texto="Reabrir pedido" aviso="¿Volver el pedido a pendiente?" clase={boton} />
          </form>
        )}

        <TablaPedido
          pedidoId={pedido.id}
          abierto={abierto}
          entregado={pedido.estado === "ENTREGADO"}
          items={items.map((i) => ({ id: i.id, nombre: i.nombre, sku: i.sku, unidad: i.unidad, precio: Number(i.precioUnitario), cantidad: i.cantidad, entregada: i.cantidadEntregada }))}
          totales={{ base: pedidoBase, iva: total - pedidoBase, ivaPct, total, conFactura: pedido.conFactura }}
          web={web}
          nota={pedido.nota}
        />

        {!web && (
        <section className="space-y-2">
            <h2 className="text-center text-xs font-semibold uppercase tracking-wide text-stone-600">Cuenta corriente de este pedido</h2>
            <LibroCuenta
              vacio="Sin movimientos."
              lineas={pedido.movimientos.map((m) => ({
                id: m.id,
                fecha: formatoFecha.format(m.fecha),
                detalle: <span className="font-medium">{m.nota}{m.medio ? ` · ${MEDIO[m.medio]}` : ""}</span>,
                ...columnasDeMovimiento(m.tipo, Number(m.monto)),
              }))}
            />
          </section>
        )}
      </main>
    </>
  );
}
