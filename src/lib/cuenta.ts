import type { EstadoPedido, Prisma } from "@prisma/client";

export const IVA_PCT = 10.5;

const redondear2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** El envío siempre va al 21% de IVA cuando el pedido lleva factura. */
export const IVA_ENVIO = 21;

type Renglon = { cantidad: number; cantidadEntregada: number | null; precioUnitario: Prisma.Decimal | number | string; descuentoPct?: Prisma.Decimal | number | string | null; ivaPct?: Prisma.Decimal | number | string | null };

/**
 * Importes de un pedido separados por tasa de IVA. `ivaPct` es el IVA del pedido: 0 = sin factura (sin IVA); mayor a 0 = con factura,
 * y cada renglón usa el suyo (`ivaPct` del renglón) o, si no tiene, el del pedido (pedidos de antes, que iban todos a la misma tasa).
 */
export function desgloseIva(items: Renglon[], ivaPct: number, estado: EstadoPedido) {
  const porTasa = new Map<number, number>();
  for (const i of items) {
    const unidades = estado === "ENTREGADO" ? (i.cantidadEntregada ?? i.cantidad) : i.cantidad;
    const base = unidades * Number(i.precioUnitario) * (1 - Number(i.descuentoPct ?? 0) / 100); // los paquetes sin cargo no suman
    const tasa = ivaPct > 0 ? (i.ivaPct != null ? Number(i.ivaPct) : ivaPct) : 0;
    porTasa.set(tasa, (porTasa.get(tasa) ?? 0) + base);
  }
  const tasas = [...porTasa.entries()].sort((a, b) => a[0] - b[0]).map(([tasa, base]) => ({ tasa, base: redondear2(base), iva: redondear2((base * tasa) / 100) }));
  const base = redondear2([...porTasa.values()].reduce((t, x) => t + x, 0));
  const total = redondear2([...porTasa.entries()].reduce((t, [tasa, b]) => t + b * (1 + tasa / 100), 0));
  return { base, total, iva: redondear2(total - base), tasas };
}

/** Lo que el pedido suma hoy a la deuda del cliente (con IVA si lleva factura, cada renglón a su tasa). */
export function importeVigente(items: Renglon[], ivaPct: number, estado: EstadoPedido, totalFijo?: Prisma.Decimal | number | string | null) {
  if (estado === "CANCELADO" || estado === "NO_ENTREGADO") return 0;
  if (totalFijo !== undefined && totalFijo !== null) return redondear2(Number(totalFijo)); // pedidos de la tienda: vale lo que pagó el cliente
  return desgloseIva(items, ivaPct, estado).total;
}

/**
 * Deja la cuenta corriente del cliente al día con el pedido: compara lo que el pedido debe sumar hoy con lo que ya sumó
 * y agrega UN movimiento con la diferencia. Se llama después de crear, editar, entregar o cancelar un pedido, así
 * ningún pedido puede quedar afuera de la cuenta. Los movimientos nunca se editan ni se borran.
 */
export async function sincronizarCuentaPedido(tx: Prisma.TransactionClient, pedidoId: string, usuarioId: string | null) {
  const pedido = await tx.pedido.findUniqueOrThrow({ where: { id: pedidoId }, include: { items: true } });
  if (!pedido.clienteId) return; // los pedidos de la tienda online no tienen cuenta corriente
  const vigente = importeVigente(pedido.items, Number(pedido.ivaPct), pedido.estado, pedido.webTotal); // webTotal = total fijo (comprobantes cargados directamente)
  // Solo cuentan los movimientos del pedido en sí; los cobros (PAGO) son aparte y no cambian lo que el pedido debe.
  const previo = await tx.movimientoCuenta.aggregate({ where: { pedidoId, tipo: { in: ["CARGO_PEDIDO", "AJUSTE_PEDIDO", "ANULACION_PEDIDO"] } }, _sum: { monto: true } });
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

/** Deja anotado en la cuenta corriente el día que se entregó el pedido (línea sin importe; el ajuste, si lo hay, va aparte). */
export async function anotarEntregaEnCuenta(tx: Prisma.TransactionClient, pedidoId: string, clienteId: string | null, usuarioId: string | null) {
  if (!clienteId) return;
  await tx.movimientoCuenta.create({ data: { clienteId, pedidoId, tipo: "AJUSTE_PEDIDO", monto: 0, nota: "Pedido entregado", usuarioId } });
}

export async function saldoCliente(tx: Prisma.TransactionClient, clienteId: string) {
  const r = await tx.movimientoCuenta.aggregate({ where: { clienteId }, _sum: { monto: true } });
  return redondear2(Number(r._sum.monto ?? 0));
}
