import type { MedioPago, Prisma } from "@prisma/client";
import { importeVigente } from "@/lib/cuenta";

const redondear2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Cómo se cobra un pedido al entregarlo: un pago (efectivo o transferencia) o a cuenta corriente. */
export type CobroAlEntregar = { tipo: "PAGO"; medio: "EFECTIVO" | "TRANSFERENCIA" } | { tipo: "CC" };

export function leerCobro(texto: string | null | undefined): CobroAlEntregar | null {
  if (texto === "EFECTIVO" || texto === "TRANSFERENCIA") return { tipo: "PAGO", medio: texto };
  if (texto === "CC") return { tipo: "CC" };
  return null;
}

/**
 * Deja el cobro marcado dentro de una transacción (el pedido ya tiene que estar entregado):
 * pago = movimiento de pago en la cuenta y comprobante pagado; cuenta corriente = queda pendiente.
 * Los pedidos de la tienda ya pagados con Mercado Pago se cobran solos.
 */
export async function marcarCobroEnTx(tx: Prisma.TransactionClient, pedidoId: string, cobro: CobroAlEntregar | null, usuarioId: string): Promise<string | null> {
  const pedido = await tx.pedido.findUniqueOrThrow({ where: { id: pedidoId }, include: { items: true, ncAplicaciones: { where: { nota: { anuladaEn: null } } } } });
  if (pedido.webPago === "PAGO_MP") {
    await tx.pedido.update({ where: { id: pedidoId }, data: { cobro: "COBRADO", medioCobro: "MERCADO_PAGO", montoCobrado: pedido.webTotal, pagado: true } });
    return null;
  }
  if (!cobro) return "Elegí cómo se cobra: Pago o Cuenta corriente.";
  if (cobro.tipo === "CC") {
    if (!pedido.clienteId) return "Los pedidos de la tienda online no tienen cuenta corriente: elegí cómo se pagó.";
    await tx.pedido.update({ where: { id: pedidoId }, data: { cobro: "CUENTA_CORRIENTE", medioCobro: null, montoCobrado: null, pagado: false } });
    return null;
  }
  const debido = redondear2(importeVigente(pedido.items, Number(pedido.ivaPct), "ENTREGADO", pedido.webTotal) - pedido.ncAplicaciones.reduce((t, a) => t + Number(a.monto), 0));
  if (debido <= 0) {
    // Cubierto por una nota de crédito: no hay nada que cobrar, queda a cuenta sin deuda.
    await tx.pedido.update({ where: { id: pedidoId }, data: { cobro: "CUENTA_CORRIENTE", medioCobro: null, montoCobrado: null, pagado: false } });
    return null;
  }
  await tx.pedido.update({ where: { id: pedidoId }, data: { cobro: "COBRADO", medioCobro: cobro.medio as MedioPago, montoCobrado: debido, pagado: true } });
  if (pedido.clienteId) {
    await tx.movimientoCuenta.create({ data: { clienteId: pedido.clienteId, pedidoId, tipo: "PAGO", monto: -debido, medio: cobro.medio as MedioPago, nota: "Cobro del pedido", usuarioId } });
  }
  return null;
}
