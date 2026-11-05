"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { esPersonalDeOficina, puedeGestionarUsuarios } from "@/lib/roles";
import { exigirOficina } from "@/lib/session";

export type Resultado = { error?: string };

// Cargar y borrar tareas: solo el gerente. Tildar: cada uno las suyas (el gerente, cualquiera).
export async function crearTarea(asignadaId: string, formData: FormData): Promise<Resultado> {
  const yo = await exigirOficina();
  if (!puedeGestionarUsuarios(yo.rol)) return { error: "Solo el gerente carga tareas." };
  const titulo = String(formData.get("titulo") ?? "").trim().replace(/\s+/g, " ");
  if (titulo.length < 2) return { error: "Escribí la tarea." };
  if (titulo.length > 200) return { error: "Es muy larga (máximo 200 letras)." };
  const persona = await db.usuario.findUnique({ where: { id: asignadaId }, select: { activo: true, rol: true } });
  if (!persona || !persona.activo || !esPersonalDeOficina(persona.rol)) return { error: "Esa persona no puede tener tareas." };
  await db.tarea.create({ data: { titulo, asignadaId, creadaPorId: yo.id } });
  revalidatePath("/", "layout"); // se actualizan el inicio, la lista y el numerito del menú
  return {};
}

export async function alternarTarea(id: string): Promise<Resultado> {
  const yo = await exigirOficina();
  const t = await db.tarea.findUnique({ where: { id } });
  if (!t) return {};
  if (t.asignadaId !== yo.id && !puedeGestionarUsuarios(yo.rol)) return { error: "Solo la persona a la que se le asignó puede tildarla." };
  const hecha = !t.hecha;
  await db.tarea.update({ where: { id }, data: { hecha, hechaEn: hecha ? new Date() : null } });
  revalidatePath("/", "layout"); // se actualizan el inicio, la lista y el numerito del menú
  return {};
}

export async function borrarTarea(id: string): Promise<Resultado> {
  const yo = await exigirOficina();
  if (!puedeGestionarUsuarios(yo.rol)) return { error: "Solo el gerente borra tareas." };
  await db.tarea.deleteMany({ where: { id } });
  revalidatePath("/", "layout"); // se actualizan el inicio, la lista y el numerito del menú
  return {};
}

/** El gerente limpia de una vez las tareas ya hechas de una persona. */
export async function borrarHechas(asignadaId: string): Promise<Resultado> {
  const yo = await exigirOficina();
  if (!puedeGestionarUsuarios(yo.rol)) return { error: "Solo el gerente borra tareas." };
  await db.tarea.deleteMany({ where: { asignadaId, hecha: true } });
  revalidatePath("/", "layout"); // se actualizan el inicio, la lista y el numerito del menú
  return {};
}
