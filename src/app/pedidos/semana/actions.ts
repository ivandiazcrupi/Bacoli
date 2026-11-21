"use server";

import { revalidatePath } from "next/cache";
import { bloquearVendedores, desbloquearVendedores, hayClaveVendedores } from "@/lib/claveVendedores";
import { exigirOficina } from "@/lib/session";

export type EstadoTotales = { error?: string } | undefined;

const intentos = new Map<string, { n: number; hasta: number }>(); // 5 errores = 15 min sin poder probar (en memoria, como el login)

/** Muestra el total de facturación de la semana: pide la misma contraseña que Vendedores y Estadísticas. */
export async function desbloquearTotales(_: EstadoTotales, f: FormData): Promise<EstadoTotales> {
  const u = await exigirOficina();
  if (!(await hayClaveVendedores())) return { error: "Todavía no hay contraseña: un gerente la crea en Comercial → Vendedores." };
  const t = intentos.get(u.id);
  if (t && t.hasta > Date.now() && t.n >= 5) return { error: "Demasiados intentos. Probá en 15 minutos." };
  if (!(await desbloquearVendedores(String(f.get("clave") ?? "")))) {
    intentos.set(u.id, { n: (t && t.hasta > Date.now() ? t.n : 0) + 1, hasta: Date.now() + 15 * 60_000 });
    return { error: "Contraseña incorrecta." };
  }
  intentos.delete(u.id);
  revalidatePath("/pedidos/semana");
}

export async function bloquearTotales() {
  await exigirOficina();
  await bloquearVendedores();
  revalidatePath("/pedidos/semana");
}
