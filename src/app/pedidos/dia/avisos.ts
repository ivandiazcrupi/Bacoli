"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { aFecha, esFechaValida } from "@/lib/fechas";
import { armarAviso, crearEnvio, envioConfigurado } from "@/lib/avisos-email";
import { exigirOficina } from "@/lib/session";

/** Pedidos de la tienda de ese día a los que todavía no se les avisó (o se les avisó para otro día) y que tienen email. */
const paraAvisar = (fecha: string) => ({
  origen: "WEB" as const,
  estado: "PENDIENTE" as const,
  fechaEntrega: aFecha(fecha),
  webEmail: { not: null },
  OR: [{ webAvisoDia: null }, { webAvisoDia: { not: fecha } }],
});

export async function datosAvisos(fecha: string) {
  const [pendientes, avisados, sinEmail, empresa] = await Promise.all([
    db.pedido.count({ where: paraAvisar(fecha) }),
    db.pedido.count({ where: { origen: "WEB", estado: "PENDIENTE", fechaEntrega: aFecha(fecha), webAvisoDia: fecha } }),
    db.pedido.count({ where: { origen: "WEB", estado: "PENDIENTE", fechaEntrega: aFecha(fecha), webEmail: null } }),
    db.empresa.findUnique({ where: { id: "principal" }, select: { avisoHorario: true } }),
  ]);
  return { pendientes, avisados, sinEmail, horario: empresa?.avisoHorario?.trim() ?? "" };
}

/** Manda el aviso por email a los clientes de la tienda que reciben su pedido ese día. Un mail por pedido; nunca repite el mismo día. */
export async function enviarAvisosDia(fecha: string): Promise<{ ok: boolean; mensaje: string }> {
  await exigirOficina();
  if (!esFechaValida(fecha)) return { ok: false, mensaje: "Fecha no válida." };
  if (!envioConfigurado()) return { ok: false, mensaje: "Falta conectar la casilla de envío (variables GMAIL_ENVIO_USUARIO y GMAIL_ENVIO_CLAVE_APP en Railway)." };
  const empresa = await db.empresa.findUnique({ where: { id: "principal" } });
  const horario = empresa?.avisoHorario?.trim();
  if (!horario) return { ok: false, mensaje: "Falta cargar el horario del aviso (Empresa → Aviso por email)." };

  const pedidos = await db.pedido.findMany({ where: paraAvisar(fecha), select: { id: true, webEmail: true, webNombre: true, webOrden: true } });
  if (pedidos.length === 0) return { ok: true, mensaje: "No hay clientes para avisar: ya están avisados o no tienen email." };
  const enviar = crearEnvio();
  let enviados = 0;
  const fallaron: string[] = [];
  for (const p of pedidos) {
    const { asunto, texto } = armarAviso(empresa?.avisoTexto ?? null, { nombre: p.webNombre ?? "", orden: p.webOrden ?? "", fecha, horario });
    try {
      await enviar(p.webEmail!, asunto, texto, empresa?.email);
      await db.pedido.update({ where: { id: p.id }, data: { webAvisoEn: new Date(), webAvisoDia: fecha } });
      enviados++;
    } catch {
      fallaron.push(p.webOrden ?? p.id);
    }
  }
  revalidatePath(`/pedidos/dia/${fecha}`);
  const falla = fallaron.length ? ` No se pudo enviar a: ${fallaron.map((o) => `#${o}`).join(", ")} (revisá el email de esos pedidos o probá de nuevo).` : "";
  return { ok: enviados > 0 || fallaron.length === 0, mensaje: `Se enviaron ${enviados} ${enviados === 1 ? "aviso" : "avisos"}.${falla}` };
}
