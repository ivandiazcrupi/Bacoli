"use server";

import { revalidatePath } from "next/cache";
import type { MedioPago } from "@prisma/client";
import { importeVigente, sincronizarCuentaPedido } from "@/lib/cuenta";
import { db } from "@/lib/db";
import { aFecha, diaMes, esFechaValida } from "@/lib/fechas";
import { exigirOficina } from "@/lib/session";

export type Resultado = { ok: boolean; error?: string };
const MEDIOS: MedioPago[] = ["EFECTIVO", "TRANSFERENCIA", "CHEQUE", "MERCADO_PAGO", "OTRO"];
const redondear2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

async function pedidoAbierto(id: string) {
  const pedido = await db.pedido.findUnique({ where: { id }, include: { items: true } });
  if (!pedido) return { error: "No encontré el pedido." } as const;
  if (pedido.fechaEntrega && (await db.diaCerrado.findUnique({ where: { fecha: pedido.fechaEntrega } }))) {
    return { error: "Ese día está cerrado. Un dueño puede reabrirlo." } as const;
  }
  return { pedido } as const;
}

/** Entrega: "ENTREGADO" (verde), "NO_ENTREGADO" (rojo) o "PENDIENTE" (sin marcar). */
export async function marcarEntrega(pedidoId: string, valor: "ENTREGADO" | "NO_ENTREGADO" | "PENDIENTE"): Promise<Resultado> {
  const usuario = await exigirOficina();
  const r = await pedidoAbierto(pedidoId);
  if ("error" in r) return { ok: false, error: r.error };
  const { pedido } = r;
  if (pedido.estado === "CANCELADO") return { ok: false, error: "El pedido está cancelado." };
  if (valor !== "ENTREGADO" && pedido.cobro === "COBRADO") return { ok: false, error: "Primero deshacé el cobro." };

  await db.$transaction(async (tx) => {
    await tx.pedido.update({ where: { id: pedidoId }, data: { estado: valor, ...(valor !== "ENTREGADO" ? { cobro: null, medioCobro: null, montoCobrado: null } : {}) } });
    // Entregado completo: lo entregado es lo pedido. Si volvió a pendiente o a no entregado, se borra lo entregado.
    await tx.pedidoItem.updateMany({ where: { pedidoId }, data: { cantidadEntregada: null } });
    if (valor === "ENTREGADO") for (const i of pedido.items) await tx.pedidoItem.update({ where: { id: i.id }, data: { cantidadEntregada: i.cantidad } });
    await sincronizarCuentaPedido(tx, pedidoId, usuario.id);
  });
  return { ok: true };
}

/** Cobrado: baja la deuda del cliente con un movimiento de pago y deja el pedido como pagado. */
export async function registrarCobro(pedidoId: string, medio: string, monto?: number): Promise<Resultado> {
  const usuario = await exigirOficina();
  if (!MEDIOS.includes(medio as MedioPago)) return { ok: false, error: "Elegí el medio de pago." };
  const r = await pedidoAbierto(pedidoId);
  if ("error" in r) return { ok: false, error: r.error };
  const { pedido } = r;
  if (pedido.estado !== "ENTREGADO") return { ok: false, error: "Primero marcá el pedido como entregado." };
  if (pedido.cobro === "COBRADO") return { ok: false, error: "Este pedido ya está cobrado." };

  const debido = importeVigente(pedido.items, Number(pedido.ivaPct), "ENTREGADO");
  const cobrado = redondear2(monto ?? debido);
  if (!(cobrado > 0)) return { ok: false, error: "El monto cobrado tiene que ser mayor a 0." };

  await db.$transaction(async (tx) => {
    await tx.pedido.update({
      where: { id: pedidoId },
      data: { cobro: "COBRADO", medioCobro: medio as MedioPago, montoCobrado: cobrado, pagado: cobrado + 0.005 >= debido },
    });
    await tx.movimientoCuenta.create({
      data: { clienteId: pedido.clienteId, pedidoId, tipo: "PAGO", monto: -cobrado, medio: medio as MedioPago, nota: "Cobro del pedido", usuarioId: usuario.id },
    });
  });
  return { ok: true };
}

/** El pedido se entregó y la plata queda en la cuenta corriente del cliente. */
export async function dejarEnCuentaCorriente(pedidoId: string): Promise<Resultado> {
  await exigirOficina();
  const r = await pedidoAbierto(pedidoId);
  if ("error" in r) return { ok: false, error: r.error };
  if (r.pedido.estado !== "ENTREGADO") return { ok: false, error: "Primero marcá el pedido como entregado." };
  if (r.pedido.cobro === "COBRADO") return { ok: false, error: "Primero deshacé el cobro." };
  await db.pedido.update({ where: { id: pedidoId }, data: { cobro: "CUENTA_CORRIENTE" } });
  return { ok: true };
}

