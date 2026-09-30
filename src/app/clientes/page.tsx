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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Clientes</h1>
          <div className="flex flex-wrap items-center gap-2">
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
            <div className={`hidden gap-x-4 px-5 text-xs font-semibold uppercase tracking-wide text-stone-500 lg:grid ${COLUMNAS}`}>
              <span>Barrio</span><span>Nombre</span><span>Dirección</span><span>Teléfono</span><span />
            </div>
            {clientes.map((c) => <FilaCliente key={c.id} c={c} />)}
          </div>
        )}
      </main>
    </>
  );
}

// Columnas (PC): barrio, nombre, dirección, teléfono, accesos.
const COLUMNAS = "lg:grid-cols-[1.3fr_1.7fr_2fr_1.2fr_17rem]";
const acceso = "rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium uppercase hover:border-verde-700 hover:text-verde-800";

type Cliente = Prisma.ClienteGetPayload<{ include: { puntos: { include: { zona: true } } } }>;

// El teléfono es un enlace: al tocarlo abre WhatsApp para escribirle (si el número no sirve para WhatsApp, llama).
function Telefono({ tel }: { tel: string | null }) {
  if (!tel) return <span className="text-stone-400">—</span>;
  const wa = enlaceWhatsApp(tel);
  return wa
    ? <a href={wa} target="_blank" rel="noreferrer" className="hover:text-verde-800 hover:underline">{tel}</a>
    : <a href={`tel:${tel.replace(/[^\d+]/g, "")}`} className="hover:text-verde-800 hover:underline">{tel}</a>;
}

// Cada cliente es un cuadrante. Sus sucursales van todas a la vista, una debajo de otra, con el mismo espacio:
// el nombre y los accesos se comparten y cada sucursal tiene su barrio, dirección y teléfono.
function FilaCliente({ c }: { c: Cliente }) {
  const puntos = c.puntos;
  const n = Math.max(puntos.length, 1);
  const dato = "font-semibold";

  return (
    <div className={`rounded-xl border border-stone-200 bg-white ${c.activo ? "" : "opacity-60"}`}>
      {/* PC: una grilla; el nombre y los accesos ocupan todas las filas de las sucursales */}
      <div className={`hidden items-center gap-x-4 gap-y-2 px-5 py-4 lg:grid ${COLUMNAS}`}>
        <div className="flex items-center self-stretch" style={{ gridColumn: 2, gridRow: `1 / span ${n}` }}>
          <Link href={`/clientes/${c.id}`} className={`${dato} hover:text-verde-800 hover:underline`}>{c.nombre}</Link>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 self-stretch" style={{ gridColumn: 5, gridRow: `1 / span ${n}` }}>
          <Link href={`/clientes/${c.id}/cuenta`} className={acceso}>Cuenta corriente</Link>
          <Link href={`/clientes/${c.id}/pedidos`} className={acceso}>Pedidos</Link>
        </div>
        {puntos.length === 0 && <span className="text-stone-400" style={{ gridColumn: 1, gridRow: 1 }}>Sin sucursal</span>}
        {puntos.map((p, i) => (
          <div key={p.id} className="contents">
            <span className={`${dato} ${p.activo ? "" : "opacity-60"}`} style={{ gridColumn: 1, gridRow: i + 1 }}>{p.barrio}</span>
            <span className={`text-sm ${p.activo ? "" : "opacity-60"}`} style={{ gridColumn: 3, gridRow: i + 1 }}>{titulo(p.direccion)}</span>
            <span className="text-sm" style={{ gridColumn: 4, gridRow: i + 1 }}><Telefono tel={p.telefono} /></span>
          </div>
        ))}
      </div>

      {/* Celular: el nombre arriba, las sucursales debajo y los accesos al final */}
      <div className="space-y-3 p-4 lg:hidden">
        <Link href={`/clientes/${c.id}`} className={`block text-base ${dato}`}>{c.nombre}</Link>
        {puntos.map((p) => (
          <div key={p.id} className={`border-l-2 border-crema-300 pl-3 ${p.activo ? "" : "opacity-60"}`}>
            <p className={dato}>{p.barrio}</p>
            <p className="text-sm">{titulo(p.direccion)}</p>
            <p className="text-sm"><Telefono tel={p.telefono} /></p>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Link href={`/clientes/${c.id}/cuenta`} className={acceso}>Cuenta corriente</Link>
          <Link href={`/clientes/${c.id}/pedidos`} className={acceso}>Pedidos</Link>
        </div>
      </div>
    </div>
  );
}
