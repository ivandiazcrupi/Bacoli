"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { aFecha, esFechaValida } from "@/lib/fechas";
import { formatoRemito } from "@/lib/remito";
import { porReparto } from "@/lib/ruta";
import { exigirOficina } from "@/lib/session";

/** Le da a un pedido el siguiente número de remito, si todavía no tiene. El número no cambia nunca. */
async function asignarNumero(tx: Prisma.TransactionClient, pedidoId: string) {
  const pedido = await tx.pedido.findUniqueOrThrow({ where: { id: pedidoId }, select: { remitoNumero: true, estado: true } });
  if (pedido.remitoNumero !== null) return pedido.remitoNumero;
  if (pedido.estado === "CANCELADO") throw new Error("El pedido está cancelado.");
  // El incremento se hace dentro de la base y bloquea la fila: dos personas a la vez nunca reciben el mismo número.
  const contador = await tx.numerador.upsert({ where: { id: "REMITO" }, update: { ultimo: { increment: 1 } }, create: { id: "REMITO", ultimo: 1 } });
  await tx.pedido.update({ where: { id: pedidoId }, data: { remitoNumero: contador.ultimo, remitoEmitidoEn: new Date() } });
  return contador.ultimo;
}

export async function emitirRemito(pedidoId: string): Promise<{ ok: boolean; numero?: string; error?: string }> {
  await exigirOficina();
  try {
    const n = await db.$transaction((tx) => asignarNumero(tx, pedidoId));
    revalidatePath(`/pedidos/${pedidoId}`);
    return { ok: true, numero: formatoRemito(n) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo emitir el remito." };
  }
}

/** Emite los remitos que falten de un día, en el orden del reparto, para que los números sigan la ruta. */
export async function emitirRemitosDia(fecha: string): Promise<{ ok: boolean; cantidad: number; error?: string }> {
  await exigirOficina();
  if (!esFechaValida(fecha)) return { ok: false, cantidad: 0, error: "Fecha inválida." };
  const pedidos = (await db.pedido.findMany({
    where: { fechaEntrega: aFecha(fecha), estado: { not: "CANCELADO" } },
    select: { id: true, remitoNumero: true, ordenDia: true, ordenRuta: true, salida: { select: { orden: true } } },
  })).sort(porReparto);
  if (pedidos.length === 0) return { ok: false, cantidad: 0, error: "No hay pedidos en este día." };
  const faltan = pedidos.filter((p) => p.remitoNumero === null);
  await db.$transaction(async (tx) => {
    for (const p of faltan) await asignarNumero(tx, p.id);
  });
  return { ok: true, cantidad: pedidos.length };
}
