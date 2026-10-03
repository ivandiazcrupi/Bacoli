import { db } from "@/lib/db";
import { aFecha } from "@/lib/fechas";

export type EstadoDia = "ARMANDO" | "LISTA" | "CERRADA";

/** En qué estado está la hoja de ruta de un día: armando (todo se mueve), lista (estructura inamovible) o cerrada (solo lectura). */
export async function estadoDelDia(fecha: Date | string): Promise<{ estado: EstadoDia; por: string | null; cuando: Date | null }> {
  const f = typeof fecha === "string" ? aFecha(fecha) : fecha;
  const [cerrado, listo] = await Promise.all([db.diaCerrado.findUnique({ where: { fecha: f } }), db.diaListo.findUnique({ where: { fecha: f } })]);
  if (cerrado) return { estado: "CERRADA", por: cerrado.cerradoPor, cuando: cerrado.cerradoEn };
  if (listo) return { estado: "LISTA", por: listo.listoPor, cuando: listo.listoEn };
  return { estado: "ARMANDO", por: null, cuando: null };
}

/** Mensaje de error si la hoja de ese día ya no se puede reorganizar (lista o cerrada); null si todavía se arma. */
export async function errorSiHojaFija(fecha: Date | null | undefined): Promise<string | null> {
  if (!fecha) return null;
  const { estado } = await estadoDelDia(fecha);
  if (estado === "ARMANDO") return null;
  return estado === "LISTA" ? "La hoja de ese día está lista: hay que reabrirla para cambiar esto." : "Ese día está cerrado: un dueño puede reabrirlo.";
}
