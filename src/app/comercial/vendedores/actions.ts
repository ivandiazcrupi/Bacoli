"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { esFechaValida, hoy } from "@/lib/fechas";
import { leerMonto } from "@/lib/numeros";
import { exigirOficina } from "@/lib/session";

export type EstadoVend = { ok?: string; error?: string } | undefined;

async function exigirDueno() {
  const u = await exigirOficina();
  if (u.rol !== "DUENO") throw new Error("Solo un dueño puede hacer esto.");
  return u;
}
const refrescar = (clienteId?: string) => {
  revalidatePath("/comercial/vendedores");
  if (clienteId) revalidatePath(`/clientes/${clienteId}`);
};

/** Paso 1 del doble chequeo: un dueño PROPONE el vendedor de un cliente (vacío = dejarlo sin vendedor). Queda pendiente hasta que OTRO dueño lo apruebe. */
export async function proponerVendedor(_: EstadoVend, f: FormData): Promise<EstadoVend> {
  const u = await exigirDueno();
  const clienteId = String(f.get("clienteId") ?? "");
  const vendedorId = String(f.get("vendedorId") ?? "") || null;
  const cliente = await db.cliente.findUnique({ where: { id: clienteId }, select: { nombre: true, vendedorId: true } });
  if (!cliente) return { error: "Elegí el cliente." };
  if (vendedorId) {
    const v = await db.usuario.findUnique({ where: { id: vendedorId }, select: { rol: true, activo: true } });
    if (!v || v.rol !== "VENDEDOR" || !v.activo) return { error: "Ese usuario no es un vendedor activo." };
  }
  const desdeTxt = String(f.get("desde") ?? "").trim() || hoy();
  if (!esFechaValida(desdeTxt) || desdeTxt > hoy()) return { error: "La fecha “vale desde” no es válida (no puede ser futura)." };
  if ((cliente.vendedorId ?? null) === vendedorId) return { error: "Ese cliente ya tiene ese vendedor." };
  if (await db.asignacionVendedor.count({ where: { clienteId, estado: "PENDIENTE" } })) return { error: "Este cliente ya tiene un cambio pendiente de aprobación. Primero hay que aprobarlo o rechazarlo." };
  await db.asignacionVendedor.create({ data: { clienteId, vendedorId, desde: desdeTxt, propuestoPor: u.id } });
  refrescar(clienteId);
  return { ok: `Propuesto. Queda pendiente: otro dueño tiene que aprobarlo para que valga.` };
}

/** Paso 2: otro dueño aprueba (el cliente pasa al vendedor) o rechaza. Quien lo propuso no puede aprobarlo, pero sí retirarlo. */
export async function resolverAsignacion(id: string, aprobar: boolean): Promise<EstadoVend> {
  const u = await exigirDueno();
  const a = await db.asignacionVendedor.findUnique({ where: { id } });
  if (!a || a.estado !== "PENDIENTE") return { error: "Ese cambio ya fue resuelto." };
  if (aprobar && a.propuestoPor === u.id) return { error: "No podés aprobar un cambio que propusiste vos: lo tiene que aprobar otro dueño." };
  const cliente = await db.cliente.findUnique({ where: { id: a.clienteId }, select: { vendedorId: true } });
  await db.$transaction([
    db.asignacionVendedor.update({ where: { id }, data: { estado: aprobar ? "APROBADA" : "RECHAZADA", resueltoPor: u.id, resueltoEn: new Date(), anteriorId: cliente?.vendedorId ?? null } }),
    ...(aprobar ? [db.cliente.update({ where: { id: a.clienteId }, data: { vendedorId: a.vendedorId } })] : []),
  ]);
  refrescar(a.clienteId);
  return { ok: aprobar ? "Aprobado." : "Rechazado." };
}

/** % de comisión de un vendedor (se aplica a sus ventas sin IVA de pedidos entregados). */
export async function guardarComisionVendedor(vendedorId: string, _: EstadoVend, f: FormData): Promise<EstadoVend> {
  await exigirDueno();
  const txt = String(f.get("pct") ?? "").trim();
  const pct = txt ? leerMonto(txt) : null;
  if (txt && (pct === null || pct < 0 || pct > 100)) return { error: "El % tiene que estar entre 0 y 100." };
  const v = await db.usuario.findUnique({ where: { id: vendedorId }, select: { rol: true } });
  if (!v || v.rol !== "VENDEDOR") return { error: "Ese usuario no es un vendedor." };
  await db.usuario.update({ where: { id: vendedorId }, data: { comisionPct: pct } });
  refrescar();
  revalidatePath(`/comercial/vendedores/${vendedorId}`);
  return { ok: "Guardado." };
}
