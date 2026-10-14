"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { esFechaValida, hoy } from "@/lib/fechas";
import { titulo } from "@/lib/mayusculas";
import { leerMonto } from "@/lib/numeros";
import { exigirOficina } from "@/lib/session";

export type EstadoVend = { ok?: string; error?: string; id?: string } | undefined;

async function exigirDueno() {
  const u = await exigirOficina();
  if (u.rol !== "DUENO") throw new Error("Solo un dueño puede hacer esto.");
  return u;
}
/** Solo quien tiene marcado "Aprueba vendedores" (menú USUARIOS) puede aprobar los cambios de vendedor. */
async function exigirAprobador() {
  const u = await exigirDueno();
  if (!u.apruebaVendedores) throw new Error("Solo la persona que aprueba los cambios de vendedor puede hacerlo.");
  return u;
}
const refrescar = (...ids: (string | undefined)[]) => {
  revalidatePath("/comercial/vendedores");
  for (const id of ids) if (id) revalidatePath(id.startsWith("/") ? id : `/clientes/${id}`);
};
const leerPct = (txt: string): { pct: number | null } | { error: string } => {
  const t = txt.trim();
  if (!t) return { pct: null };
  const n = leerMonto(t);
  return n === null || n < 0 || n > 100 ? { error: "El % tiene que estar entre 0 y 100." } : { pct: n };
};

/** Un vendedor se puede enlazar a un usuario (de rol Vendedor) para que entre a cargar sus pedidos; cada usuario, a un solo vendedor. */
async function revisarUsuario(usuarioId: string | null, vendedorId: string | null): Promise<string | null> {
  if (!usuarioId) return null;
  const u = await db.usuario.findUnique({ where: { id: usuarioId }, select: { rol: true, vendedor: { select: { id: true } } } });
  if (!u || u.rol !== "VENDEDOR") return "Ese usuario no tiene rol Vendedor (se cambia en Usuarios).";
  if (u.vendedor && u.vendedor.id !== vendedorId) return "Ese usuario ya está enlazado a otro vendedor.";
  return null;
}

/** Alta de un vendedor: nombre, % de comisión y, si hace falta, el usuario con el que entra al sistema (opcional: Migue, por ejemplo, no entra). */
export async function crearVendedor(_: EstadoVend, f: FormData): Promise<EstadoVend> {
  await exigirDueno();
  const nombre = titulo(String(f.get("nombre") ?? "").trim());
  if (nombre.length < 2) return { error: "Falta el nombre del vendedor." };
  const pct = leerPct(String(f.get("pct") ?? ""));
  if ("error" in pct) return pct;
  const usuarioId = String(f.get("usuarioId") ?? "") || null;
  const mal = await revisarUsuario(usuarioId, null);
  if (mal) return { error: mal };
  if (await db.vendedor.findFirst({ where: { nombre: { equals: nombre, mode: "insensitive" } } })) return { error: "Ya hay un vendedor con ese nombre." };
  const v = await db.vendedor.create({ data: { nombre, comisionPct: pct.pct, usuarioId } });
  refrescar();
  return { ok: `${nombre} quedó cargado. Ahora asignale clientes.`, id: v.id };
}

/** Datos de un vendedor: nombre, % y usuario de acceso. */
export async function guardarVendedor(id: string, _: EstadoVend, f: FormData): Promise<EstadoVend> {
  await exigirDueno();
  const nombre = titulo(String(f.get("nombre") ?? "").trim());
  if (nombre.length < 2) return { error: "Falta el nombre." };
  const pct = leerPct(String(f.get("pct") ?? ""));
  if ("error" in pct) return pct;
  const usuarioId = String(f.get("usuarioId") ?? "") || null;
  const mal = await revisarUsuario(usuarioId, id);
  if (mal) return { error: mal };
  await db.vendedor.update({ where: { id }, data: { nombre, comisionPct: pct.pct, usuarioId } });
  refrescar(`/comercial/vendedores/${id}`);
  return { ok: "Guardado." };
}

