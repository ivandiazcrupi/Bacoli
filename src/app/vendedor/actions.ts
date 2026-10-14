"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirVendedor, vendedorDeUsuario } from "@/lib/session";

type Resultado = { ok: boolean; error?: string };

/** El pedido tiene que ser de un cliente del propio vendedor. */
async function pedidoPropio(pedidoId: string) {
  const usuario = await exigirVendedor();
  const vendedor = await vendedorDeUsuario(usuario.id);
  if (!vendedor) return { error: "Todavía no te enlazaron con tu ficha de vendedor." } as const;
  const pedido = await db.pedido.findUnique({ where: { id: pedidoId }, select: { estado: true, pagado: true, pagoAvisadoPor: true, cliente: { select: { vendedorId: true } } } });
  if (!pedido || pedido.cliente?.vendedorId !== vendedor.id) return { error: "Ese pedido no es de uno de tus clientes." } as const;
  return { pedido, vendedor } as const;
}

/**
 * El vendedor indica que el cliente pagó. NO registra ningún pago: solo deja un aviso que la oficina ve en Cuenta corriente
 * ("Diego indicó que se pagó") y confirma ella; el último OK es siempre de la oficina.
 */
export async function avisarPago(pedidoId: string): Promise<Resultado> {
  const r = await pedidoPropio(pedidoId);
  if ("error" in r) return { ok: false, error: r.error };
  if (r.pedido.estado !== "ENTREGADO") return { ok: false, error: "Solo se puede avisar el pago de un pedido ya entregado." };
  if (r.pedido.pagado) return { ok: false, error: "Ese pedido ya figura como pagado." };
  await db.pedido.update({ where: { id: pedidoId }, data: { pagoAvisadoPor: r.vendedor.nombre, pagoAvisadoEn: new Date() } });
  revalidatePath("/vendedor", "layout");
  revalidatePath("/cuentas", "layout");
  return { ok: true };
}

/** El vendedor se arrepiente: saca su aviso (mientras la oficina no lo haya confirmado). */
export async function quitarAvisoPago(pedidoId: string): Promise<Resultado> {
  const r = await pedidoPropio(pedidoId);
  if ("error" in r) return { ok: false, error: r.error };
  if (r.pedido.pagado) return { ok: false, error: "La oficina ya confirmó el pago." };
  await db.pedido.update({ where: { id: pedidoId }, data: { pagoAvisadoPor: null, pagoAvisadoEn: null } });
  revalidatePath("/vendedor", "layout");
  revalidatePath("/cuentas", "layout");
  return { ok: true };
}
