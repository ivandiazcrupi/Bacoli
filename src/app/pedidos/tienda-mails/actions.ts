"use server";

import { compararConSistema, type ResumenComparacion } from "@/lib/empretienda-comparar";
import { leerOrdenesDeGmail, type LecturaMails } from "@/lib/empretienda-imap";
import { aprenderBarrios } from "@/lib/empretienda-barrios";
import { exigirOficina } from "@/lib/session";

export type ResultadoComparacion = { ok: boolean; mensaje: string; resumen: ResumenComparacion | null; ilegibles: LecturaMails["ilegibles"]; campos: LecturaMails["campos"]; ejemplo: string };
export type ResultadoAprendizaje = { ok: boolean; mensaje: string; dudosos: { cp: string; detalle: string }[] };

/** Lee los mails de la etiqueta de Gmail (solo lectura) y los compara con los pedidos que cargó la planilla. No crea ni cambia pedidos. */
export async function compararMailsAhora(): Promise<ResultadoComparacion> {
  await exigirOficina();
  const lectura = await leerOrdenesDeGmail();
  if (!lectura.ok) return { ok: false, mensaje: lectura.mensaje, resumen: null, ilegibles: [], campos: [], ejemplo: "" };
  return { ok: true, mensaje: lectura.mensaje, resumen: await compararConSistema(lectura.ordenes), ilegibles: lectura.ilegibles, campos: lectura.campos, ejemplo: lectura.ejemplo };
}

/** Aprende el barrio de cada código postal mirando los pedidos que ya están cargados (con lo que el equipo corrigió). Solo guarda esa tabla: no toca pedidos. */
export async function aprenderBarriosAhora(): Promise<ResultadoAprendizaje> {
  await exigirOficina();
  const lectura = await leerOrdenesDeGmail();
  if (!lectura.ok) return { ok: false, mensaje: lectura.mensaje, dudosos: [] };
  const r = await aprenderBarrios(lectura.ordenes);
  return { ok: true, mensaje: `Listo: aprendí el barrio de ${r.cps} códigos postales a partir de ${r.pedidos} pedidos. Desde ahora los pedidos nuevos usan esos barrios.`, dudosos: r.dudosos };
}
