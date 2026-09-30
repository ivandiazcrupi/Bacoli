"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { leerMonto } from "@/lib/numeros";
import { exigirOficina } from "@/lib/session";

export type EstadoPrecios = { error?: string; ok?: string } | undefined;

// Los campos se llaman "p_<listaId>_<productoId>". Vacío = sin precio cargado.
export async function guardarPrecios(_: EstadoPrecios, formData: FormData): Promise<EstadoPrecios> {
  await exigirOficina();
  const cambios: { listaId: string; productoId: string; precio: number | null }[] = [];
  for (const [clave, valor] of formData.entries()) {
    const m = /^p_(.+)_(.+)$/.exec(clave);
    if (!m || typeof valor !== "string") continue;
    const precio = leerMonto(valor);
    if (valor.trim() && precio === null) return { error: `El precio "${valor}" no es válido.` };
    cambios.push({ listaId: m[1], productoId: m[2], precio });
  }
  await db.$transaction(
    cambios.map(({ listaId, productoId, precio }) =>
      precio === null
        ? db.precio.deleteMany({ where: { listaId, productoId } })
        : db.precio.upsert({
            where: { listaId_productoId: { listaId, productoId } },
            update: { precio },
            create: { listaId, productoId, precio },
          }),
    ),
  );
  revalidatePath("/precios");
  return { ok: "Precios guardados." };
}

export async function agregarProducto(_: EstadoPrecios, formData: FormData): Promise<EstadoPrecios> {
  await exigirOficina();
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (nombre.length < 2) return { error: "Falta el nombre del producto." };
  if (await db.producto.findUnique({ where: { nombre } })) return { error: "Ya existe ese producto." };
  await db.producto.create({ data: { nombre } });
  revalidatePath("/precios");
  return { ok: `Producto "${nombre}" agregado.` };
}

export async function agregarLista(_: EstadoPrecios, formData: FormData): Promise<EstadoPrecios> {
  await exigirOficina();
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (nombre.length < 2) return { error: "Falta el nombre de la lista." };
  if (await db.listaPrecios.findUnique({ where: { nombre } })) return { error: "Ya existe esa lista." };
  await db.listaPrecios.create({ data: { nombre } });
  revalidatePath("/precios");
  return { ok: `Lista "${nombre}" agregada.` };
}
