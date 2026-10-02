"use server";

import { revalidatePath } from "next/cache";
import { exigirOficina } from "@/lib/session";
import { deshacerCobro, registrarCobro } from "../pedidos/dia/actions";

type Resultado = { ok: boolean; error?: string };

/** Marca varios comprobantes como pagados con el mismo medio (cada uno por su monto completo: no hay pagos parciales). */
export async function registrarPagos(pedidoIds: string[], medio: string): Promise<Resultado> {
  await exigirOficina();
  if (pedidoIds.length === 0) return { ok: false, error: "Elegí al menos un comprobante." };
  for (const id of pedidoIds) {
    const r = await registrarCobro(id, medio);
    if (!r.ok) {
      revalidatePath("/cuentas", "layout");
      return { ok: false, error: r.error ?? "No se pudo registrar el pago." };
    }
  }
  revalidatePath("/cuentas", "layout");
  return { ok: true };
}

export async function deshacerPago(pedidoId: string): Promise<Resultado> {
  await exigirOficina();
  const r = await deshacerCobro(pedidoId);
  revalidatePath("/cuentas", "layout");
  return r.ok ? { ok: true } : { ok: false, error: r.error ?? "No se pudo deshacer." };
}
