"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { esPersonalDeOficina } from "@/lib/roles";
import { GENERALES } from "@/lib/tareas";
import { exigirOficina } from "@/lib/session";

export type Resultado = { error?: string };

/** "generales" = sin dueño (null en la base); si no, el id de la persona. */
const dueno = (id: string) => (id === GENERALES ? null : id);

// Todos los de oficina (gerente y administración) pueden hacer todo con cualquier tarea: cargar, tildar, editar, borrar, ordenar y pasar a otra persona.
export async function crearTarea(asignadaId: string, formData: FormData): Promise<Resultado> {
  const yo = await exigirOficina();
  const titulo = String(formData.get("titulo") ?? "").trim().replace(/\s+/g, " ");
  if (titulo.length < 2) return { error: "Escribí la tarea." };
  if (titulo.length > 200) return { error: "Es muy larga (máximo 200 letras)." };
  if (asignadaId !== GENERALES) {
    const persona = await db.usuario.findUnique({ where: { id: asignadaId }, select: { activo: true, rol: true } });
    if (!persona || !persona.activo || !esPersonalDeOficina(persona.rol)) return { error: "Esa persona no puede tener tareas." };
  }
  const ultima = await db.tarea.aggregate({ where: { asignadaId: dueno(asignadaId) }, _max: { orden: true } });
  await db.tarea.create({ data: { titulo, asignadaId: dueno(asignadaId), creadaPorId: yo.id, orden: (ultima._max.orden ?? 0) + 1 } }); // la nueva va al final de la lista
  revalidatePath("/", "layout"); // se actualizan el inicio, la lista y el numerito del menú
  return {};
}

export async function alternarTarea(id: string): Promise<Resultado> {
  await exigirOficina();
  const t = await db.tarea.findUnique({ where: { id } });
  if (!t) return {};
  const hecha = !t.hecha;
  await db.tarea.update({ where: { id }, data: { hecha, hechaEn: hecha ? new Date() : null } });
  revalidatePath("/", "layout"); // se actualizan el inicio, la lista y el numerito del menú
  return {};
}

/** Cambiar el texto de una tarea: cualquiera de oficina. */
export async function editarTarea(id: string, tituloNuevo: string): Promise<Resultado> {
  await exigirOficina();
  const titulo = String(tituloNuevo ?? "").trim().replace(/\s+/g, " ");
  if (titulo.length < 2) return { error: "Escribí la tarea." };
  if (titulo.length > 200) return { error: "Es muy larga (máximo 200 letras)." };
  const t = await db.tarea.findUnique({ where: { id }, select: { id: true } });
  if (!t) return { error: "Esa tarea ya no existe." };
  await db.tarea.update({ where: { id }, data: { titulo } });
  revalidatePath("/", "layout");
  return {};
}

export async function borrarTarea(id: string): Promise<Resultado> {
  await exigirOficina();
  await db.tarea.deleteMany({ where: { id } });
  revalidatePath("/", "layout"); // se actualizan el inicio, la lista y el numerito del menú
  return {};
}

/** Limpia de una vez las tareas ya hechas de una persona. */
export async function borrarHechas(asignadaId: string): Promise<Resultado> {
  await exigirOficina();
  await db.tarea.deleteMany({ where: { asignadaId: dueno(asignadaId), hecha: true } });
  revalidatePath("/", "layout"); // se actualizan el inicio, la lista y el numerito del menú
  return {};
}

/** Acomoda las tareas pendientes de una persona por prioridad: `ids` viene en el orden nuevo (la primera es la más importante). */
export async function ordenarTareas(asignadaId: string, ids: string[]): Promise<Resultado> {
  await exigirOficina();
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((i) => typeof i !== "string") || new Set(ids).size !== ids.length) return { error: "Orden no válido." };
  const propias = await db.tarea.count({ where: { asignadaId: dueno(asignadaId), id: { in: ids } } });
  if (propias !== ids.length) return { error: "Esas tareas no son de esa persona." };
  await db.$transaction(ids.map((id, i) => db.tarea.update({ where: { id }, data: { orden: i + 1 } })));
  revalidatePath("/", "layout");
  return {};
}

// Pasar una tarea pendiente a otra persona (arrastrándola). `ids` = cómo queda la lista de pendientes de la persona que la recibe (con la tarea movida adentro).
// La puede mover cualquiera de oficina.
export async function moverTarea(id: string, haciaId: string, ids: string[]): Promise<Resultado> {
  await exigirOficina();
  const t = await db.tarea.findUnique({ where: { id } });
  if (!t) return { error: "La tarea ya no existe." };
  if (t.hecha) return { error: "Una tarea hecha no se mueve." };
  if (haciaId !== GENERALES) {
    const persona = await db.usuario.findUnique({ where: { id: haciaId }, select: { activo: true, rol: true } });
    if (!persona || !persona.activo || !esPersonalDeOficina(persona.rol)) return { error: "Esa persona no puede tener tareas." };
  }
  if (!Array.isArray(ids) || !ids.includes(id) || ids.some((i) => typeof i !== "string") || new Set(ids).size !== ids.length) return { error: "Orden no válido." };
  const otras = ids.filter((i) => i !== id);
  const propias = await db.tarea.count({ where: { asignadaId: dueno(haciaId), hecha: false, id: { in: otras } } });
  if (propias !== otras.length) return { error: "La lista cambió, probá de nuevo." };
  await db.$transaction(ids.map((tid, i) => db.tarea.update({ where: { id: tid }, data: tid === id ? { asignadaId: dueno(haciaId), orden: i + 1 } : { orden: i + 1 } })));
  revalidatePath("/", "layout");
  return {};
}

/** "Me la quedo": una tarea de Generales pasa a la lista de quien la toca (al final de la suya). */
export async function tomarTarea(id: string): Promise<Resultado> {
  const yo = await exigirOficina();
  const t = await db.tarea.findUnique({ where: { id }, select: { asignadaId: true } });
  if (!t) return { error: "Esa tarea ya no existe." };
  if (t.asignadaId) return { error: "Esa tarea ya tiene dueño." };
  const ultima = await db.tarea.aggregate({ where: { asignadaId: yo.id }, _max: { orden: true } });
  await db.tarea.update({ where: { id }, data: { asignadaId: yo.id, orden: (ultima._max.orden ?? 0) + 1 } });
  revalidatePath("/", "layout");
  return {};
}
