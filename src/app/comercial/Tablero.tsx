"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
export type FilaCliente = {
  id: string; nombre: string; barrios: string;
  ultimo: string | null; sinPedir: number | null;
  ped90: number; total: number;
};
type Resumen = { activos: number; d7: number; sin7: number; sin15: number; sin30: number; sin45: number; inactivos: number };

const fechaCorta = (s: string | null) => (s ? `${s.slice(8)}/${s.slice(5, 7)}/${s.slice(2, 4)}` : "—");
// "Sin pedir hace +N días" suma a todos los que llevan N días o más sin pedir (un cliente sin pedir hace 20 días está en +7 y en +15).
const FILTROS = [
  ["todos", "Todos"],
  ["d7", "Pidieron en los últimos 7 días"],
  ["s7", "Sin pedir hace +7 días"],
  ["s15", "Sin pedir hace +15 días"],
  ["s30", "Sin pedir hace +30 días"],
  ["s45", "Sin pedir hace +45 días"],
  ["inactivos", "Inactivos"],
] as const;
type Filtro = (typeof FILTROS)[number][0];
const dentro = (f: FilaCliente, k: Filtro) => {
  const d = f.sinPedir;
  switch (k) {
    case "d7": return d !== null && d <= 7;
    case "s7": return d !== null && d > 7;
    case "s15": return d !== null && d > 15;
    case "s30": return d !== null && d > 30;
    case "s45": return d !== null && d > 45;
    case "inactivos": return f.ultimo === null; // nunca hicieron un pedido
    default: return true;
  }
};
type Col = "nombre" | "ultimo" | "sinPedir" | "ped90" | "total";

function Dato({ titulo, valor, detalle, rojo, ayuda }: { titulo: string; valor: React.ReactNode; detalle?: React.ReactNode; rojo?: boolean; ayuda?: string }) {
  return (
    <div className="flex min-w-[190px] flex-1 flex-col items-center justify-start px-4 py-4 text-center" title={ayuda}>
      <p className="flex min-h-[2.1rem] items-center text-[12px] font-bold uppercase leading-tight tracking-wide text-stone-600">{titulo}</p>
      <p className={`text-3xl font-bold tabular-nums leading-none ${rojo ? "text-rojo-700" : "text-stone-900"}`}>{valor}</p>
      {detalle && <p className="mt-1.5 text-[12.5px] leading-snug text-stone-600">{detalle}</p>}
    </div>
  );
}

