import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { titulo } from "@/lib/mayusculas";
import { enlaceWhatsApp } from "@/lib/telefonos";
import { FiltrosClientes } from "./FiltrosClientes";
import { exigirOficina } from "@/lib/session";

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

  const [clientes, zonas] = await Promise.all([
    // Todos los clientes, por orden alfabético del nombre del comercio (sin límite).
    db.cliente.findMany({
      where,
      orderBy: { nombre: "asc" },
      include: { puntos: { include: { zona: true }, orderBy: [{ barrio: "asc" }, { direccion: "asc" }] } },
    }),
    db.zona.findMany({ orderBy: { orden: "asc" } }),
  ]);

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto max-w-[1400px] space-y-4 px-4 py-6 sm:px-8">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Clientes</h1>
          <div className="flex items-center gap-2">
            <Link href="/clientes/importar" className="rounded-lg border border-stone-300 bg-white px-3 py-3 text-sm font-medium">Importar</Link>
            <Link href="/clientes/nuevo" className="whitespace-nowrap rounded-lg bg-verde-700 px-4 py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-verde-800 sm:px-10">+ Cargar cliente</Link>
          </div>
        </div>

        <FiltrosClientes q={q} zona={zona} estado={estado} zonas={zonas.map((z) => ({ id: z.id, nombre: z.nombre }))} />

        <p className="text-sm text-stone-600">{clientes.length} {clientes.length === 1 ? "cliente" : "clientes"}</p>

        {clientes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 p-4 text-stone-600">No hay clientes con esos filtros.</p>
        ) : (
          <div className="space-y-2">
            <div className={`hidden gap-3 px-4 text-xs font-semibold uppercase tracking-wide text-stone-500 lg:grid ${COLUMNAS}`}>
              <span>Zona</span><span>Nombre</span><span>Dirección</span><span>Teléfono</span><span>Accesos</span>
            </div>
            {clientes.map((c) => <FilaCliente key={c.id} c={c} />)}
          </div>
        )}
      </main>
    </>
  );
}

// Columnas (PC): zona, nombre, dirección, teléfono, accesos.
const COLUMNAS = "lg:grid-cols-[9rem_2fr_2.2fr_1.4fr_15.5rem]";
const acceso = "rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium hover:border-verde-700 hover:text-verde-800";

type Cliente = Prisma.ClienteGetPayload<{ include: { puntos: { include: { zona: true } } } }>;

function Telefono({ tel }: { tel: string | null }) {
  if (!tel) return <span className="text-stone-400">—</span>;
  const wa = enlaceWhatsApp(tel);
  return (
    <span className="flex flex-wrap items-center gap-x-2">
      <a href={`tel:${tel.replace(/[^\d+]/g, "")}`} className="hover:underline">{tel}</a>
      {wa && <a href={wa} target="_blank" rel="noreferrer" className="text-xs font-medium text-verde-800 underline">WhatsApp</a>}
    </span>
  );
}

function FilaCliente({ c }: { c: Cliente }) {
  const varias = c.puntos.length > 1;
  const zonas = [...new Map(c.puntos.map((p) => [p.zona.id, p.zona])).values()].sort((a, b) => a.orden - b.orden);
  const unica = c.puntos[0];

  const fila = (
    <div className={`grid items-center gap-x-3 gap-y-1 p-4 ${COLUMNAS} ${c.activo ? "" : "opacity-60"}`}>
      <div className="flex flex-wrap gap-1">
        {zonas.map((z) => <span key={z.id} className="rounded-full bg-crema-200 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-verde-900">{z.nombre}</span>)}
        {zonas.length === 0 && <span className="text-stone-400">—</span>}
      </div>
      <Link href={`/clientes/${c.id}`} className="font-semibold hover:text-verde-800 hover:underline">{c.nombre}</Link>
      <div className="text-sm">
        {varias ? (
          <span className="inline-flex items-center gap-1 font-medium text-verde-800">
            {c.puntos.length} sucursales <span aria-hidden className="text-xs transition group-open:rotate-180">▾</span>
          </span>
        ) : unica ? (
          <span>{titulo(unica.direccion)} <span className="text-stone-500">· {unica.barrio}</span></span>
        ) : <span className="text-stone-400">Sin sucursal</span>}
      </div>
      <div className="text-sm">{varias ? <span className="text-stone-400">Ver sucursales</span> : <Telefono tel={unica?.telefono ?? null} />}</div>
      <div className="flex flex-wrap gap-2">
        <Link href={`/clientes/${c.id}/cuenta`} className={acceso}>Cuenta corriente</Link>
        <Link href={`/clientes/${c.id}/pedidos`} className={acceso}>Pedidos</Link>
      </div>
    </div>
  );

  if (!varias) return <div className="rounded-xl border border-stone-200 bg-white">{fila}</div>;

  // Con varias sucursales, tocar la fila las despliega: zona, barrio, dirección y teléfono de cada una.
  return (
    <details className="group rounded-xl border border-stone-200 bg-white open:border-verde-700">
      <summary className="cursor-pointer list-none">{fila}</summary>
      <ul className="divide-y divide-stone-100 border-t border-stone-100 bg-crema-50/60">
        {c.puntos.map((p) => (
          <li key={p.id} className={`grid items-center gap-x-3 gap-y-1 px-4 py-2 text-sm ${COLUMNAS} ${p.activo ? "" : "opacity-60"}`}>
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">{p.zona.nombre}</span>
            <span className="font-medium">{p.barrio}</span>
            <span>{titulo(p.direccion)}</span>
            <Telefono tel={p.telefono} />
            <span />
          </li>
        ))}
      </ul>
    </details>
  );
}
