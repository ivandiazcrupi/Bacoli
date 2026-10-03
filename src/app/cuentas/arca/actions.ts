"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { decodificar, esLibroIvaAlicuotas, esLibroIvaVentas, leerArchivoArca, leerLibroIvaVentas } from "@/lib/arca";
import { exigirOficina } from "@/lib/session";

export type EstadoArca = { ok?: string; error?: string; avisos?: string[] } | undefined;

// Trae el archivo "Mis Comprobantes Emitidos" de ARCA. Por ahora solo guarda los comprobantes para compararlos con los pedidos:
// no cambia la cuenta corriente ni los pedidos. Subir el mismo archivo dos veces no duplica nada.
export async function importarArca(_: EstadoArca, formData: FormData): Promise<EstadoArca> {
  const usuario = await exigirOficina();
  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return { error: "Elegí el archivo que bajaste de ARCA." };
  if (archivo.size > 8_000_000) return { error: "El archivo es demasiado grande (más de 8 MB)." };
  const texto = decodificar(await archivo.arrayBuffer());
  if (esLibroIvaAlicuotas(texto)) return { error: "Ese es el archivo de ALÍCUOTAS. Subí el de VENTAS (el que trae el nombre y el importe de cada comprobante)." };
  const lectura = esLibroIvaVentas(texto) ? leerLibroIvaVentas(texto) : leerArchivoArca(texto);
  if (lectura.filas.length === 0) return { error: lectura.errores[0] ?? "No encontré comprobantes en el archivo." };

  const existentes = await db.comprobanteArca.findMany({ where: { numero: { in: [...new Set(lectura.filas.map((f) => f.numero))] } }, select: { tipo: true, puntoVenta: true, numero: true } });
  const ya = new Set(existentes.map((e) => `${e.tipo}-${e.puntoVenta}-${e.numero}`));
  const nuevas = lectura.filas.filter((f) => !ya.has(`${f.tipo}-${f.puntoVenta}-${f.numero}`));
  if (nuevas.length) {
    await db.comprobanteArca.createMany({
      data: nuevas.map((f) => ({ tipo: f.tipo, puntoVenta: f.puntoVenta, numero: f.numero, fecha: new Date(`${f.fecha}T00:00:00Z`), cuitReceptor: f.cuitReceptor, razonSocial: f.razonSocial, total: f.total, cae: f.cae, esNotaCredito: f.esNotaCredito, importadoPor: usuario.nombre })),
      skipDuplicates: true,
    });
  }
  revalidatePath("/cuentas", "layout");
  const avisos = [...lectura.errores.slice(0, 5), ...(lectura.ignoradas ? [`${lectura.ignoradas} notas de débito ignoradas.`] : [])];
  return { ok: `Listo: ${nuevas.length} comprobantes nuevos${lectura.filas.length - nuevas.length ? ` y ${lectura.filas.length - nuevas.length} que ya estaban` : ""}.`, avisos };
}
