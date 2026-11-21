import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { titulo } from "@/lib/mayusculas";

export type FilaAsignacion = { id: string; nombre: string; activo: boolean; vendedorId: string | null; vendedor: string; sucursales: { barrio: string; direccion: string }[]; telefonos: string[] };

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Todos los clientes con quién los atiende. v = "todos" | "fabrica" (sin vendedor) | id de un vendedor. */
export async function clientesConVendedor(v: string, q: string, conInactivos: boolean): Promise<FilaAsignacion[]> {
  const where: Prisma.ClienteWhereInput = { ...(conInactivos ? {} : { activo: true }), ...(v === "fabrica" ? { vendedorId: null } : v !== "todos" ? { vendedorId: v } : {}) };
  const clientes = await db.cliente.findMany({
    where,
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, activo: true, vendedorId: true, vendedor: { select: { nombre: true } }, puntos: { where: { activo: true }, orderBy: { barrio: "asc" }, select: { barrio: true, direccion: true, telefono: true } } },
  });
  const palabras = sinTildes(q).split(/\s+/).filter(Boolean);
  return clientes
    .map((c) => ({
      id: c.id, nombre: c.nombre, activo: c.activo, vendedorId: c.vendedorId, vendedor: c.vendedor ? titulo(c.vendedor.nombre) : "De la fábrica",
      sucursales: c.puntos.map((p) => ({ barrio: p.barrio, direccion: titulo(p.direccion) })),
      telefonos: [...new Set(c.puntos.map((p) => (p.telefono ?? "").trim()).filter(Boolean))],
    }))
    .filter((f) => palabras.every((w) => sinTildes(`${f.nombre} ${f.sucursales.map((s) => `${s.barrio} ${s.direccion}`).join(" ")}`).includes(w)));
}

export async function vendedoresConConteo(conInactivos: boolean) {
  const [vendedores, sinVendedor, total] = await Promise.all([
    db.vendedor.findMany({ orderBy: [{ activo: "desc" }, { nombre: "asc" }], select: { id: true, nombre: true, activo: true, _count: { select: { clientes: { where: conInactivos ? {} : { activo: true } } } } } }),
    db.cliente.count({ where: { vendedorId: null, ...(conInactivos ? {} : { activo: true }) } }),
    db.cliente.count({ where: conInactivos ? {} : { activo: true } }),
  ]);
  return { vendedores: vendedores.map((v) => ({ id: v.id, nombre: titulo(v.nombre), activo: v.activo, clientes: v._count.clientes })), sinVendedor, total };
}
