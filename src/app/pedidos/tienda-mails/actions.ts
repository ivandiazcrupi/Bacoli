"use server";

import { compararConSistema, type ResumenComparacion } from "@/lib/empretienda-comparar";
import { leerOrdenesDeGmail, type LecturaMails } from "@/lib/empretienda-imap";
import { exigirOficina } from "@/lib/session";

export type ResultadoComparacion = { ok: boolean; mensaje: string; resumen: ResumenComparacion | null; ilegibles: LecturaMails["ilegibles"] };

/** Lee los mails de la etiqueta de Gmail (solo lectura) y los compara con los pedidos que cargó la planilla. No crea ni cambia pedidos. */
export async function compararMailsAhora(): Promise<ResultadoComparacion> {
  await exigirOficina();
  const lectura = await leerOrdenesDeGmail();
  if (!lectura.ok) return { ok: false, mensaje: lectura.mensaje, resumen: null, ilegibles: [] };
  return { ok: true, mensaje: lectura.mensaje, resumen: await compararConSistema(lectura.ordenes), ilegibles: lectura.ilegibles };
}
