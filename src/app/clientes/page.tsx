import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Cabecera } from "@/components/Cabecera";
import { cabeceraTabla } from "@/components/campos";
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
          <div className="space-y-2">
            <div className={`hidden gap-x-4 rounded-t-xl px-4 py-3 lg:grid ${cabeceraTabla} ${COLUMNAS}`}>
              <span>Barrio</span><span>Nombre</span><span>Dirección</span><span>Teléfono</span><span>Estado</span><span />
            </div>
            {clientes.map((c) => <FilaCliente key={c.id} c={c} />)}
          </div>
        )}
      </main>
    </>
  );
}

// Columnas (PC): barrio, nombre, dirección, teléfono, accesos.
const COLUMNAS = "lg:grid-cols-[1.2fr_1.6fr_2fr_1.1fr_6.5rem_19rem]";
const acceso = "rounded-md border border-stone-400 bg-white px-2.5 py-1 text-xs font-medium uppercase hover:border-verde-700 hover:text-verde-800";
const accesoEditar = "rounded-md border border-verde-700 bg-white px-2.5 py-1 text-xs font-medium text-verde-800 hover:bg-verde-50";

type Cliente = Prisma.ClienteGetPayload<{ include: { puntos: { include: { zona: true } } } }>;

// El teléfono es un enlace: al tocarlo abre WhatsApp para escribirle (si el número no sirve para WhatsApp, llama).
function Telefono({ tel }: { tel: string | null }) {
  if (!tel) return <span className="text-stone-400">—</span>;
  const wa = enlaceWhatsApp(tel);
  return wa
    ? <a href={wa} target="_blank" rel="noreferrer" className="hover:text-verde-800 hover:underline">{tel}</a>
    : <a href={`tel:${tel.replace(/[^\d+]/g, "")}`} className="hover:text-verde-800 hover:underline">{tel}</a>;
}

// Cada cliente es un cuadrante. Sus sucursales van todas a la vista, una debajo de otra y TODAS con la misma información
// (barrio, nombre, dirección, teléfono y accesos), así cada línea se entiende sola.
function Estado({ activa }: { activa: boolean }) {
  return activa
    ? <span className="rounded-full bg-verde-100 px-2 py-0.5 text-xs font-semibold text-verde-800">Activa</span>
    : <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs font-semibold text-stone-600">Desactivada</span>;
}

function FilaCliente({ c }: { c: Cliente }) {
  const dato = "text-sm font-semibold";
  const puntos: (Cliente["puntos"][number] | null)[] = c.puntos.length ? c.puntos : [null];

  const accesos = (
    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
      <Link href={`/cuentas/${c.id}`} className={acceso}>Cuenta corriente</Link>
      <Link href={`/clientes/${c.id}/pedidos`} className={acceso}>Pedidos</Link>
      <Link href={`/clientes/${c.id}`} className={accesoEditar}>Editar</Link>
    </div>
  );

  return (
    <div className={`divide-y divide-stone-200 rounded-xl border border-stone-300 bg-white shadow-sm ${c.activo ? "" : "opacity-60"}`}>
      {puntos.map((p, i) => (
        <div key={p?.id ?? "sin"}>
          {/* PC: barrio, nombre, dirección, teléfono y accesos en una fila */}
          <div className={`hidden items-center gap-x-4 px-4 py-2 lg:grid ${COLUMNAS} ${p && !p.activo ? "opacity-60" : ""}`}>
            <span className={dato}>{p ? p.barrio : <span className="font-normal text-stone-400">Sin sucursal</span>}</span>
            <Link href={`/clientes/${c.id}`} className={`${dato} hover:text-verde-800 hover:underline`}>{c.nombre}</Link>{c.observacion && <span title={c.observacion} aria-label={`Importante: ${c.observacion}`} className="ml-1.5 cursor-help font-bold text-rojo-700">⚠</span>}
            <span className="text-sm leading-tight">{p ? titulo(p.direccion) : ""}{p?.comentario && <span className="mt-0.5 block text-xs font-medium text-rojo-700">{p.comentario}</span>}</span>
            <span className="text-sm"><Telefono tel={p?.telefono ?? null} /></span>
            <span>{p ? <Estado activa={c.activo && p.activo} /> : null}</span>
            {accesos}
          </div>

          {/* Celular: la misma información apilada */}
          <div className={`space-y-1 p-4 lg:hidden ${p && !p.activo ? "opacity-60" : ""}`}>
            <p className={`${dato} flex flex-wrap items-center gap-2`}>{p ? p.barrio : "Sin sucursal"}{p && <Estado activa={c.activo && p.activo} />}</p>
            <Link href={`/clientes/${c.id}`} className={`block ${dato}`}>{c.nombre}{c.observacion && <span title={c.observacion} className="ml-1.5 font-bold text-rojo-700">⚠</span>}</Link>
            {p && <p className="text-sm">{titulo(p.direccion)}</p>}
            {p?.comentario && <p className="text-xs font-medium text-rojo-700">{p.comentario}</p>}
            {p && <p className="text-sm"><Telefono tel={p.telefono} /></p>}
            <div className="pt-1">{accesos}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
