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
  const ultima = await db.tarea.aggregate({ where: { asignadaId }, _max: { orden: true } });
  await db.tarea.create({ data: { titulo, asignadaId, creadaPorId: yo.id, orden: (ultima._max.orden ?? 0) + 1 } }); // la nueva va al final de la lista
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

/** El gerente acomoda las tareas pendientes de una persona por prioridad: `ids` viene en el orden nuevo (la primera es la más importante). */
export async function ordenarTareas(asignadaId: string, ids: string[]): Promise<Resultado> {
  const yo = await exigirOficina();
  if (!puedeGestionarUsuarios(yo.rol)) return { error: "Solo el gerente ordena las tareas." };
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((i) => typeof i !== "string") || new Set(ids).size !== ids.length) return { error: "Orden no válido." };
  const propias = await db.tarea.count({ where: { asignadaId, id: { in: ids } } });
  if (propias !== ids.length) return { error: "Esas tareas no son de esa persona." };
  await db.$transaction(ids.map((id, i) => db.tarea.update({ where: { id }, data: { orden: i + 1 } })));
  revalidatePath("/", "layout");
  return {};
}