/** Deshace el cobro. Si había un pago, se agrega un movimiento que lo anula (los movimientos no se borran). */
export async function deshacerCobro(pedidoId: string): Promise<Resultado> {
  const usuario = await exigirOficina();
  const r = await pedidoAbierto(pedidoId);
  if ("error" in r) return { ok: false, error: r.error };
  const { pedido } = r;
  await db.$transaction(async (tx) => {
    if (pedido.cobro === "COBRADO" && pedido.montoCobrado) {
      await tx.movimientoCuenta.create({
        data: { clienteId: pedido.clienteId, pedidoId, tipo: "ANULACION_PAGO", monto: pedido.montoCobrado, medio: pedido.medioCobro, nota: "Cobro anulado", usuarioId: usuario.id },
      });
    }
    await tx.pedido.update({ where: { id: pedidoId }, data: { cobro: null, medioCobro: null, montoCobrado: null, pagado: false } });
  });
  return { ok: true };
}

export async function guardarNumeroFactura(pedidoId: string, numero: string): Promise<Resultado> {
  await exigirOficina();
  const r = await pedidoAbierto(pedidoId);
  if ("error" in r) return { ok: false, error: r.error };
  const limpio = numero.trim();
  if (limpio) {
    const repetido = await db.pedido.findFirst({ where: { numeroFactura: { equals: limpio, mode: "insensitive" }, id: { not: pedidoId } }, include: { cliente: true } });
    if (repetido) return { ok: false, error: `El N° de factura ${limpio} ya está cargado en un pedido de ${repetido.cliente.nombre}.` };
  }
  await db.pedido.update({ where: { id: pedidoId }, data: { numeroFactura: limpio || null } });
  return { ok: true };
}

/**
 * Cierra el día: todos los pedidos tienen que tener la entrega marcada (verde o rojo) y los entregados, el cobro marcado.
 * Los que quedaron en rojo vuelven a "Sin asignar" para reprogramarlos.
 */
export async function cerrarDia(fecha: string): Promise<Resultado & { faltan?: number }> {
  const usuario = await exigirOficina();
  if (!esFechaValida(fecha)) return { ok: false, error: "Fecha inválida." };
  if (await db.diaCerrado.findUnique({ where: { fecha: aFecha(fecha) } })) return { ok: false, error: "El día ya está cerrado." };

  const pedidos = await db.pedido.findMany({ where: { fechaEntrega: aFecha(fecha), estado: { not: "CANCELADO" } } });
  if (pedidos.length === 0) return { ok: false, error: "No hay pedidos en este día." };
  const sinVehiculo = pedidos.filter((p) => p.salidaId === null).length;
  if (sinVehiculo > 0) return { ok: false, faltan: sinVehiculo, error: `Hay ${sinVehiculo} ${sinVehiculo === 1 ? "pedido" : "pedidos"} sin vehículo. Asignalos a un vehículo (o devolvelos a Pedidos) antes de cerrar el día.` };
  const faltan = pedidos.filter((p) => p.estado === "PENDIENTE" || (p.estado === "ENTREGADO" && p.cobro === null)).length;
  if (faltan > 0) return { ok: false, faltan, error: `Faltan ${faltan} ${faltan === 1 ? "pedido" : "pedidos"} por marcar (entrega o cobro).` };
  // Toda venta entregada lleva un número: el de la factura si lleva factura, o el del remito.
  const sinNumero = pedidos.filter((p) => p.estado === "ENTREGADO" && (p.conFactura ? !p.numeroFactura : p.remitoNumero === null)).length;
  if (sinNumero > 0) return { ok: false, faltan: sinNumero, error: `Faltan ${sinNumero} ${sinNumero === 1 ? "pedido" : "pedidos"} sin número de factura o de remito.` };

  await db.$transaction(async (tx) => {
    await tx.diaCerrado.create({ data: { fecha: aFecha(fecha), cerradoPor: usuario.id } });
    for (const p of pedidos.filter((x) => x.estado === "NO_ENTREGADO")) {
      // Vuelve a la bandeja como pendiente (y a contar en la cuenta), anotando qué pasó.
      await tx.pedido.update({
        where: { id: p.id },
        data: { estado: "PENDIENTE", fechaEntrega: null, salidaId: null, ordenRuta: 0, ordenDia: 999999, nota: [p.nota, `No entregado el ${diaMes(fecha)}`].filter(Boolean).join(" · ") },
      });
      await sincronizarCuentaPedido(tx, p.id, usuario.id);
    }
  });
  revalidatePath("/pedidos", "layout");
  return { ok: true };
}

export async function reabrirDia(fecha: string): Promise<Resultado> {
  const usuario = await exigirOficina();
  if (usuario.rol !== "DUENO") return { ok: false, error: "Solo un dueño puede reabrir un día cerrado." };
  if (!esFechaValida(fecha)) return { ok: false, error: "Fecha inválida." };
  await db.diaCerrado.deleteMany({ where: { fecha: aFecha(fecha) } });
  revalidatePath("/pedidos", "layout");
  return { ok: true };
}
