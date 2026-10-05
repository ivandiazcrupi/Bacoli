"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mayus } from "@/lib/mayusculas";
import { leerMonto } from "@/lib/numeros";
import { exigirOficina } from "@/lib/session";
import { valoresDe } from "../clientes/validacion";

export type EstadoPrecios = { error?: string; ok?: string; valores?: Record<string, string> } | undefined;

const vacio = (v: FormDataEntryValue | null) => {
  const t = String(v ?? "").trim();
  return t ? t : null;
};
/** Los nombres de producto van siempre en mayúscula. */
const mayuscula = (t: string) => mayus(t);

// Precios de UNA lista. Los campos se llaman "p_<productoId>". Vacío = sin precio cargado.
export async function guardarPrecios(listaId: string, _: EstadoPrecios, formData: FormData): Promise<EstadoPrecios> {
  await exigirOficina();
  const cambios: { productoId: string; precio: number | null }[] = [];
  for (const [clave, valor] of formData.entries()) {
    const m = /^p_(.+)$/.exec(clave);
    if (!m || typeof valor !== "string") continue;
    const precio = leerMonto(valor);
    if (valor.trim() && precio === null) return { error: `El precio "${valor}" no es válido.`, valores: valoresDe(formData) };
    cambios.push({ productoId: m[1], precio });
  }
  await db.$transaction(
    cambios.map(({ productoId, precio }) =>
      precio === null
        ? db.precio.deleteMany({ where: { listaId, productoId } })
        : db.precio.upsert({
            where: { listaId_productoId: { listaId, productoId } },
            update: { precio },
            create: { listaId, productoId, precio },
          }),
    ),
  );
  revalidatePath("/productos");
  return { ok: "Precios guardados." };
}

function errorProducto(e: unknown, formData: FormData): EstadoPrecios {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    const campo = String((e.meta as { target?: string[] } | undefined)?.target ?? "");
    return { error: campo.includes("sku") ? "Ya hay un producto con ese código." : "Ya hay un producto con ese nombre.", valores: valoresDe(formData) };
  }
  throw e;
}

export async function crearProducto(_: EstadoPrecios, formData: FormData): Promise<EstadoPrecios> {
  await exigirOficina();
  const nombre = mayuscula(String(formData.get("nombre") ?? ""));
  if (nombre.length < 2) return { error: "Falta el nombre del producto.", valores: valoresDe(formData) };
  // Va al final de los productos.
  const ultimo = await db.producto.aggregate({ _max: { orden: true } });
  try {
    await db.producto.create({
      data: {
        nombre,
        sku: vacio(formData.get("sku"))?.toUpperCase() ?? null,
        unidad: formData.get("unidad") === "unidad" ? "unidad" : "paquete",
        orden: (ultimo._max.orden ?? 0) + 1,
      },
    });
  } catch (e) {
    return errorProducto(e, formData);
  }
  revalidatePath("/productos");
  return { ok: `Producto "${nombre}" agregado. Ahora cargale el precio en cada lista.` };
}

export async function guardarProducto(productoId: string, _: EstadoPrecios, formData: FormData): Promise<EstadoPrecios> {
  await exigirOficina();
  const nombre = mayuscula(String(formData.get("nombre") ?? ""));
  if (nombre.length < 2) return { error: "Falta el nombre del producto.", valores: valoresDe(formData) };
  const ean = vacio(formData.get("ean"));
  if (ean && !/^\d{8,14}$/.test(ean)) return { error: "El EAN debe tener entre 8 y 14 números.", valores: valoresDe(formData) };
  const orden = Number(formData.get("orden"));
  if (!Number.isInteger(orden) || orden < 0 || orden > 9999) return { error: "El orden tiene que ser un número entero (1, 2, 3…).", valores: valoresDe(formData) };
  try {
    await db.producto.update({
      where: { id: productoId },
      data: {
        nombre,
        orden,
        sku: vacio(formData.get("sku"))?.toUpperCase() ?? null,
        ean,
        descripcion: mayus(vacio(formData.get("descripcion"))),
        unidad: formData.get("unidad") === "unidad" ? "unidad" : "paquete",
        ivaPct: [10.5, 21].includes(leerMonto(String(formData.get("ivaPct") ?? "")) ?? -1) ? leerMonto(String(formData.get("ivaPct") ?? "")) : null,
      },
    });
  } catch (e) {
    return errorProducto(e, formData);
  }
  revalidatePath("/productos");
  return { ok: "Producto guardado." };
}

// Crea la lista, opcionalmente copiando los precios de otra, y la deja abierta para editar.
export async function crearLista(_: EstadoPrecios, formData: FormData): Promise<EstadoPrecios> {
  await exigirOficina();
  const nombre = mayus(String(formData.get("nombre") ?? ""));
  if (nombre.length < 2) return { error: "Falta el nombre de la lista.", valores: valoresDe(formData) };
  if (await db.listaPrecios.findFirst({ where: { nombre: { equals: nombre, mode: "insensitive" } } })) return { error: "Ya existe una lista con ese nombre.", valores: valoresDe(formData) };

  const copiarDe = vacio(formData.get("copiarDe"));
  // Va al final de las listas (después de Mayorista, Distribuidor y las que ya había).
  const ultima = await db.listaPrecios.aggregate({ _max: { orden: true } });
  const nueva = await db.listaPrecios.create({ data: { nombre, orden: (ultima._max.orden ?? 0) + 1 } });
  if (copiarDe) {
    const origen = await db.precio.findMany({ where: { listaId: copiarDe } });
    if (origen.length) await db.precio.createMany({ data: origen.map((p) => ({ listaId: nueva.id, productoId: p.productoId, precio: p.precio })) });
  }
  revalidatePath("/productos");
  redirect("/productos");
}

// Un producto desactivado no aparece al cargar pedidos (los pedidos viejos lo conservan).
export async function cambiarActivoProducto(productoId: string, activar: boolean) {
  await exigirOficina();
  await db.producto.update({ where: { id: productoId }, data: { activo: activar } });
  revalidatePath("/productos");
}
