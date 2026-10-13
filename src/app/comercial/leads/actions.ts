"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { esFechaValida } from "@/lib/fechas";
import { estadoValido, nombreEstado, TIPOS_CONTACTO } from "@/lib/leads";
import { mayus, titulo } from "@/lib/mayusculas";
import { exigirOficina } from "@/lib/session";

export type EstadoLeadForm = { error?: string; valores?: Record<string, string> } | undefined;

const txt = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const opc = (f: FormData, k: string) => txt(f, k) || null;

function leerLead(f: FormData) {
  const proximo = txt(f, "proximoContacto");
  return {
    nombre: mayus(txt(f, "nombre")),
    contacto: opc(f, "contacto") ? titulo(txt(f, "contacto")) : null,
    telefono: opc(f, "telefono"),
    email: opc(f, "email") ? txt(f, "email").toLowerCase() : null,
    barrio: opc(f, "barrio") ? mayus(txt(f, "barrio")) : null,
    direccion: opc(f, "direccion") ? titulo(txt(f, "direccion")) : null,
    origen: opc(f, "origen"),
    interes: opc(f, "interes"),
    notas: opc(f, "notas"),
    vendedor: opc(f, "vendedor") ? titulo(txt(f, "vendedor")) : null,
    proximoContacto: proximo && esFechaValida(proximo) ? proximo : null,
  };
}

export async function crearLead(_: EstadoLeadForm, f: FormData): Promise<EstadoLeadForm> {
  const u = await exigirOficina();
  const valores = Object.fromEntries([...f.entries()].map(([k, v]) => [k, String(v)]));
  const d = leerLead(f);
  if (d.nombre.length < 2) return { error: "Falta el nombre del comercio o de la persona.", valores };
  if (!d.telefono && !d.email && !d.contacto) return { error: "Cargá al menos un dato para poder contactarlo (teléfono, email o persona).", valores };
  const lead = await db.lead.create({
    data: { ...d, vendedor: d.vendedor ?? titulo(u.nombre), contactos: { create: { tipo: "NOTA", texto: "Lead cargado.", usuario: u.nombre } } },
  });
  revalidatePath("/comercial/leads");
  redirect(`/comercial/leads/${lead.id}`);
}

export async function guardarLead(id: string, _: EstadoLeadForm, f: FormData): Promise<EstadoLeadForm> {
  await exigirOficina();
  const valores = Object.fromEntries([...f.entries()].map(([k, v]) => [k, String(v)]));
  const d = leerLead(f);
  if (d.nombre.length < 2) return { error: "Falta el nombre.", valores };
  await db.lead.update({ where: { id }, data: d });
  revalidatePath(`/comercial/leads/${id}`);
  revalidatePath("/comercial/leads");
  return { valores: { ok: "1" } };
}

// Anota algo en el historial (le escribí, me respondió, lo llamé…) y, si se quiere, programa el próximo contacto.
// Si estaba NUEVO y se le escribió/llamó, pasa solo a CONTACTADO.
export async function registrarContacto(id: string, f: FormData) {
  const u = await exigirOficina();
  const tipo = txt(f, "tipo");
  if (!TIPOS_CONTACTO.some(([k]) => k === tipo)) return;
  const texto = txt(f, "texto") || null;
  const proximo = txt(f, "proximoContacto");
  const lead = await db.lead.findUnique({ where: { id }, select: { estado: true } });
  if (!lead) return;
  const pasaAContactado = lead.estado === "NUEVO" && ["WHATSAPP", "LLAMADA", "VISITA", "MUESTRA", "RESPUESTA"].includes(tipo);
  const nuevoEstado = tipo === "MUESTRA" && ["NUEVO", "CONTACTADO"].includes(lead.estado) ? "MUESTRA" : pasaAContactado ? "CONTACTADO" : undefined;
  await db.$transaction([
    db.leadContacto.create({ data: { leadId: id, tipo, texto, usuario: u.nombre } }),
    db.lead.update({
      where: { id },
      data: { ...(nuevoEstado ? { estado: nuevoEstado } : {}), ...(proximo && esFechaValida(proximo) ? { proximoContacto: proximo } : {}) },
    }),
  ]);
  revalidatePath(`/comercial/leads/${id}`);
  revalidatePath("/comercial/leads");
}

export async function cambiarEstadoLead(id: string, f: FormData) {
  const u = await exigirOficina();
  const estado = txt(f, "estado");
  if (!estadoValido(estado)) return;
  const motivo = txt(f, "motivo") || null;
  await db.$transaction([
    db.lead.update({ where: { id }, data: { estado, motivoPerdida: estado === "PERDIDO" ? motivo : null, ...(estado === "GANADO" || estado === "PERDIDO" ? { proximoContacto: null } : {}) } }),
    db.leadContacto.create({ data: { leadId: id, tipo: "ESTADO", texto: `Pasó a ${nombreEstado(estado)}${estado === "PERDIDO" && motivo ? ` · ${motivo}` : ""}`, usuario: u.nombre } }),
  ]);
  revalidatePath(`/comercial/leads/${id}`);
  revalidatePath("/comercial/leads");
}

export async function borrarProximo(id: string) {
  await exigirOficina();
  await db.lead.update({ where: { id }, data: { proximoContacto: null } });
  revalidatePath(`/comercial/leads/${id}`);
  revalidatePath("/comercial/leads");
}

// Borra UN lead (con su historial). Solo dueños; la pantalla pide confirmar.
export async function eliminarLead(id: string) {
  const u = await exigirOficina();
  if (u.rol !== "DUENO") return;
  await db.lead.delete({ where: { id } });
  revalidatePath("/comercial/leads");
  redirect("/comercial/leads");
}