export function Tablero({ filas, resumen }: { filas: FilaCliente[]; resumen: Resumen }) {
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [orden, setOrden] = useState<{ col: Col; asc: boolean }>({ col: "sinPedir", asc: false });

  const lista = useMemo(() => {
    const palabras = q.toLowerCase().split(/\s+/).filter(Boolean);
    let r = filas.filter((f) => {
      if (!palabras.every((w) => `${f.nombre} ${f.barrios}`.toLowerCase().includes(w))) return false;
      return dentro(f, filtro);
    });
    const clave = (f: FilaCliente): string | number => {
      if (orden.col === "nombre") return f.nombre.toLowerCase();
      if (orden.col === "ultimo") return f.ultimo ?? "";
      const v = f[orden.col];
      return v === null ? -1 : v; // los que nunca pidieron van al final al ordenar por días sin pedir
    };
    r = [...r].sort((a, b) => { const x = clave(a), y = clave(b); return (x < y ? -1 : x > y ? 1 : a.nombre.localeCompare(b.nombre)) * (orden.asc ? 1 : -1); });
    return r;
  }, [filas, q, filtro, orden]);

  const ordenarPor = (col: Col) => setOrden((o) => (o.col === col ? { col, asc: !o.asc } : { col, asc: col === "nombre" }));
  const Titulo = ({ col, children, ancho }: { col: Col; children: React.ReactNode; ancho?: string }) => (
    <button type="button" onClick={() => ordenarPor(col)} className={`flex items-center justify-center gap-1 uppercase hover:text-stone-900 ${ancho ?? ""}`}>
      {children}{orden.col === col && <span className="text-verde-700">{orden.asc ? "▲" : "▼"}</span>}
    </button>
  );
  const GRILLA = "grid-cols-[minmax(260px,2.6fr)_130px_140px_130px_130px]";
  const cuentaFiltro = (k: Filtro) => filas.filter((f) => dentro(f, k)).length;

  return (
    <div className="space-y-4">
      {/* Resumen: cada cuadro dice qué cuenta */}
      <section aria-label="Resumen" className="grid grid-cols-2 divide-stone-200 overflow-hidden rounded-lg border border-stone-300 bg-white sm:grid-cols-4 lg:grid-cols-7 lg:divide-x">
        <Dato titulo="Clientes activos" valor={resumen.activos} detalle="en la lista" />
        <Dato titulo="Pidieron en los últimos 7 días" valor={resumen.d7} detalle="esta semana" />
        <Dato titulo="Sin pedir hace +7 días" valor={resumen.sin7} />
        <Dato titulo="Sin pedir hace +15 días" valor={resumen.sin15} />
        <Dato titulo="Sin pedir hace +30 días" valor={resumen.sin30} rojo={resumen.sin30 > 0} />
        <Dato titulo="Sin pedir hace +45 días" valor={resumen.sin45} rojo={resumen.sin45 > 0} />
        <Dato titulo="Inactivos" valor={resumen.inactivos} detalle="todavía sin ninguna compra" />
      </section>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente o barrio…" aria-label="Buscar cliente" className="h-9 w-full max-w-xs rounded-md border border-stone-300 bg-white px-3 text-sm focus:border-verde-700 focus:outline-none" />
        <div role="group" aria-label="Mostrar" className="flex flex-wrap gap-1.5">
          {FILTROS.map(([k, t]) => (
            <button key={k} type="button" aria-pressed={filtro === k} onClick={() => setFiltro(k)} className={`h-9 rounded-full border px-3.5 text-[13px] ${filtro === k ? "border-stone-800 bg-stone-800 font-semibold text-white" : "border-stone-300 bg-white text-stone-700 hover:border-stone-500"}`}>
              {t} <span className={filtro === k ? "text-stone-300" : "text-stone-400"}>{cuentaFiltro(k)}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="-mt-2 text-[12.5px] leading-relaxed text-stone-600">
        <b>Sin pedir hace +N días</b> incluye a todos los que llevan N días o más sin pedir: un cliente que no pide hace 20 días figura en +7 y en +15. <b>Inactivos</b> son los que figuran como cliente pero todavía no hicieron ningún pedido.
        Se cuentan los pedidos mayoristas cargados que no se cancelaron ni quedaron sin entregar.
      </p>

      {/* Tabla de clientes */}
      <div className="overflow-x-auto rounded-lg border border-stone-300 bg-white">
        <div className="min-w-[760px]">
          <div className={`grid items-center gap-x-3 border-b border-stone-300 bg-crema-100 px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-stone-500 ${GRILLA}`}>
            <Titulo col="nombre">Cliente</Titulo>
            <Titulo col="ultimo">Último pedido</Titulo>
            <Titulo col="sinPedir">Días sin pedir</Titulo>
            <Titulo col="ped90">Pedidos 90 d</Titulo>
            <Titulo col="total">Pedidos en total</Titulo>
          </div>
          {lista.length === 0 && <p className="p-10 text-center text-sm text-stone-500">No hay clientes con ese filtro.</p>}
          {lista.map((f) => (
            <div key={f.id} className={`grid h-11 items-center gap-x-3 border-b border-stone-200 px-4 text-center text-[13px] hover:bg-crema-50 ${GRILLA}`}>
              <span className="min-w-0 text-left">
                <Link href={`/clientes/${f.id}/pedidos`} className="block truncate font-semibold hover:underline" title="Ver el historial de pedidos">{f.nombre}</Link>
                {f.barrios && <span className="block truncate text-[11.5px] leading-tight text-stone-500">{f.barrios}</span>}
              </span>
              <span className="tabular-nums text-stone-600">{fechaCorta(f.ultimo)}</span>
              <span>
                {f.sinPedir === null ? <span className="rounded-full bg-crema-100 px-2.5 py-0.5 text-[12px] font-semibold text-stone-500">Inactivo</span>
                  : <span className={`inline-block rounded-full px-2.5 py-0.5 font-bold tabular-nums ${f.sinPedir > 45 ? "bg-rojo-50 text-rojo-700" : f.sinPedir > 15 ? "bg-[#fdf8e3] text-[#8a6a05]" : "text-stone-800"}`}>{f.sinPedir === 0 ? "Hoy" : f.sinPedir}</span>}
              </span>
              <span className="tabular-nums">{f.ped90 || <span className="text-stone-300">0</span>}</span>
              <span className="tabular-nums">{f.total || <span className="text-stone-300">0</span>}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-[12px] text-stone-500">{lista.length} {lista.length === 1 ? "cliente" : "clientes"}. Tocá el título de una columna para ordenar; tocá un cliente para ver todo su historial de pedidos.</p>
    </div>
  );
}
