import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { FiltrosClientes } from "./FiltrosClientes";
import { ListaClientes } from "./ListaClientes";
import { filtroClientes } from "./consulta";
import { exigirOficina } from "@/lib/session";

export default async function Clientes({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const usuario = await exigirOficina();
  const { q = "", zona = "", estado = "activos" } = await searchParams;

  const where = filtroClientes({ q, zona, estado });

  const [clientes, zonas] = await Promise.all([
    // Todos los clientes, por orden alfabético del nombre del comercio (sin límite).
    db.cliente.findMany({
      where,
      orderBy: { nombre: "asc" },
      include: { puntos: { where: zona ? { zonaId: zona } : undefined, include: { zona: true }, orderBy: [{ barrio: "asc" }, { direccion: "asc" }] } },
    }),
    db.zona.findMany({ orderBy: { orden: "asc" } }),
  ]);

  // Cuántos puntos de entrega hay entre los clientes que se ven (un cliente puede tener varios).
  const totalPuntos = clientes.reduce((n, c) => n + c.puntos.length, 0);
  const inactivos = clientes.reduce((n, c) => n + c.puntos.filter((p) => !p.activo || !c.activo).length, 0);

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-6 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Clientes</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/clientes/importar" className="rounded-lg border border-stone-300 bg-white px-3 py-3 text-sm font-medium">Importar</Link>
            <Link href="/clientes/nuevo" className="whitespace-nowrap rounded-lg bg-verde-700 px-4 py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-verde-800 sm:px-10">+ Cargar cliente</Link>
          </div>
        </div>

        <FiltrosClientes q={q} zona={zona} estado={estado} zonas={zonas.map((z) => ({ id: z.id, nombre: z.nombre }))} />

        <p className="text-sm text-stone-600">
          <b className="text-stone-900">{clientes.length}</b> {clientes.length === 1 ? "cliente" : "clientes"} ·{" "}
          <b className="text-stone-900">{totalPuntos}</b> {totalPuntos === 1 ? "sucursal" : "sucursales"} (puntos de entrega)
          {inactivos > 0 && <> · {totalPuntos - inactivos} activas y {inactivos} desactivadas</>}
        </p>

        {clientes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 p-4 text-stone-600">No hay clientes con esos filtros.</p>
        ) : (
          <ListaClientes clientes={clientes} />
        )}
      </main>
    </>
  );
}

