import { db } from "@/lib/db";
import { mayus } from "@/lib/mayusculas";
import type { OrdenDeMail } from "@/lib/empretienda-mail";

/**
 * Barrio de los pedidos de la tienda. El mail solo trae el código postal y la tabla del script de Google es aproximada
 * (un mismo código puede cubrir dos barrios). Por eso el sistema aprende: mira los pedidos que el equipo ya tiene cargados
 * (con el barrio que corrigió a mano) y, para cada código postal, usa el barrio que más se repite.
 */

const cpDe = (t: string) => String(t ?? "").replace(/\D/g, "");
const sinTilde = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
// Solo barrios sueltos de CABA: las zonas del GBA ("TIGRE / ZONA NORTE") se dejan como vienen.
const esBarrioSuelto = (localidad: string) => !localidad.includes("/");

/** Cambia el barrio de cada orden por el que el equipo suele usar para ese código postal (si ya lo aprendió). */
export async function aplicarBarriosAprendidos<T extends OrdenDeMail>(ordenes: T[]): Promise<T[]> {
  const filas = await db.barrioCp.findMany();
  if (filas.length === 0) return ordenes;
  const mapa = new Map(filas.map((f) => [f.cp, f.barrio]));
  return ordenes.map((o) => {
    const aprendido = mapa.get(cpDe(o.cp));
    return aprendido && esBarrioSuelto(o.localidad) ? { ...o, localidad: aprendido } : o;
  });
}

export type ResultadoAprender = { cps: number; dudosos: { cp: string; detalle: string }[]; pedidos: number };

/** Mira, orden por orden, el barrio que tiene el pedido cargado y se queda con el más usado de cada código postal. */
export async function aprenderBarrios(ordenes: OrdenDeMail[]): Promise<ResultadoAprender> {
  const pedidos = await db.pedido.findMany({ where: { webOrden: { in: ordenes.map((o) => o.orden) } }, select: { webOrden: true, webBarrio: true } });
  const barrioDe = new Map(pedidos.map((p) => [p.webOrden, p.webBarrio]));
  const cuenta = new Map<string, Map<string, number>>();
  let usados = 0;
  for (const o of ordenes) {
    const barrio = barrioDe.get(o.orden);
    const cp = cpDe(o.cp);
    if (!barrio || !cp || !esBarrioSuelto(barrio) || !esBarrioSuelto(o.localidad)) continue;
    const b = mayus(barrio);
    const m = cuenta.get(cp) ?? new Map<string, number>();
    m.set(b, (m.get(b) ?? 0) + 1);
    cuenta.set(cp, m);
    usados++;
  }
  const dudosos: ResultadoAprender["dudosos"] = [];
  for (const [cp, m] of cuenta) {
    const orden = [...m.entries()].sort((a, b) => b[1] - a[1] || sinTilde(a[0]).localeCompare(sinTilde(b[0])));
    const total = orden.reduce((n, [, v]) => n + v, 0);
    const detalle = orden.map(([b, v]) => `${b} ${v}`).join(" · ");
    await db.barrioCp.upsert({
      where: { cp },
      create: { cp, barrio: orden[0][0], veces: orden[0][1], total, detalle },
      update: { barrio: orden[0][0], veces: orden[0][1], total, detalle },
    });
    if (orden.length > 1) dudosos.push({ cp, detalle });
  }
  return { cps: cuenta.size, dudosos: dudosos.sort((a, b) => a.cp.localeCompare(b.cp)), pedidos: usados };
}
