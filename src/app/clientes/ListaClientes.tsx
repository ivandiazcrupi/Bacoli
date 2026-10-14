import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { cabeceraTabla } from "@/components/campos";
import { mayus, titulo } from "@/lib/mayusculas";
import { enlaceWhatsApp } from "@/lib/telefonos";

// Aviso de observación: un circulito gris con "!" (sin color, no cambia el alto de la fila); al pasar el mouse o tocarlo se lee el texto.
function IconoObservacion({ texto }: { texto: string }) {
  return (
    <span tabIndex={0} aria-label={`Observación: ${texto}`} className="group relative ml-2 inline-flex h-[18px] w-[18px] cursor-help items-center justify-center rounded-full border border-stone-400 align-middle text-[11px] font-bold leading-none text-stone-500 outline-none hover:border-stone-700 hover:text-stone-800 focus:border-stone-700">
      !
      <span role="tooltip" className="pointer-events-none absolute left-1/2 top-full z-30 mt-1.5 hidden w-64 -translate-x-1/2 whitespace-pre-line rounded-md border border-stone-300 bg-white p-2.5 text-left text-xs font-normal normal-case leading-snug tracking-normal text-stone-800 shadow-lg group-hover:block group-focus:block">{texto}</span>
    </span>
  );
}

// Columnas (PC): barrio, nombre, dirección, teléfono, accesos.
const COLUMNAS_OFICINA = "lg:grid-cols-[1.2fr_1.6fr_2fr_1.1fr_6.5rem_19rem]";
const COLUMNAS_VENDEDOR = "lg:grid-cols-[1.2fr_1.6fr_2fr_1.1fr_6.5rem]";
const acceso = "rounded-md border border-stone-400 bg-white px-2.5 py-1 text-xs font-medium uppercase hover:border-verde-700 hover:text-verde-800";
const accesoEditar = "rounded-md border border-verde-700 bg-white px-2.5 py-1 text-xs font-medium text-verde-800 hover:bg-verde-50";

export type Cliente = Prisma.ClienteGetPayload<{ include: { puntos: { include: { zona: true } } } }>;

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

function FilaCliente({ c, modo }: { c: Cliente; modo: Modo }) {
  const COLUMNAS = modo === "oficina" ? COLUMNAS_OFICINA : COLUMNAS_VENDEDOR;
  const dato = "text-sm font-semibold";
  const puntos: (Cliente["puntos"][number] | null)[] = c.puntos.length ? c.puntos : [null];

  const accesos = modo === "oficina" ? (
    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
      <Link href={`/cuentas/${c.id}`} className={acceso}>Cuenta corriente</Link>
      <Link href={`/clientes/${c.id}/pedidos`} className={acceso}>Pedidos</Link>
      <Link href={`/clientes/${c.id}`} className={accesoEditar}>Editar</Link>
    </div>
  ) : null;
  const nombre = (clase: string) => (modo === "oficina" ? <Link href={`/clientes/${c.id}`} className={`${clase} hover:text-verde-800 hover:underline`}>{c.nombre}</Link> : <span className={clase}>{c.nombre}</span>);

  return (
    <div className={`divide-y divide-stone-200 rounded-xl border border-stone-300 bg-white shadow-sm ${c.activo ? "" : "opacity-60"}`}>
      {puntos.map((p, i) => (
        <div key={p?.id ?? "sin"}>
          {/* PC: barrio, nombre, dirección, teléfono y accesos en una fila */}
          <div className={`hidden items-center gap-x-4 px-4 py-2 lg:grid ${COLUMNAS} ${c.activo && p && !p.activo ? "opacity-60" : ""}`}>
            <span className={dato}>{p ? p.barrio : <span className="font-normal text-stone-400">Sin sucursal</span>}</span>
            <span className="min-w-0">
              {nombre(dato)}
              {c.observacion && <IconoObservacion texto={c.observacion} />}
            </span>
            <span className="text-sm leading-tight">{p ? titulo(p.direccion) : ""}{p?.comentario && <span className="mt-0.5 block text-xs font-medium text-rojo-700">{mayus(p.comentario)}</span>}</span>
            <span className="text-sm"><Telefono tel={p?.telefono ?? null} /></span>
            <span>{p ? <Estado activa={c.activo && p.activo} /> : null}</span>
            {accesos}
          </div>

          {/* Celular: la misma información apilada */}
          <div className={`space-y-1 p-4 lg:hidden ${c.activo && p && !p.activo ? "opacity-60" : ""}`}>
            <p className={`${dato} flex flex-wrap items-center gap-2`}>{p ? p.barrio : "Sin sucursal"}{p && <Estado activa={c.activo && p.activo} />}</p>
            <div className="flex items-center">
              {nombre(dato)}
              {c.observacion && <IconoObservacion texto={c.observacion} />}
            </div>
            {p && <p className="text-sm">{titulo(p.direccion)}</p>}
            {p?.comentario && <p className="text-xs font-medium text-rojo-700">{mayus(p.comentario)}</p>}
            {p && <p className="text-sm"><Telefono tel={p.telefono} /></p>}
            {accesos && <div className="pt-1">{accesos}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

type Modo = "oficina" | "vendedor";

/** La lista de clientes del sistema (una tarjeta por cliente y una línea por sucursal). El vendedor ve la misma, sin los accesos de oficina. */
export function ListaClientes({ clientes, modo = "oficina" }: { clientes: Cliente[]; modo?: Modo }) {
  return (
    <div className="space-y-2">
      <div className={`hidden gap-x-4 rounded-t-xl px-4 py-3 lg:grid ${cabeceraTabla} ${modo === "oficina" ? COLUMNAS_OFICINA : COLUMNAS_VENDEDOR}`}>
        <span>Barrio</span><span>Nombre</span><span>Dirección</span><span>Teléfono</span><span>Estado</span>{modo === "oficina" && <span />}
      </div>
      {clientes.map((c) => <FilaCliente key={c.id} c={c} modo={modo} />)}
    </div>
  );
}
