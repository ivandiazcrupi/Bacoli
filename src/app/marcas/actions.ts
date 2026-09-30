"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { leerMonto } from "@/lib/numeros";
import { exigirOficina } from "@/lib/session";
import { valoresDe, type EstadoForm } from "../clientes/validacion";

export async function crearMarca(_: EstadoForm, formData: FormData): Promise<EstadoForm> {
  await exigirOficina();
  const nombre = String(formData.get("nombre") ?? "").replace(/\s+/g, " ").trim().toUpperCase();
  if (nombre.length < 2) return { error: "Falta el nombre de la marca.", valores: valoresDe(formData) };
  if (await db.marca.findFirst({ where: { nombre: { equals: nombre, mode: "insensitive" } } })) {
    return { error: "Ya existe una marca con ese nombre.", valores: valoresDe(formData) };
  }
  const marca = await db.marca.create({ data: { nombre } });
  revalidatePath("/marcas");
  redirect(`/marcas/${marca.id}`);
}

// Campos "pe_<productoId>". Vacío = la marca no tiene precio propio para ese producto.
export async function guardarPreciosMarca(marcaId: string, _: EstadoForm, formData: FormData): Promise<EstadoForm> {
  await exigirOficina();
  const valores = valoresDe(formData);
  const productos = await db.producto.findMany({ where: { activo: true } });
  const operaciones = [];
  for (const p of productos) {
    const texto = String(formData.get(`pe_${p.id}`) ?? "");
    const precio = leerMonto(texto);
    if (texto.trim() && precio === null) return { error: `${p.nombre}: "${texto}" no es un precio válido.`, valores };
    operaciones.push(
      precio === null
        ? db.precioMarca.deleteMany({ where: { marcaId, productoId: p.id } })
        : db.precioMarca.upsert({
            where: { marcaId_productoId: { marcaId, productoId: p.id } },
            update: { precio },
            create: { marcaId, productoId: p.id, precio },
          }),
    );
  }
  await db.$transaction(operaciones);
  revalidatePath(`/marcas/${marcaId}`);
  return { ok: "Precios de la marca guardados." };
}
