"use server";

import { revalidatePath } from "next/cache";
import { importeVigente, sincronizarCuentaPedido } from "@/lib/cuenta";
import { db } from "@/lib/db";
import { normalizarFactura } from "@/lib/remito";
import { exigirOficina } from "@/lib/session";
import { deshacerCobro, registrarCobro } from "../pedidos/dia/actions";

type Resultado = { ok: boolean; error?: string };

/** Marca varios comprobantes como pagados con el mismo medio (cada uno por su monto completo: no hay pagos parciales). */
export async function registrarPagos(pedidoIds: string[], medio: string, obs = ""): Promise<Resultado> {
  await exigirOficina();
  if (pedidoIds.length === 0) return { ok: false, error: "Elegí al menos un comprobante." };
  for (const id of pedidoIds) {
    const r = await registrarCobro(id, medio);
    if (!r.ok) {
      revalidatePath("/cuentas", "layout");
      return { ok: false, error: r.error ?? "No se pudo registrar el pago." };
    }
    if (obs.trim()) {
      const p = await db.pedido.findUnique({ where: { id }, select: { obsCobro: true } });
      await db.pedido.update({ where: { id }, data: { obsCobro: [p?.obsCobro, obs.trim()].filter(Boolean).join(" · ").slice(0, 200) } });
    }
  }
  revalidatePath("/cuentas", "layout");
  return { ok: true };
}

export async function deshacerPago(pedidoId: string): Promise<Resultado> {
  await exigirOficina();
  const r = await deshacerCobro(pedidoId);
  revalidatePath("/cuentas", "layout");
  return r.ok ? { ok: true } : { ok: false, error: r.error ?? "No se pudo deshacer." };
}

/** Observación de la cobranza (N° de cheque, de comprobante de transferencia, etc.). */
export async function guardarObservacion(pedidoId: string, texto: string): Promise<Resultado> {
  await exigirOficina();
  await db.pedido.update({ where: { id: pedidoId }, data: { obsCobro: texto.trim().slice(0, 200) || null } });
  revalidatePath("/cuentas", "layout");
  return { ok: true };
}

type Aplicacion = { pedidoId: string; monto: number };
const redondear2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Valida que cada aplicación entre en lo que todavía debe ese comprobante del cliente. */
async function validarAplicaciones(clienteId: string, aplicaciones: Aplicacion[]): Promise<string | null> {
  const ids = aplicaciones.map((a) => a.pedidoId);
  if (new Set(ids).size !== ids.length) return "Un comprobante está repetido.";
  const pedidos = await db.pedido.findMany({
    where: { id: { in: ids } },
    include: { items: true, ncAplicaciones: { where: { nota: { anuladaEn: null } } } },
  });
  for (const a of aplicaciones) {
    if (!(a.monto > 0)) return "Cada monto aplicado tiene que ser mayor a 0.";
    const p = pedidos.find((x) => x.id === a.pedidoId);
    if (!p || p.clienteId !== clienteId) return "Un comprobante no es de este cliente.";
    if (!p.conFactura) return "Las notas de crédito se aplican solo a facturas. Para un remito, reabrí el pedido y corregilo.";
    if (p.pagado || (p.estado !== "PENDIENTE" && p.estado !== "ENTREGADO")) return "Solo se aplica a comprobantes sin pagar.";
    const debe = importeVigente(p.items, Number(p.ivaPct), p.estado === "ENTREGADO" ? "ENTREGADO" : "PENDIENTE", p.webTotal) - p.ncAplicaciones.reduce((t, x) => t + Number(x.monto), 0);
    if (a.monto > debe + 0.005) return `El monto aplicado supera lo que debe ese comprobante ($ ${redondear2(debe).toLocaleString("es-AR")}).`;
  }
  return null;
}

/** Carga una nota de crédito (puede cubrir varios comprobantes). Lo que no se aplica queda como saldo a favor del cliente. */
export async function crearNotaCredito(datos: { clienteId: string; numero: string; motivo: string; monto: number; aplicaciones: Aplicacion[] }): Promise<Resultado> {
  const usuario = await exigirOficina();
  const motivo = datos.motivo.trim();
  const numero = datos.numero.trim();
  const monto = redondear2(datos.monto);
  if (!motivo) return { ok: false, error: "Escribí el motivo de la nota de crédito." };
  if (!(monto > 0)) return { ok: false, error: "El monto tiene que ser mayor a 0." };
  const aplicaciones = datos.aplicaciones.filter((a) => a.monto > 0);
  if (aplicaciones.reduce((t, a) => t + a.monto, 0) > monto + 0.005) return { ok: false, error: "Lo aplicado a los comprobantes supera el monto de la nota." };
  if (!(await db.cliente.findUnique({ where: { id: datos.clienteId } }))) return { ok: false, error: "No encontré el cliente." };
  if (numero) {
    const repetida = await db.notaCredito.findFirst({ where: { numero: { equals: numero, mode: "insensitive" }, anuladaEn: null } });
    if (repetida) return { ok: false, error: `La nota de crédito ${numero} ya está cargada.` };
  }
  const error = await validarAplicaciones(datos.clienteId, aplicaciones);
  if (error) return { ok: false, error };

  await db.$transaction(async (tx) => {
    const nota = await tx.notaCredito.create({
      data: { clienteId: datos.clienteId, numero: numero || null, motivo, monto, usuarioId: usuario.id, aplicaciones: { create: aplicaciones.map((a) => ({ pedidoId: a.pedidoId, monto: redondear2(a.monto) })) } },
    });
    await tx.movimientoCuenta.create({
      data: { clienteId: datos.clienteId, tipo: "NOTA_CREDITO", monto: -monto, nota: `Nota de crédito ${numero || "s/n"} · ${motivo}`, usuarioId: usuario.id },
    });
    return nota;
  });
  revalidatePath("/cuentas", "layout");
  return { ok: true };
}

