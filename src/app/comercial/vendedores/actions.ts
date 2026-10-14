"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { bloquearVendedores, desbloquearVendedores, hayClaveVendedores, MIN_CLAVE_VENDEDORES, ponerClaveVendedores, vendedoresDesbloqueado } from "@/lib/claveVendedores";
import { db } from "@/lib/db";
import { esFechaValida, hoy } from "@/lib/fechas";
import { titulo } from "@/lib/mayusculas";
import { leerMonto } from "@/lib/numeros";
import { exigirOficina } from "@/lib/session";

export type EstadoVend = { ok?: string; error?: string } | undefined;

/** Todo el apartado Vendedores (oficina) pide haber entrado con la contraseña; con ella, todos pueden hacer todo. */
async function exigirAcceso() {
  const u = await exigirOficina();
  if (!(await vendedoresDesbloqueado())) throw new Error("Ingresá la contraseña de Vendedores.");
  return u;
}
const refrescar = (extra?: string) => { revalidatePath("/comercial/vendedores"); if (extra) revalidatePath(extra); };

// ── Contraseña del apartado ──────────────────────────────────────────────────────────────────────
const intentos = new Map<string, { n: number; hasta: number }>(); // bloqueo de 15 min tras 5 errores (en memoria, como el login)

export async function entrarVendedores(_: EstadoVend, f: FormData): Promise<EstadoVend> {
  const u = await exigirOficina();
  const t = intentos.get(u.id);
  if (t && t.hasta > Date.now() && t.n >= 5) return { error: "Demasiados intentos. Probá de nuevo en 15 minutos." };
  if (!(await desbloquearVendedores(String(f.get("clave") ?? "")))) {
    const n = (t && t.hasta > Date.now() ? t.n : 0) + 1;
    intentos.set(u.id, { n, hasta: Date.now() + 15 * 60_000 });
    return { error: "Contraseña incorrecta." };
  }
  intentos.delete(u.id);
  redirect("/comercial/vendedores");
}

/** Primera vez (la crea un dueño), o cambiarla: la puede cambiar quien ya entró y, si se olvidó, un dueño. */
export async function guardarClaveVendedores(_: EstadoVend, f: FormData): Promise<EstadoVend> {
  const u = await exigirOficina();
  const hay = await hayClaveVendedores();
  const puede = u.rol === "DUENO" || (hay && (await vendedoresDesbloqueado()));
  if (!puede) return { error: "Solo un dueño puede crear la contraseña." };
  const nueva = String(f.get("nueva") ?? "");
  if (nueva.length < MIN_CLAVE_VENDEDORES) return { error: `Tiene que tener al menos ${MIN_CLAVE_VENDEDORES} caracteres.` };
  await ponerClaveVendedores(nueva);
  redirect("/comercial/vendedores");
}

export async function salirVendedores() {
  await exigirOficina();
  await bloquearVendedores();
  redirect("/comercial");
}

// ── Vendedores ───────────────────────────────────────────────────────────────────────────────────
const leerPct = (txt: string): { pct: number | null } | { error: string } => {
  const t = txt.trim();
  if (!t) return { pct: null };
  const n = leerMonto(t);
  return n === null || n < 0 || n > 100 ? { error: "El % tiene que estar entre 0 y 100." } : { pct: n };
};

async function revisarUsuario(usuarioId: string | null, vendedorId: string | null): Promise<string | null> {
  if (!usuarioId) return null;
  const u = await db.usuario.findUnique({ where: { id: usuarioId }, select: { rol: true, vendedor: { select: { id: true } } } });
  if (!u || u.rol !== "VENDEDOR") return "Ese usuario no tiene rol Vendedor (se cambia en Usuarios).";
  if (u.vendedor && u.vendedor.id !== vendedorId) return "Ese usuario ya está enlazado a otro vendedor.";
  return null;
}

/** Alta y edición de un vendedor: nombre, % de comisión y (opcional) el usuario con el que entra al sistema. */
export async function guardarVendedor(id: string | null, _: EstadoVend, f: FormData): Promise<EstadoVend> {
  await exigirAcceso();
  const nombre = titulo(String(f.get("nombre") ?? "").trim());
  if (nombre.length < 2) return { error: "Falta el nombre." };
  const pct = leerPct(String(f.get("pct") ?? ""));
  if ("error" in pct) return pct;
  const usuarioId = String(f.get("usuarioId") ?? "") || null;
  const mal = await revisarUsuario(usuarioId, id);
  if (mal) return { error: mal };
  const igual = await db.vendedor.findFirst({ where: { nombre: { equals: nombre, mode: "insensitive" }, ...(id ? { NOT: { id } } : {}) } });
  if (igual) return { error: "Ya hay un vendedor con ese nombre." };
  if (id) {
    await db.vendedor.update({ where: { id }, data: { nombre, comisionPct: pct.pct, usuarioId } });
    refrescar(`/comercial/vendedores/${id}`);
    return { ok: "Cambios guardados." };
  }
  const v = await db.vendedor.create({ data: { nombre, comisionPct: pct.pct, usuarioId } });
  refrescar();
  redirect(`/comercial/vendedores/${v.id}`);
}

