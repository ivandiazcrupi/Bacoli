import type { Prisma } from "@prisma/client";

/** Filtro de la lista de Clientes (buscador de varias palabras, zona y estado). Lo usan la oficina y el vendedor (con `extra` = solo sus clientes). */
export function filtroClientes({ q, zona, estado }: { q: string; zona: string; estado: string }, extra: Prisma.ClienteWhereInput = {}): Prisma.ClienteWhereInput {
  const where: Prisma.ClienteWhereInput = { ...extra };
  // Cada palabra puede coincidir con cualquier dato del cliente: "vacalin olivos" = nombre VACALIN + sucursal Olivos.
  const palabras = q.trim().split(/\s+/).filter(Boolean);
  if (palabras.length) {
    where.AND = palabras.map((w) => {
      const contiene = { contains: w, mode: "insensitive" as const };
      const digitos = w.replace(/\D/g, "");
      return {
        OR: [
          { nombre: contiene },
          { razonSocial: contiene },
          ...(digitos ? [{ cuit: { contains: digitos } }] : []),
          { puntos: { some: { OR: [{ alias: contiene }, { direccion: contiene }, { barrio: contiene }] } } },
        ],
      };
    });
  }
  if (zona) where.puntos = { some: { zonaId: zona } };
  if (estado === "activos") where.activo = true;
  if (estado === "inactivos") where.activo = false;
  return where;
}