/** Aplica lo que quedó sin aplicar de una nota (saldo a favor) a otros comprobantes del cliente. */
export async function aplicarSaldoNota(notaId: string, aplicaciones: Aplicacion[]): Promise<Resultado> {
  await exigirOficina();
  const nota = await db.notaCredito.findUnique({ where: { id: notaId }, include: { aplicaciones: true } });
  if (!nota || nota.anuladaEn) return { ok: false, error: "No encontré la nota de crédito." };
  const restante = Number(nota.monto) - nota.aplicaciones.reduce((t, a) => t + Number(a.monto), 0);
  const nuevas = aplicaciones.filter((a) => a.monto > 0);
  if (nuevas.length === 0) return { ok: false, error: "Elegí a qué comprobantes aplicarla." };
  if (nuevas.reduce((t, a) => t + a.monto, 0) > restante + 0.005) return { ok: false, error: "Lo aplicado supera el saldo que le queda a la nota." };
  const error = await validarAplicaciones(nota.clienteId, nuevas);
  if (error) return { ok: false, error };
  await db.notaCreditoAplicacion.createMany({ data: nuevas.map((a) => ({ notaId, pedidoId: a.pedidoId, monto: redondear2(a.monto) })) });
  revalidatePath("/cuentas", "layout");
  return { ok: true };
}

/** Anula una nota cargada por error: los comprobantes vuelven a deber ese monto. Queda el registro (no se borra). */
export async function anularNotaCredito(notaId: string): Promise<Resultado> {
  const usuario = await exigirOficina();
  const nota = await db.notaCredito.findUnique({ where: { id: notaId } });
  if (!nota || nota.anuladaEn) return { ok: false, error: "La nota ya está anulada o no existe." };
  await db.$transaction(async (tx) => {
    await tx.notaCredito.update({ where: { id: notaId }, data: { anuladaEn: new Date() } });
    await tx.movimientoCuenta.create({
      data: { clienteId: nota.clienteId, tipo: "NOTA_CREDITO", monto: nota.monto, nota: `Nota de crédito ${nota.numero ?? "s/n"} anulada`, usuarioId: usuario.id },
    });
  });
  revalidatePath("/cuentas", "layout");
  return { ok: true };
}

/** Carga una factura directamente (sin pedido): por ejemplo para reemplazar una que salió mal. Queda entregada y a cobrar. */
export async function cargarFactura(datos: { clienteId: string; numero: string; fecha: string; total: number; observacion: string }): Promise<Resultado & { clienteId?: string }> {
  const usuario = await exigirOficina();
  const normal = normalizarFactura(datos.numero);
  if (normal === undefined) return { ok: false, error: "El N° de factura son solo números, hasta 4 cifras (por ejemplo 123 → F-0123)." };
  const numero = normal ?? "";
  const total = redondear2(datos.total);
  if (!numero) return { ok: false, error: "Cargá el N° de factura (solo números, por ejemplo 123 → F-0123)." };
  if (!(total > 0)) return { ok: false, error: "El total tiene que ser mayor a 0." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha)) return { ok: false, error: "Elegí la fecha de la factura." };
  if (!(await db.cliente.findUnique({ where: { id: datos.clienteId } }))) return { ok: false, error: "Elegí el cliente." };
  const repetida = await db.pedido.findFirst({ where: { numeroFactura: { equals: numero, mode: "insensitive" } } });
  if (repetida) return { ok: false, error: `El N° de factura ${numero} ya está cargado.` };

  await db.$transaction(async (tx) => {
    const p = await tx.pedido.create({
      data: {
        clienteId: datos.clienteId,
        estado: "ENTREGADO",
        conFactura: true,
        manual: true,
        numeroFactura: numero,
        webTotal: total,
        obsCobro: datos.observacion.trim().slice(0, 200) || null,
        nota: "Factura cargada directamente",
        creadoPorId: usuario.id,
        creadoEn: new Date(`${datos.fecha}T12:00:00-03:00`),
      },
    });
    await sincronizarCuentaPedido(tx, p.id, usuario.id);
  });
  revalidatePath("/cuentas", "layout");
  return { ok: true, clienteId: datos.clienteId };
}
