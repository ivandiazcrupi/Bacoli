"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { analizar, leerCsv, MARCAS_INICIALES, type Analisis, type Opciones } from "@/lib/importar-clientes";
import { exigirOficina } from "@/lib/session";

export type EstadoImport = {
  error?: string;
  ok?: string;
  csv?: string;
  opciones?: Opciones;
  zonaPorBarrio?: Record<string, string>; // barrio canónico -> nombre de zona elegida
  analisis?: Analisis;
  existentes?: string[]; // nombres que ya estaban cargados y no se tocan
} | undefined;

const LIMITE_BYTES = 2_000_000;

function leerOpciones(formData: FormData): Opciones {
  const marcas = String(formData.get("marcas") ?? MARCAS_INICIALES.join(", "))
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return {
    marcas,
    separarMismoCuit: formData.get("separarMismoCuit") === "on",
    bajaYContactar: formData.get("bajaYContactar") === "NO_IMPORTAR" ? "NO_IMPORTAR" : "DESACTIVADOS",
  };
}

async function textoCsv(formData: FormData): Promise<string | { error: string }> {
  const archivo = formData.get("archivo");
  if (archivo instanceof File && archivo.size > 0) {
    if (archivo.size > LIMITE_BYTES) return { error: "El archivo es demasiado grande." };
    return await archivo.text();
  }
  const guardado = String(formData.get("csv") ?? "");
  return guardado || { error: "Elegí un archivo CSV." };
}

async function calcular(formData: FormData) {
  const csv = await textoCsv(formData);
  if (typeof csv !== "string") return csv;
  const filas = leerCsv(csv);
  if (filas.length === 0 || !("nombre" in filas[0])) return { error: "No pude leer el archivo. Tiene que ser un CSV con una columna 'Nombre'." };

  const opciones = leerOpciones(formData);
  const analisis = analizar(filas, opciones);

  const zonaPorBarrio: Record<string, string> = {};
  for (const b of analisis.barrios) {
    zonaPorBarrio[b.barrio] = String(formData.get(`zona_${b.barrio}`) ?? "") || b.propuesta || "";
  }
  const existentes = await db.cliente.findMany({
    where: { nombre: { in: analisis.clientes.map((c) => c.nombre), mode: "insensitive" } },
    select: { nombre: true },
  });
  return { csv, opciones, analisis, zonaPorBarrio, existentes: existentes.map((e) => e.nombre) };
}

export async function previsualizar(_: EstadoImport, formData: FormData): Promise<EstadoImport> {
  await exigirOficina();
  const r = await calcular(formData);
  if ("error" in r) return { error: r.error };
  return r;
}

export async function importar(_: EstadoImport, formData: FormData): Promise<EstadoImport> {
  await exigirOficina();
  const r = await calcular(formData); // se recalcula en el servidor: no se confía en la vista previa
  if ("error" in r) return { error: r.error };

  const faltan = r.analisis.barrios.filter((b) => !r.zonaPorBarrio[b.barrio]);
  if (faltan.length) return { ...r, error: `Falta elegir la zona de: ${faltan.map((b) => b.titulo).join(", ")}.` };

  const [zonas, listas] = await Promise.all([db.zona.findMany(), db.listaPrecios.findMany()]);
  const zonaId = new Map(zonas.map((z) => [z.nombre, z.id]));
  const listaId = (nombre: string) => listas.find((l) => l.nombre.toLowerCase() === nombre.toLowerCase())?.id ?? null;
  const yaExisten = new Set(r.existentes.map((n) => n.toLowerCase()));

  // Las marcas se crean si faltan (una por nombre) y se asignan a sus clientes.
  const nombresMarcas = [...new Set(r.analisis.clientes.map((c) => c.marca).filter((m): m is string => !!m))];
  for (const nombre of nombresMarcas) {
    if (!(await db.marca.findFirst({ where: { nombre: { equals: nombre, mode: "insensitive" } } }))) await db.marca.create({ data: { nombre } });
  }
  const marcas = await db.marca.findMany();
  const marcaId = (nombre: string | null) => (nombre ? marcas.find((m) => m.nombre.toLowerCase() === nombre.toLowerCase())?.id ?? null : null);

  const nuevos = r.analisis.clientes.filter((c) => !yaExisten.has(c.nombre.toLowerCase()));
  if (nuevos.length === 0) return { ...r, error: "No hay clientes nuevos para importar (todos ya existen)." };

  await db.$transaction(
    nuevos.map((c) =>
      db.cliente.create({
        data: {
          nombre: c.nombre,
          tipo: c.tipo,
          razonSocial: c.razonSocial,
          cuit: c.cuit,
          activo: c.activo,
          marcaId: marcaId(c.marca),
          comisionista: c.comisionista,
          comisionPct: c.comisionPct,
          listaPreciosId: listaId(c.tipo === "DISTRIBUIDOR" ? "Distribuidor" : "Mayorista"),
          puntos: {
            create: c.sucursales.map((s) => ({
              alias: s.alias,
              direccion: s.direccion,
              barrio: r.analisis.barrios.find((b) => b.barrio === s.barrio)?.titulo ?? s.barrio,
              zonaId: zonaId.get(r.zonaPorBarrio[s.barrio])!,
              telefono: s.telefono,
              activo: s.activo,
            })),
          },
        },
      }),
    ),
  );

  revalidatePath("/clientes");
  return { ok: `Listo: se importaron ${nuevos.length} clientes.${yaExisten.size ? ` (${r.existentes.length} ya existían y no se tocaron.)` : ""}` };
}
