import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

// Copia de seguridad: todas las tablas del sistema en un solo archivo JSON (para guardar en Drive o donde quieran).
// Se restaura con "npm run db:restaurar -- archivo.json" (ver docs/PUBLICAR.md).
const minuscula1 = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export async function generarCopia() {
  const modelos = Prisma.dmmf.datamodel.models.map((m) => m.name);
  const tablas: Record<string, unknown[]> = {};
  const conteo: Record<string, number> = {};
  // Una sola transacción de lectura: la copia es una foto coherente de un mismo instante.
  await db.$transaction(async (tx) => {
    for (const nombre of modelos) {
      const filas = await (tx as unknown as Record<string, { findMany: () => Promise<unknown[]> }>)[minuscula1(nombre)].findMany();
      tablas[nombre] = filas;
      conteo[nombre] = filas.length;
    }
  }, { timeout: 60000 });
  return { sistema: "BACOLI", version: 1, fecha: new Date().toISOString(), conteo, tablas };
}

/** Pasa a texto (las fechas y los montos Decimal salen como texto) y deja el archivo listo para descargar. */
export const aTexto = (copia: unknown) => JSON.stringify(copia);
