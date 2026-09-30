"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { leerMonto } from "@/lib/numeros";
import { exigirOficina } from "@/lib/session";

export type EstadoPrecios = { error?: string; ok?: string } | undefined;

const vacio = (v: FormDataEntryValue | null) => {
  const t = String(v ?? "").trim();
  return t ? t : null;
};

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

function errorProducto(e: unknown): EstadoPrecios {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    const campo = String((e.meta as { target?: string[] } | undefined)?.target ?? "");
    return { error: campo.includes("sku") ? "Ya hay un producto con ese código." : "Ya hay un producto con ese nombre." };
  }
  throw e;
}

export async function crearProducto(_: EstadoPrecios, formData: FormData): Promise<EstadoPrecios> {
  await exigirOficina();
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (nombre.length < 2) return { error: "Falta el nombre del producto." };
  try {
    await db.producto.create({
      data: {
        nombre,
        sku: vacio(formData.get("sku"))?.toUpperCase() ?? null,
        unidad: formData.get("unidad") === "unidad" ? "unidad" : "paquete",
      },
    });
  } catch (e) {
    return errorProducto(e);
  }
  revalidatePath("/precios");
  return { ok: `Producto "${nombre}" agregado. Ahora cargale el precio en la tabla.` };
}

export async function guardarProducto(productoId: string, _: EstadoPrecios, formData: FormData): Promise<EstadoPrecios> {
  await exigirOficina();
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (nombre.length < 2) return { error: "Falta el nombre del producto." };
  const ean = vacio(formData.get("ean"));
  if (ean && !/^\d{8,14}$/.test(ean)) return { error: "El EAN debe tener entre 8 y 14 números." };
  try {
    await db.producto.update({
      where: { id: productoId },
      data: {
        nombre,
        sku: vacio(formData.get("sku"))?.toUpperCase() ?? null,
        ean,
        descripcion: vacio(formData.get("descripcion")),
        unidad: formData.get("unidad") === "unidad" ? "unidad" : "paquete",
      },
    });
  } catch (e) {
    return errorProducto(e);
  }
  revalidatePath("/precios");
  return { ok: "Producto guardado." };
}

export async function agregarLista(_: EstadoPrecios, formData: FormData): Promise<EstadoPrecios> {
  await exigirOficina();
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (nombre.length < 2) return { error: "Falta el nombre de la lista." };
  if (await db.listaPrecios.findFirst({ where: { nombre: { equals: nombre, mode: "insensitive" } } })) return { error: "Ya existe esa lista." };
  await db.listaPrecios.create({ data: { nombre } });
  revalidatePath("/precios");
  return { ok: `Lista "${nombre}" agregada. Cargale los precios en la tabla.` };
}