/** Dar de baja (queda en la lista, sin poder asignarle clientes nuevos; su usuario deja de entrar) o de alta. */
export async function cambiarActivoVendedor(id: string) {
  await exigirAcceso();
  const v = await db.vendedor.findUnique({ where: { id }, select: { activo: true } });
  if (!v) return;
  await db.vendedor.update({ where: { id }, data: { activo: !v.activo } });
  refrescar(`/comercial/vendedores/${id}`);
}

/** Eliminar un vendedor: sus clientes quedan sin vendedor. Pide confirmar en pantalla. */
export async function eliminarVendedor(id: string) {
  await exigirAcceso();
  await db.vendedor.delete({ where: { id } });
  refrescar();
  redirect("/comercial/vendedores");
}

// ── Asignar clientes ─────────────────────────────────────────────────────────────────────────────
/** Cambia el vendedor de varios clientes y deja anotado desde cuándo vale (así cada venta cuenta para el vendedor que tenía el cliente ese día). */
async function asignar(uId: string, vendedorId: string | null, clienteIds: string[], desde: string) {
  let n = 0;
  for (const clienteId of clienteIds) {
    const c = await db.cliente.findUnique({ where: { id: clienteId }, select: { vendedorId: true } });
    if (!c || (c.vendedorId ?? null) === vendedorId) continue;
    await db.$transaction([
      db.asignacionVendedor.create({ data: { clienteId, vendedorId, anteriorId: c.vendedorId, desde, propuestoPor: uId, resueltoPor: uId, resueltoEn: new Date(), estado: "APROBADA" } }),
      db.cliente.update({ where: { id: clienteId }, data: { vendedorId } }),
    ]);
    n++;
  }
  return n;
}
const primeroDeMes = () => `${hoy().slice(0, 7)}-01`;
const leerDesde = (f: FormData) => { const d = String(f.get("desde") ?? "").trim() || primeroDeMes(); return esFechaValida(d) && d <= hoy() ? d : null; };

/** Un solo paso: los clientes tildados pasan a ser de este vendedor y los destildados quedan sin vendedor. */
export async function guardarClientesDeVendedor(vendedorId: string, _: EstadoVend, f: FormData): Promise<EstadoVend> {
  const u = await exigirAcceso();
  const v = await db.vendedor.findUnique({ where: { id: vendedorId }, select: { activo: true } });
  if (!v) return { error: "No encontré al vendedor." };
  const desde = leerDesde(f);
  if (!desde) return { error: "La fecha no es válida (no puede ser futura)." };
  const tildados = new Set(f.getAll("clienteId").map(String));
  const actuales = (await db.cliente.findMany({ where: { vendedorId }, select: { id: true } })).map((c) => c.id);
  const agregar = [...tildados].filter((id) => !actuales.includes(id));
  if (agregar.length && !v.activo) return { error: "Este vendedor está de baja: primero dalo de alta." };
  const sacar = actuales.filter((id) => !tildados.has(id));
  const a = await asignar(u.id, vendedorId, agregar, desde);
  const b = await asignar(u.id, null, sacar, desde);
  refrescar(`/comercial/vendedores/${vendedorId}`);
  return { ok: a + b === 0 ? "No había cambios." : `Listo: ${a} ${a === 1 ? "cliente agregado" : "clientes agregados"}${b ? `, ${b} ${b === 1 ? "quitado" : "quitados"}` : ""}.` };
}

/** Pasa un comisionista que estaba escrito en las fichas (ej. Migue 8%) a la lista de vendedores con todos sus clientes. */
export async function importarComisionista(comisionista: string): Promise<EstadoVend> {
  const u = await exigirAcceso();
  const clientes = await db.cliente.findMany({ where: { comisionista: { equals: comisionista, mode: "insensitive" } }, select: { id: true, comisionPct: true } });
  if (clientes.length === 0) return { error: "No encontré clientes con ese comisionista." };
  const nombre = titulo(comisionista);
  let v = await db.vendedor.findFirst({ where: { nombre: { equals: nombre, mode: "insensitive" } } });
  const pct = Math.max(...clientes.map((c) => Number(c.comisionPct ?? 0)));
  if (!v) v = await db.vendedor.create({ data: { nombre, comisionPct: pct || null } });
  const n = await asignar(u.id, v.id, clientes.map((c) => c.id), primeroDeMes());
  refrescar();
  return { ok: `${nombre}: ${n} ${n === 1 ? "cliente" : "clientes"}.` };
}
