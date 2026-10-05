"use server";

import { revalidatePath } from "next/cache";
import { IVA_ENVIO, sincronizarCuentaPedido } from "@/lib/cuenta";
import { db } from "@/lib/db";
import { exigirUsuario } from "@/lib/session";

const MINUTOS_COPIA = 30;

/**
 * Pone el envío al 21% de IVA en todas las facturas ya hechas que lo llevan a otra tasa. La cuenta corriente de cada cliente se ajusta sola
 * (un movimiento con la diferencia; no se borra nada). Solo dueños, y hay que haber bajado la copia de seguridad en los últimos 30 minutos.
 */
export async function aplicarEnvioAl21(): Promise<{ ok: boolean; error?: string; mensaje?: string }> {
  const usuario = await exigirUsuario();
  if (usuario.rol !== "DUENO") return { ok: false, error: "Solo un dueño puede hacer este cambio." };
  const empresa = await db.empresa.findUnique({ where: { id: "principal" }, select: { ultimaCopia: true } });
  if (!empresa?.ultimaCopia || Date.now() - empresa.ultimaCopia.getTime() > MINUTOS_COPIA * 60 * 1000) {
    return { ok: false, error: `Primero bajá la copia de seguridad (Empresa → “Descargar copia ahora”): tiene que ser de los últimos ${MINUTOS_COPIA} minutos.` };
  }
  const pedidos = await db.pedido.findMany({
    where: { conFactura: true, ivaPct: { gt: 0 }, estado: { in: ["PENDIENTE", "ENTREGADO"] }, items: { some: { nombre: "ENVÍO", OR: [{ ivaPct: null }, { ivaPct: { not: IVA_ENVIO } }] } } },
    select: { id: true },
  });
  if (pedidos.length === 0) return { ok: true, mensaje: "No había nada para cambiar." };
  await db.$transaction(async (tx) => {
    for (const p of pedidos) {
      await tx.pedidoItem.updateMany({ where: { pedidoId: p.id, nombre: "ENVÍO" }, data: { ivaPct: IVA_ENVIO } });
      await sincronizarCuentaPedido(tx, p.id, usuario.id);
    }
  }, { timeout: 60000 });
  revalidatePath("/", "layout");
  return { ok: true, mensaje: `Listo: el envío quedó al 21% en ${pedidos.length} ${pedidos.length === 1 ? "factura" : "facturas"} y la cuenta corriente se ajustó.` };
}
