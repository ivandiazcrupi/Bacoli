import type { EstadoPedido, Prisma } from "@prisma/client";

export const IVA_PCT = 10.5;

const redondear2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

type Renglon = { cantidad: number; cantidadEntregada: number | null; precioUnitario: Prisma.Decimal | number | string };

/** Lo que el pedido suma hoy a la deuda del cliente (con IVA si lleva factura). */
export function importeVigente(items: Renglon[], ivaPct: number, estado: EstadoPedido) {
  if (estado === "CANCELADO" || estado === "NO_ENTREGADO") return 0;
  const subtotal = items.reduce((suma, i) => {
    const unidades = estado === "ENTREGADO" ? (i.cantidadEntregada ?? i.cantidad) : i.cantidad;
    return suma + unidades * Number(i.precioUnitario);
  }, 0);
  return redondear2(subtotal * (1 + ivaPct / 100));
}

/**
 * Deja la cuenta corriente del cliente al día con el pedido: compara lo que el pedido debe sumar hoy con lo que ya sumó
 * y agrega UN movimiento con la diferencia. Se llama después de crear, editar, entregar o cancelar un pedido, así
 * ningún pedido puede quedar afuera de la cuenta. Los movimientos nunca se editan ni se borran.
 */
export async function sincronizarCuentaPedido(tx: Prisma.TransactionClient, pedidoId: string, usuarioId: string | null) {
  const pedido = await tx.pedido.findUniqueOrThrow({ where: { id: pedidoId }, include: { items: true } });
  const vigente = importeVigente(pedido.items, Number(pedido.ivaPct), pedido.estado);
  const previo = await tx.movimientoCuenta.aggregate({ where: { pedidoId }, _sum: { monto: true } });
  const yaSumado = redondear2(Number(previo._sum.monto ?? 0));
  const diferencia = redondear2(vigente - yaSumado);
  if (Math.abs(diferencia) < 0.005) return;

  const tipo = yaSumado === 0 && diferencia > 0 ? "CARGO_PEDIDO" : vigente === 0 ? "ANULACION_PEDIDO" : "AJUSTE_PEDIDO";
  const nota =
    tipo === "CARGO_PEDIDO" ? "Pedido cargado" :
    tipo === "ANULACION_PEDIDO" ? (pedido.estado === "NO_ENTREGADO" ? "Pedido no entregado" : "Pedido cancelado") :
    pedido.estado === "ENTREGADO" ? "Ajuste por lo entregado" : "Pedido modificado";
  await tx.movimientoCuenta.create({ data: { clienteId: pedido.clienteId, pedidoId, tipo, monto: diferencia, nota, usuarioId } });
}

export async function saldoCliente(tx: Prisma.TransactionClient, clienteId: string) {
  const r = await tx.movimientoCuenta.aggregate({ where: { clienteId }, _sum: { monto: true } });
  return redondear2(Number(r._sum.monto ?? 0));
}