/** Desactivar (deja de aparecer para asignarle clientes; sus clientes y su historial quedan) o volver a activar. */
export async function cambiarActivoVendedor(id: string) {
  await exigirDueno();
  const v = await db.vendedor.findUnique({ where: { id }, select: { activo: true } });
  if (!v) return;
  await db.vendedor.update({ where: { id }, data: { activo: !v.activo } });
  refrescar(`/comercial/vendedores/${id}`);
}

/** % de comisión (edición rápida en la lista). */
export async function guardarComisionVendedor(vendedorId: string, _: EstadoVend, f: FormData): Promise<EstadoVend> {
  await exigirDueno();
  const pct = leerPct(String(f.get("pct") ?? ""));
  if ("error" in pct) return pct;
  await db.vendedor.update({ where: { id: vendedorId }, data: { comisionPct: pct.pct } });
  refrescar(`/comercial/vendedores/${vendedorId}`);
  return { ok: "Guardado." };
}

async function crearPropuestas(uId: string, vendedorId: string | null, clienteIds: string[], desde: string) {
  let creadas = 0, omitidas = 0;
  for (const clienteId of clienteIds) {
    const c = await db.cliente.findUnique({ where: { id: clienteId }, select: { vendedorId: true } });
    const pendiente = await db.asignacionVendedor.count({ where: { clienteId, estado: "PENDIENTE" } });
    if (!c || (c.vendedorId ?? null) === vendedorId || pendiente) { omitidas++; continue; }
    await db.asignacionVendedor.create({ data: { clienteId, vendedorId, desde, propuestoPor: uId } });
    creadas++;
  }
  return { creadas, omitidas };
}
const leerDesde = (f: FormData) => {
  const d = String(f.get("desde") ?? "").trim() || hoy();
  return esFechaValida(d) && d <= hoy() ? d : null;
};
const textoResultado = (r: { creadas: number; omitidas: number }) =>
  r.creadas === 0 ? { error: "No se propuso ningún cambio: esos clientes ya tienen ese vendedor o ya tienen un cambio pendiente." }
    : { ok: `${r.creadas} ${r.creadas === 1 ? "cambio propuesto" : "cambios propuestos"}${r.omitidas ? ` (${r.omitidas} omitidos: ya tenían ese vendedor o un cambio pendiente)` : ""}. Quedan pendientes: hay que aprobarlos para que valgan.` };

/** Paso 1 del doble chequeo: un dueño PROPONE el vendedor de un cliente (sin vendedor = dejarlo libre). Queda pendiente hasta que OTRO dueño lo apruebe. */
export async function proponerVendedor(_: EstadoVend, f: FormData): Promise<EstadoVend> {
  const u = await exigirDueno();
  const clienteId = String(f.get("clienteId") ?? "");
  const vendedorId = String(f.get("vendedorId") ?? "") || null;
  if (!clienteId) return { error: "Elegí el cliente." };
  if (vendedorId) {
    const v = await db.vendedor.findUnique({ where: { id: vendedorId }, select: { activo: true } });
    if (!v || !v.activo) return { error: "Ese vendedor no está activo." };
  }
  const desde = leerDesde(f);
  if (!desde) return { error: "La fecha “vale desde” no es válida (no puede ser futura)." };
  const r = await crearPropuestas(u.id, vendedorId, [clienteId], desde);
  refrescar(clienteId);
  return textoResultado(r);
}

/** Lo mismo para varios clientes juntos (desde la ficha del vendedor). */
export async function proponerVarios(vendedorId: string, _: EstadoVend, f: FormData): Promise<EstadoVend> {
  const u = await exigirDueno();
  const ids = f.getAll("clienteId").map(String).filter(Boolean);
  if (ids.length === 0) return { error: "Tildá al menos un cliente." };
  const v = await db.vendedor.findUnique({ where: { id: vendedorId }, select: { activo: true } });
  if (!v || !v.activo) return { error: "Ese vendedor no está activo." };
  const desde = leerDesde(f);
  if (!desde) return { error: "La fecha “vale desde” no es válida (no puede ser futura)." };
  const r = await crearPropuestas(u.id, vendedorId, ids, desde);
  refrescar(`/comercial/vendedores/${vendedorId}`);
  return textoResultado(r);
}

