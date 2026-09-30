import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Cabecera } from "@/components/Cabecera";
import { estiloCampo } from "@/components/campos";
import { db } from "@/lib/db";
import { TIPO_CLIENTE } from "@/lib/etiquetas";
import { exigirOficina } from "@/lib/session";

const LIMITE = 100;

export default async function Clientes({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const usuario = await exigirOficina();
  const { q = "", tipo = "", zona = "", estado = "activos" } = await searchParams;

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
  if (tipo in TIPO_CLIENTE) where.tipo = tipo as keyof typeof TIPO_CLIENTE;
  if (zona) where.puntos = { some: { zonaId: zona } };
  if (estado === "activos") where.activo = true;
  if (estado === "inactivos") where.activo = false;

  const [clientes, total, zonas] = await Promise.all([
    db.cliente.findMany({ where, orderBy: { nombre: "asc" }, take: LIMITE, include: { puntos: { include: { zona: true } }, _count: { select: { preciosEspeciales: true } } } }),
    db.cliente.count({ where }),
    db.zona.findMany({ orderBy: { orden: "asc" } }),
  ]);

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

        <form className="grid grid-cols-2 gap-2 md:grid-cols-3">
          <input name="q" defaultValue={q} placeholder="Buscar cliente, sucursal o barrio" className={`${estiloCampo} col-span-2 md:col-span-3 mt-0`} />
          <select name="tipo" defaultValue={tipo} className={`${estiloCampo} mt-0`}>
            <option value="">Todos los tipos</option>
            {Object.entries(TIPO_CLIENTE).filter(([k]) => k !== "MINORISTA").map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
          <select name="zona" defaultValue={zona} className={`${estiloCampo} mt-0`}>
            <option value="">Todas las zonas</option>
            {zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
          </select>
          <select name="estado" defaultValue={estado} className={`${estiloCampo} mt-0`}>
            <option value="activos">Activos</option>
            <option value="inactivos">Desactivados</option>
            <option value="todos">Todos</option>
          </select>
          <button className="col-span-2 md:col-span-3 rounded-lg border border-stone-300 bg-white px-3 py-3 font-medium">Filtrar</button>
        </form>

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
                      {TIPO_CLIENTE[c.tipo]} · {c.puntos.length} {c.puntos.length === 1 ? "sucursal" : "sucursales"}
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
