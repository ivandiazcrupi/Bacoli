"use server";

import { revalidatePath } from "next/cache";
import type { MedioPago } from "@prisma/client";
import { anotarEntregaEnCuenta, importeVigente, sincronizarCuentaPedido } from "@/lib/cuenta";
import { db } from "@/lib/db";
import { aFecha, diaMes, esFechaValida } from "@/lib/fechas";
import { titulo } from "@/lib/mayusculas";
import { datosEntrega, ordenarItems } from "../filas";
import { leerCobro, marcarCobroEnTx } from "@/lib/cobrar";
import { formatoRemito, normalizarFactura } from "@/lib/remito";
import { exigirOficina } from "@/lib/session";

export type Resultado = { ok: boolean; error?: string };
const MEDIOS: MedioPago[] = ["EFECTIVO", "TRANSFERENCIA", "CHEQUE", "MERCADO_PAGO", "OTRO"];
const redondear2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

async function pedidoAbierto(id: string) {
  const pedido = await db.pedido.findUnique({ where: { id }, include: { items: true, ncAplicaciones: { where: { nota: { anuladaEn: null } } } } });
  if (!pedido) return { error: "No encontré el pedido." } as const;
  if (pedido.fechaEntrega && (await db.diaCerrado.findUnique({ where: { fecha: pedido.fechaEntrega } }))) {
    return { error: "Ese día está cerrado. Un dueño puede reabrirlo." } as const;
  }
  return { pedido } as const;
}

/**
 * Entrega. "ENTREGADO" exige decir cómo se cobra (pago en efectivo / transferencia, o cuenta corriente): se guardan juntas,
 * así no puede quedar un pedido entregado sin cobro marcado. "PENDIENTE" deshace la entrega (y el cobro, si lo había).
 * Para "no entregado" se usa registrarNoEntrega, que pide el motivo.
 */
export async function marcarEntrega(pedidoId: string, valor: "ENTREGADO" | "PENDIENTE", cobroTexto?: string): Promise<Resultado> {
  const usuario = await exigirOficina();
  const r = await pedidoAbierto(pedidoId);
  if ("error" in r) return { ok: false, error: r.error };
  const { pedido } = r;
  if (pedido.estado === "CANCELADO") return { ok: false, error: "El pedido está cancelado." };
  if (valor === "ENTREGADO" && pedido.conFactura && !pedido.numeroFactura?.trim()) return { ok: false, error: "Este pedido lleva factura: cargá primero el N° de factura y después marcalo como entregado." };
  const cobro = leerCobro(cobroTexto);
  if (valor === "ENTREGADO" && !cobro && pedido.webPago !== "PAGO_MP") return { ok: false, error: "Elegí cómo se cobra: Pago o Cuenta corriente." };

  let error: string | null = null;
  await db.$transaction(async (tx) => {
    // Si estaba cobrado y deja de estar entregado, el cobro se deshace solo (queda anotado en la cuenta como anulación del pago).
    if (pedido.cobro === "COBRADO" && pedido.clienteId && pedido.montoCobrado && (valor !== "ENTREGADO" || pedido.estado === "ENTREGADO")) {
      await tx.movimientoCuenta.create({ data: { clienteId: pedido.clienteId, pedidoId, tipo: "ANULACION_PAGO", monto: pedido.montoCobrado, medio: pedido.medioCobro, nota: "Cobro anulado", usuarioId: usuario.id } });
    }
    await tx.pedido.update({ where: { id: pedidoId }, data: { estado: valor, cobro: null, medioCobro: null, montoCobrado: null, pagado: false } });
    // Entregado completo: lo entregado es lo pedido. Si volvió a pendiente, se borra lo entregado.
    await tx.pedidoItem.updateMany({ where: { pedidoId }, data: { cantidadEntregada: null } });
    if (valor === "ENTREGADO") for (const i of pedido.items) await tx.pedidoItem.update({ where: { id: i.id }, data: { cantidadEntregada: i.cantidad } });
    if (valor === "ENTREGADO" && pedido.estado !== "ENTREGADO") await anotarEntregaEnCuenta(tx, pedidoId, pedido.clienteId, usuario.id);
    await sincronizarCuentaPedido(tx, pedidoId, usuario.id);
    if (valor === "ENTREGADO") {
      error = await marcarCobroEnTx(tx, pedidoId, cobro, usuario.id);
      if (error) throw new Error(error);
    }
  }).catch((e) => {
    if (!error) throw e;
  });
  if (error) return { ok: false, error };
  revalidatePath("/pedidos", "layout");
  return { ok: true };
}

