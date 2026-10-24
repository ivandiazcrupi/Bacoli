import { db } from "@/lib/db";
import { mayus } from "@/lib/mayusculas";
import { barrioDeTabla, type OrdenDeMail } from "@/lib/empretienda-mail";

/**
 * Barrio de los pedidos de la tienda: SIEMPRE queda cargado, sin pasos extra y sin servicios externos.
 * Se usa, en este orden: 1) el barrio que el equipo ya usaba para ese código postal (tabla `BarrioCp`, si existe),
 * 2) la tabla de códigos postales de CABA, 3) "CABA". Las zonas del GBA ("TIGRE / ZONA NORTE") se dejan como vienen.
 */

const cpDe = (t: string) => String(t ?? "").replace(/\D/g, "");
const esCaba = (o: OrdenDeMail) => !o.localidad.includes("/") && (/capital|caba|ciudad aut/i.test(`${o.provincia} ${o.ciudad}`) || (parseInt(cpDe(o.cp), 10) >= 1000 && parseInt(cpDe(o.cp), 10) <= 1499));

async function mapaAprendido() {
  return new Map((await db.barrioCp.findMany()).map((f) => [f.cp, f.barrio]));
}
const barrioPara = (o: OrdenDeMail, aprendidos: Map<string, string>) => mayus(aprendidos.get(cpDe(o.cp)) ?? barrioDeTabla(cpDe(o.cp)) ?? "CABA");

export async function aplicarBarriosAprendidos<T extends OrdenDeMail>(ordenes: T[]): Promise<T[]> {
  const aprendidos = await mapaAprendido();
  return ordenes.map((o) => (esCaba(o) ? { ...o, localidad: barrioPara(o, aprendidos) } : o));
}

/**
 * Completa los pedidos de la tienda que quedaron sin barrio (los cargados antes de este arreglo), con el código postal de su mail.
 * Se corre solo con cada lectura de pedidos. Si el mail ya no está entre los leídos, queda "CABA".
 */
export async function completarBarriosVacios(ordenes: OrdenDeMail[]): Promise<number> {
  const vacios = await db.pedido.findMany({ where: { origen: "WEB", webBarrio: null, estado: { not: "CANCELADO" } }, select: { id: true, webOrden: true }, take: 50 });
  if (vacios.length === 0) return 0;
  const aprendidos = await mapaAprendido();
  const porOrden = new Map(ordenes.map((o) => [o.orden, o]));
  for (const p of vacios) {
    const o = p.webOrden ? porOrden.get(p.webOrden) : undefined;
    const barrio = o ? (esCaba(o) ? barrioPara(o, aprendidos) : mayus(o.localidad)) : "CABA";
    await db.pedido.update({ where: { id: p.id }, data: { webBarrio: barrio || "CABA", webBarrioSugerido: null } });
  }
  return vacios.length;
}
