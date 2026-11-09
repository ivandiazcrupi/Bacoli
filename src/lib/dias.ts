import { db } from "@/lib/db";
import { aFecha, deFecha, hoy } from "@/lib/fechas";

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
  return estado === "LISTA" ? "La hoja de ese día está lista: hay que reabrirla para cambiar esto." : "Ese día está cerrado: un gerente puede reabrirlo.";
}

export const ERROR_SIN_AVISO_LOGISTICA = "Falta avisar a la logística que salimos: en la hoja de ruta de ese día, tocá “Ya avisé a logística”. Sin eso no se imprimen remitos.";

/** Mensaje de error si falta avisar a la logística de ese día (solo días de hoy en adelante; los pasados no se frenan); null si ya se avisó o no aplica. */
export async function errorSiFaltaAvisoLogistica(fecha: Date | string | null | undefined): Promise<string | null> {
  if (!fecha) return null;
  const f = typeof fecha === "string" ? aFecha(fecha) : fecha;
  if (deFecha(f) < hoy()) return null;
  const aviso = await db.avisoLogistica.findUnique({ where: { fecha: f } });
  return aviso ? null : ERROR_SIN_AVISO_LOGISTICA;
}