/**
 * No se pudo entregar: el motivo es obligatorio. El pedido vuelve a Pedidos (pendiente, sin día, para reprogramar) y en la hoja
 * de ruta de ese día queda su "silueta" (el registro de que salió y no se entregó).
 */
export async function registrarNoEntrega(pedidoId: string, motivo: string): Promise<Resultado> {
  const usuario = await exigirOficina();
  const texto = motivo.trim().replace(/\s+/g, " ");
  if (texto.length < 3) return { ok: false, error: "Escribí el motivo por el que no se entregó." };
  const pedido = await db.pedido.findUnique({
    where: { id: pedidoId },
    include: { cliente: true, punto: true, items: { include: { producto: { select: { orden: true } } } }, salida: { include: { vehiculo: true } } },
  });
  if (!pedido) return { ok: false, error: "No encontré el pedido." };
  if (pedido.estado === "CANCELADO") return { ok: false, error: "El pedido está cancelado." };
  if (!pedido.fechaEntrega) return { ok: false, error: "Este pedido no estaba en ninguna hoja de ruta." };
  if (await db.diaCerrado.findUnique({ where: { fecha: pedido.fechaEntrega } })) return { ok: false, error: "Ese día está cerrado. Un dueño puede reabrirlo." };

  const d = datosEntrega(pedido);
  const resumen = {
    barrio: d.barrio,
    cliente: d.nombre,
    direccion: d.direccion,
    telefono: d.telefono,
    items: ordenarItems(pedido.items).map((i) => ({ nombre: i.nombre, cantidad: i.cantidad + i.sinCargo, sinCargo: i.sinCargo })),
    monto: importeVigente(pedido.items, Number(pedido.ivaPct), "PENDIENTE", pedido.webTotal),
    conFactura: pedido.conFactura,
    comprobante: pedido.conFactura ? pedido.numeroFactura : pedido.remitoNumero ? formatoRemito(pedido.remitoNumero) : null,
  };
  await db.$transaction(async (tx) => {
    await tx.intentoEntrega.create({
      data: {
        pedidoId,
        fecha: pedido.fechaEntrega!,
        salidaId: pedido.salidaId,
        vehiculo: pedido.salida ? titulo(pedido.salida.vehiculo.nombre) : "Sin camioneta",
        orden: pedido.ordenRuta,
        motivo: texto,
        resumen,
        usuarioId: usuario.id,
      },
    });
    // Si había un cobro marcado, se deshace con su anulación en la cuenta.
    if (pedido.cobro === "COBRADO" && pedido.clienteId && pedido.montoCobrado) {
      await tx.movimientoCuenta.create({ data: { clienteId: pedido.clienteId, pedidoId, tipo: "ANULACION_PAGO", monto: pedido.montoCobrado, medio: pedido.medioCobro, nota: "Cobro anulado", usuarioId: usuario.id } });
    }
    await tx.pedido.update({
      where: { id: pedidoId },
      data: { estado: "PENDIENTE", fechaEntrega: null, salidaId: null, ordenRuta: 0, cobro: null, medioCobro: null, montoCobrado: null, pagado: false },
    });
    await tx.pedidoItem.updateMany({ where: { pedidoId }, data: { cantidadEntregada: null } });
    await sincronizarCuentaPedido(tx, pedidoId, usuario.id);
  });
  revalidatePath("/pedidos", "layout");
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

  const debido = redondear2(importeVigente(pedido.items, Number(pedido.ivaPct), "ENTREGADO", pedido.webTotal) - pedido.ncAplicaciones.reduce((t, a) => t + Number(a.monto), 0));
  if (debido <= 0) return { ok: false, error: "Este comprobante está cubierto por una nota de crédito: no hay nada que cobrar." };
  const cobrado = redondear2(monto ?? debido);
  if (!(cobrado > 0)) return { ok: false, error: "El monto cobrado tiene que ser mayor a 0." };

  await db.$transaction(async (tx) => {
    await tx.pedido.update({
      where: { id: pedidoId },
      data: { cobro: "COBRADO", medioCobro: medio as MedioPago, montoCobrado: cobrado, pagado: cobrado + 0.005 >= debido },
    });
    if (pedido.clienteId) {
      await tx.movimientoCuenta.create({
        data: { clienteId: pedido.clienteId, pedidoId, tipo: "PAGO", monto: -cobrado, medio: medio as MedioPago, nota: "Cobro del pedido", usuarioId: usuario.id },
      });
    }
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
  if (!r.pedido.clienteId) return { ok: false, error: "Los pedidos de la tienda online no tienen cuenta corriente." };
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
    if (pedido.cobro === "COBRADO" && pedido.montoCobrado && pedido.clienteId) {
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
  const normal = normalizarFactura(numero);
  if (normal === undefined) return { ok: false, error: "El N° de factura son solo números, hasta 4 cifras (por ejemplo 123 → F-0123)." };
  const limpio = normal ?? "";
  if (limpio) {
    const repetido = await db.pedido.findFirst({ where: { numeroFactura: { equals: limpio, mode: "insensitive" }, id: { not: pedidoId } }, include: { cliente: true } });
    if (repetido) return { ok: false, error: `El N° de factura ${limpio} ya está cargado en un pedido de ${repetido.cliente?.nombre ?? repetido.webNombre ?? "la tienda"}.` };
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
  const hayIntentos = (await db.intentoEntrega.count({ where: { fecha: aFecha(fecha) } })) > 0;
  if (pedidos.length === 0 && !hayIntentos) return { ok: false, error: "No hay pedidos en este día." };

  // Se revisa todo junto y se dice qué falta (en vez de ir de a una cosa).
  const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
  const problemas: string[] = [];
  const sinUbicar = pedidos.filter((p) => p.salidaId === null).length;
  if (sinUbicar > 0) problemas.push(`${plural(sinUbicar, "pedido sin ubicar", "pedidos sin ubicar")} en una camioneta (ubicalos, pasalos a otro día o devolvelos a Pedidos)`);
  const sinSaber = pedidos.filter((p) => p.estado === "PENDIENTE").length;
  if (sinSaber > 0) problemas.push(`${plural(sinSaber, "pedido sin saber si se entregó", "pedidos sin saber si se entregaron")} (marcá entregado con su cobro, o no entregado con su motivo)`);
  const sinCobro = pedidos.filter((p) => p.estado === "ENTREGADO" && p.cobro === null).length;
  if (sinCobro > 0) problemas.push(`${plural(sinCobro, "pedido entregado sin cobro", "pedidos entregados sin cobro")} (Pago o Cuenta corriente)`);
  // Toda venta entregada lleva un número: el de la factura si lleva factura, o el del remito.
  const sinNumero = pedidos.filter((p) => p.estado === "ENTREGADO" && p.clienteId && (p.conFactura ? !p.numeroFactura : p.remitoNumero === null)).length;
  if (sinNumero > 0) problemas.push(`${plural(sinNumero, "pedido entregado sin número", "pedidos entregados sin número")} de factura o de remito`);
  if (problemas.length > 0) return { ok: false, faltan: problemas.length, error: `Para cerrar el día falta:\n${problemas.map((x) => `• ${x}`).join("\n")}` };

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
