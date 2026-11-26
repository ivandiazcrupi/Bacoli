"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirOficina } from "@/lib/session";
import { cancelarPedido, marcarPagoWeb } from "../../pedidos/actions";

type Res = { ok: boolean; error?: string };

/** Marca un pedido de la tienda como abonado (transferencia confirmada) o lo vuelve a pendiente. */
export async function pagoDesdeTienda(pedidoId: string, pagado: boolean): Promise<Res> {
  const r = await marcarPagoWeb(pedidoId, pagado);
  revalidatePath("/comercial/tienda");
  return r;
}

/** Cancela un pedido de la tienda online (el mismo "Cancelar pedido" de siempre, con avisos claros). */
export async function cancelarDesdeTienda(pedidoId: string): Promise<Res> {
  await exigirOficina();
  const p = await db.pedido.findUnique({ where: { id: pedidoId }, select: { origen: true, estado: true, fechaEntrega: true } });
  if (!p || p.origen !== "WEB") return { ok: false, error: "Solo se cancelan desde acá los pedidos de la tienda online." };
  if (p.estado === "CANCELADO") return { ok: false, error: "El pedido ya estaba cancelado." };
  if (p.estado === "ENTREGADO") return { ok: false, error: "El pedido ya se entregó: no se puede cancelar." };
  const fd = new FormData();
  fd.set("id", pedidoId);
  await cancelarPedido(fd);
  const despues = await db.pedido.findUnique({ where: { id: pedidoId }, select: { estado: true } });
  revalidatePath("/comercial/tienda");
  if (despues?.estado !== "CANCELADO") return { ok: false, error: "No se pudo cancelar: la hoja de ruta de ese día ya está lista o cerrada. Volvela a armar o marcalo como no entregado." };
  return { ok: true };
}
