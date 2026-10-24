"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { armarAviso, ASUNTO_AVISO, crearEnvio, envioConfigurado, HORARIO_AVISO, TEXTO_AVISO } from "@/lib/avisos-email";
import { exigirOficina } from "@/lib/session";

export type ConfigAviso = { dia: string; horario: string; texto: string; asunto: string };

export async function leerConfigAviso(): Promise<ConfigAviso> {
  const e = await db.empresa.findUnique({ where: { id: "principal" }, select: { avisoDia: true, avisoHorario: true, avisoTexto: true, avisoAsunto: true } });
  return { dia: e?.avisoDia ?? "", horario: e?.avisoHorario?.trim() || HORARIO_AVISO, texto: e?.avisoTexto?.trim() || TEXTO_AVISO, asunto: e?.avisoAsunto?.trim() || ASUNTO_AVISO };
}

/** Guarda el mail armado: el día, el horario y el texto (con {nombre}, {dia} y {horario}). */
export async function guardarConfigAviso(c: ConfigAviso): Promise<{ ok: boolean; mensaje: string }> {
  await exigirOficina();
  const texto = c.texto.trim();
  if (texto.length < 10) return { ok: false, mensaje: "El texto del mail está vacío o es muy corto." };
  const datos = { avisoDia: c.dia.trim() || null, avisoHorario: c.horario.trim() || null, avisoTexto: texto === TEXTO_AVISO ? null : texto, avisoAsunto: c.asunto.trim() && c.asunto.trim() !== ASUNTO_AVISO ? c.asunto.trim() : null };
  await db.empresa.upsert({ where: { id: "principal" }, update: datos, create: { id: "principal", ...datos } });
  revalidatePath("/pedidos", "layout");
  return { ok: true, mensaje: "Mail guardado. Los próximos avisos salen así." };
}

async function pedidoParaAvisar(pedidoId: string) {
  const p = await db.pedido.findUnique({ where: { id: pedidoId }, select: { id: true, origen: true, estado: true, webEmail: true, webNombre: true, webOrden: true, webAvisoEn: true } });
  if (!p || p.origen !== "WEB") return { error: "Solo los pedidos de la tienda online llevan aviso por email." } as const;
  if (!p.webEmail) return { error: "Este pedido no tiene email: cargalo en “Editar pedido”." } as const;
  if (p.webAvisoEn) return { error: "A este cliente ya se le mandó el email. Si necesitás escribirle algo más, hacelo a mano." } as const;
  if (p.estado === "CANCELADO") return { error: "El pedido está cancelado." } as const;
  const cfg = await leerConfigAviso();
  if (/\{dia\}/.test(cfg.texto + cfg.asunto) && !cfg.dia) return { error: "Falta el día del mail: cargalo en Pedidos → Minoristas (web) → Email al cliente." } as const;
  return { p, cfg } as const;
}

/** Cómo va a quedar el mail de este pedido (para mostrarlo antes de confirmar). */
export async function prepararAviso(pedidoId: string): Promise<{ ok: boolean; error?: string; para?: string; asunto?: string; texto?: string }> {
  await exigirOficina();
  const r = await pedidoParaAvisar(pedidoId);
  if ("error" in r) return { ok: false, error: r.error };
  if (!envioConfigurado()) return { ok: false, error: "Falta conectar la casilla de envío (variables GMAIL_ENVIO_USUARIO y GMAIL_ENVIO_CLAVE_APP en Railway)." };
  const m = armarAviso(r.cfg.texto, { nombre: r.p.webNombre ?? "", dia: r.cfg.dia, horario: r.cfg.horario, orden: r.p.webOrden ?? "", asunto: r.cfg.asunto });
  return { ok: true, para: r.p.webEmail!, ...m };
}

/** Manda el mail a este cliente y deja anotado que se emitió. */
export async function enviarAviso(pedidoId: string): Promise<{ ok: boolean; error?: string; cuando?: string }> {
  await exigirOficina();
  const r = await pedidoParaAvisar(pedidoId);
  if ("error" in r) return { ok: false, error: r.error };
  if (!envioConfigurado()) return { ok: false, error: "Falta conectar la casilla de envío." };
  const empresa = await db.empresa.findUnique({ where: { id: "principal" }, select: { email: true } });
  const m = armarAviso(r.cfg.texto, { nombre: r.p.webNombre ?? "", dia: r.cfg.dia, horario: r.cfg.horario, orden: r.p.webOrden ?? "", asunto: r.cfg.asunto });
  try {
    await crearEnvio()(r.p.webEmail!, m.asunto, m.texto, empresa?.email);
  } catch {
    return { ok: false, error: "No se pudo enviar el mail. Revisá el email del cliente y probá de nuevo en unos minutos." };
  }
  const ahora = new Date();
  await db.pedido.update({ where: { id: pedidoId }, data: { webAvisoEn: ahora, webAvisoDia: r.cfg.dia || null } });
  revalidatePath("/pedidos", "layout");
  return { ok: true, cuando: ahora.toISOString() };
}
