"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { aFecha, hoy } from "@/lib/fechas";
import { esPersonalDeOficina } from "@/lib/roles";
import { IDS_PRODUCCION } from "@/lib/produccion";
import { exigirProduccion } from "@/lib/session";

export type Resultado = { error?: string; ok?: string };

function entero(v: FormDataEntryValue | null) {
  const t = String(v ?? "").trim();
  if (t === "") return 0;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isInteger(n) && n >= 0 && n < 1_000_000 ? n : NaN;
}

/** "Empecé": deja anotada la hora de arranque de una tanda de ese producto (después se cierra con la cantidad). */
export async function empezarTanda(producto: string): Promise<Resultado> {
  const usuario = await exigirProduccion();
  if (!IDS_PRODUCCION.includes(producto)) return { error: "Producto no válido." };
  const abierta = await db.produccion.findFirst({ where: { producto, fin: null, fecha: aFecha(hoy()) } });
  if (abierta) return { error: "Ya hay una tanda empezada de ese producto." };
  await db.produccion.create({ data: { fecha: aFecha(hoy()), producto, inicio: new Date(), usuarioId: usuario.id } });
  revalidatePath("/produccion");
  return {};
}

/** Carga lo producido y el desperdicio. Si había una tanda empezada, la cierra; si no, anota una carga directa. */
export async function cargarProduccion(producto: string, formData: FormData): Promise<Resultado> {
  const usuario = await exigirProduccion();
  if (!IDS_PRODUCCION.includes(producto)) return { error: "Producto no válido." };
  const cantidad = entero(formData.get("cantidad"));
  const desperdicio = entero(formData.get("desperdicio"));
  if (Number.isNaN(cantidad) || Number.isNaN(desperdicio)) return { error: "Escribí números enteros (sin decimales)." };
  if (cantidad + desperdicio === 0) return { error: "Cargá la cantidad producida o el desperdicio." };

  const abierta = await db.produccion.findFirst({ where: { producto, fin: null, fecha: aFecha(hoy()) }, orderBy: { creadoEn: "asc" } });
  if (abierta) {
    await db.produccion.update({ where: { id: abierta.id }, data: { cantidad, desperdicio, fin: new Date() } });
  } else {
    await db.produccion.create({ data: { fecha: aFecha(hoy()), producto, cantidad, desperdicio, fin: new Date(), usuarioId: usuario.id } });
  }
  revalidatePath("/produccion");
  revalidatePath("/produccion/control");
  return { ok: "Cargado." };
}

/** Borra una carga o una tanda empezada: quien la cargó, el mismo día; la oficina, cualquiera. */
export async function borrarCarga(id: string): Promise<Resultado> {
  const usuario = await exigirProduccion();
  const t = await db.produccion.findUnique({ where: { id } });
  if (!t) return {};
  if (!esPersonalDeOficina(usuario.rol) && (t.usuarioId !== usuario.id || t.fecha.getTime() !== aFecha(hoy()).getTime())) {
    return { error: "Solo podés borrar tus cargas de hoy." };
  }
  await db.produccion.delete({ where: { id } });
  revalidatePath("/produccion");
  revalidatePath("/produccion/control");
  return {};
}