async function resolver(id: string, aprobar: boolean, quien: string) {
  const a = await db.asignacionVendedor.findUnique({ where: { id } });
  if (!a || a.estado !== "PENDIENTE") return false;
  const cliente = await db.cliente.findUnique({ where: { id: a.clienteId }, select: { vendedorId: true } });
  await db.$transaction([
    db.asignacionVendedor.update({ where: { id }, data: { estado: aprobar ? "APROBADA" : "RECHAZADA", resueltoPor: quien, resueltoEn: new Date(), anteriorId: cliente?.vendedorId ?? null } }),
    ...(aprobar ? [db.cliente.update({ where: { id: a.clienteId }, data: { vendedorId: a.vendedorId } })] : []),
  ]);
  return true;
}

/** Paso 2: quien aprueba (marcado en USUARIOS) aprueba o rechaza. Quien lo propuso puede retirarlo. */
export async function resolverAsignacion(id: string, aprobar: boolean): Promise<EstadoVend> {
  const u = await exigirDueno();
  const a = await db.asignacionVendedor.findUnique({ where: { id } });
  if (!a || a.estado !== "PENDIENTE") return { error: "Ese cambio ya fue resuelto." };
  if (aprobar && !u.apruebaVendedores) return { error: "Solo la persona que aprueba los cambios de vendedor puede aprobarlos." };
  if (!aprobar && !u.apruebaVendedores && a.propuestoPor !== u.id) return { error: "Solo quien aprueba (o quien lo propuso) puede rechazarlo." };
  await resolver(id, aprobar, u.id);
  refrescar(a.clienteId);
  return { ok: aprobar ? "Aprobado." : "Rechazado." };
}

/** Aprobar o rechazar TODOS los pendientes de una vez (para lotes grandes). Solo quien aprueba. */
export async function resolverTodas(aprobar: boolean): Promise<EstadoVend> {
  const u = await exigirAprobador();
  const pendientes = await db.asignacionVendedor.findMany({ where: { estado: "PENDIENTE" }, orderBy: { propuestoEn: "asc" } });
  let hechos = 0;
  for (const a of pendientes) if (await resolver(a.id, aprobar, u.id)) hechos++;
  refrescar();
  return { ok: `${hechos} ${aprobar ? "aprobados" : "rechazados"}.` };
}

/** Pasa un comisionista que estaba escrito en las fichas (ej. Migue 8%) a la lista de vendedores: crea el vendedor y PROPONE sus clientes (otro dueño los aprueba). */
export async function pasarComisionista(_: EstadoVend, f: FormData): Promise<EstadoVend> {
  const u = await exigirDueno();
  const nombreOriginal = String(f.get("comisionista") ?? "");
  const desde = leerDesde(f);
  if (!desde) return { error: "La fecha “vale desde” no es válida (no puede ser futura)." };
  const clientes = await db.cliente.findMany({ where: { comisionista: { equals: nombreOriginal, mode: "insensitive" } }, select: { id: true, comisionPct: true } });
  if (clientes.length === 0) return { error: "No encontré clientes con ese comisionista." };
  const nombre = titulo(nombreOriginal);
  let v = await db.vendedor.findFirst({ where: { nombre: { equals: nombre, mode: "insensitive" } } });
  const pct = Math.max(...clientes.map((c) => Number(c.comisionPct ?? 0)));
  if (!v) v = await db.vendedor.create({ data: { nombre, comisionPct: pct || null } });
  const r = await crearPropuestas(u.id, v.id, clientes.map((c) => c.id), desde);
  refrescar();
  return { ok: `${nombre} quedó como vendedor (${pct ? `${String(pct).replace(".", ",")}%` : "sin %"}). ${r.creadas} ${r.creadas === 1 ? "cliente propuesto" : "clientes propuestos"}: hay que aprobarlos para que valgan.` };
}
