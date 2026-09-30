import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Cabecera } from "@/components/Cabecera";
import { estiloCampo } from "@/components/campos";
import { db } from "@/lib/db";
import { exigirOficina } from "@/lib/session";

const LIMITE = 100;

export default async function Clientes({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const usuario = await exigirOficina();
  const { q = "", zona = "", estado = "activos" } = await searchParams;

  const where: Prisma.ClienteWhereInput = {};
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

  const [clientes, total, zonas] = await Promise.all([
    db.cliente.findMany({ where, orderBy: { nombre: "asc" }, take: LIMITE, include: { puntos: { include: { zona: true } }, _count: { select: { preciosEspeciales: true } } } }),
    db.cliente.count({ where }),
    db.zona.findMany({ orderBy: { orden: "asc" } }),
  ]);

  const pastilla = "rounded-full px-5 py-2 text-sm font-semibold uppercase tracking-wide transition";
  // Enlaces de los filtros: cambian una sola cosa y conservan el resto (búsqueda, zona, estado).
  const enlace = (cambio: Record<string, string>) => {
    const v: Record<string, string> = { q, zona, estado, ...cambio };
    const partes = Object.entries(v).filter(([k, x]) => x && !(k === "estado" && x === "activos"));
    return `/clientes${partes.length ? `?${new URLSearchParams(partes)}` : ""}`;
  };

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Clientes</h1>
          <div className="flex items-center gap-2">
            <Link href="/clientes/importar" className="rounded-lg border border-stone-300 bg-white px-3 py-3 text-sm font-medium">Importar</Link>
            <Link href="/clientes/nuevo" className="rounded-lg bg-amber-700 px-10 py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-amber-800">+ Cargar cliente</Link>
          </div>
        </div>

        <form className="flex gap-2">
          <input name="q" defaultValue={q} placeholder="Buscar cliente, sucursal o barrio" className={`${estiloCampo} mt-0 flex-1`} />
          {zona && <input type="hidden" name="zona" value={zona} />}
          {estado !== "activos" && <input type="hidden" name="estado" value={estado} />}
          <button className="rounded-lg border border-stone-300 bg-white px-6 py-3 font-medium">Buscar</button>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2" aria-label="Zona">
            {[{ id: "", nombre: "TODAS" }, ...zonas].map((z) => (
              <Link key={z.id} href={enlace({ zona: z.id })} className={`${pastilla} ${z.id === zona ? "bg-amber-700 text-white shadow-sm" : "border border-stone-300 bg-white text-stone-600 hover:border-amber-600 hover:text-amber-800"}`}>
                {z.nombre}
              </Link>
            ))}
          </div>
          <div className="flex gap-1 text-sm" aria-label="Estado">
            {[["activos", "Activos"], ["inactivos", "Desactivados"], ["todos", "Todos"]].map(([k, t]) => (
              <Link key={k} href={enlace({ estado: k })} className={`rounded-lg px-3 py-2 ${k === estado ? "bg-stone-800 font-semibold text-white" : "text-stone-600 hover:bg-stone-200"}`}>{t}</Link>
            ))}
          </div>
        </div>

        <p className="text-sm text-stone-600">
          {total} {total === 1 ? "cliente" : "clientes"}{total > LIMITE && ` · mostrando los primeros ${LIMITE}, usá el buscador`}
        </p>

        {clientes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 p-4 text-stone-600">No hay clientes con esos filtros.</p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {clientes.map((c) => {
              const zonasCliente = [...new Set(c.puntos.map((p) => p.zona.nombre))].join(", ");
              return (
                <li key={c.id} className="rounded-lg border border-stone-200 bg-white">
                  <Link href={`/clientes/${c.id}`} className={`block p-4 ${c.activo ? "" : "opacity-60"}`}>
                    <p className="font-medium">{c.nombre}</p>
                    <p className="text-sm text-stone-600">
                      {c.puntos.length} {c.puntos.length === 1 ? "sucursal" : "sucursales"}
                      {zonasCliente && ` · ${zonasCliente}`}
                      {c.facturado && " · con factura"}
                      {c._count.preciosEspeciales > 0 && " · precio propio"}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
