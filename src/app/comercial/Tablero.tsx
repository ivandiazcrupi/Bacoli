"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
// Paquetes con punto de miles y coma decimal (10.320,5).
const num = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 1 });

export type FilaCliente = {
  id: string; nombre: string; barrios: string;
  ultimo: string | null; sinPedir: number | null;
  ped90: number; paqMes: number; paqAnt: number; paqProm: number; total: number;
};
type Resumen = { activos: number; d7: number; d15: number; sin15: number; inactivos: number; paqMes: number; paqAnt: number };

const fechaCorta = (s: string | null) => (s ? `${s.slice(8)}/${s.slice(5, 7)}/${s.slice(2, 4)}` : "—");
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// Cada cliente cae en UN solo grupo, según hace cuántos días fue su último pedido.
const FILTROS = [
  ["todos", "Todos"],
  ["d7", "Pidieron en los últimos 7 días"],
  ["d15", "Pidieron hace 8 a 15 días"],
  ["s15", "Sin pedir hace 16 a 30 días"],
  ["s30", "Sin pedir hace 31 a 45 días"],
  ["s45", "Sin pedir hace más de 45 días"],
  ["inactivos", "Inactivos"],
] as const;
type Filtro = (typeof FILTROS)[number][0];
const dentro = (f: FilaCliente, k: Filtro) => {
  const d = f.sinPedir;
  switch (k) {
    case "d7": return d !== null && d <= 7;
    case "d15": return d !== null && d >= 8 && d <= 15;
    case "s15": return d !== null && d >= 16 && d <= 30;
    case "s30": return d !== null && d >= 31 && d <= 45;
    case "s45": return d !== null && d > 45;
    case "inactivos": return f.ultimo === null; // nunca hicieron un pedido
    default: return true;
  }
};
type Col = "nombre" | "ultimo" | "sinPedir" | "ped90" | "paqProm" | "paqMes" | "paqAnt";

// Variación contra el mes anterior (completo): ▲ verde si sube, ▼ rojo si baja. El mes en curso todavía no terminó.
function Tendencia({ actual, anterior }: { actual: number; anterior: number }) {
  if (anterior <= 0) return null;
  const p = Math.round(((actual - anterior) / anterior) * 100);
  if (p === 0) return null;
  return <span className={`ml-1.5 text-[11px] font-semibold ${p > 0 ? "text-verde-700" : "text-rojo-700"}`}>{p > 0 ? "▲" : "▼"} {Math.abs(p)}%</span>;
}

function Dato({ titulo, valor, detalle, rojo, ayuda }: { titulo: string; valor: React.ReactNode; detalle?: React.ReactNode; rojo?: boolean; ayuda?: string }) {
  return (
    <div className="flex min-w-[190px] flex-1 flex-col items-center justify-start px-4 py-4 text-center" title={ayuda}>
      <p className="flex min-h-[2.1rem] items-center text-[12px] font-bold uppercase leading-tight tracking-wide text-stone-600">{titulo}</p>
      <p className={`text-3xl font-bold tabular-nums leading-none ${rojo ? "text-rojo-700" : "text-stone-900"}`}>{valor}</p>
      {detalle && <p className="mt-1.5 text-[12.5px] leading-snug text-stone-600">{detalle}</p>}
    </div>
  );
}

export function Tablero({ filas, resumen, mes }: { filas: FilaCliente[]; resumen: Resumen; mes: string }) {
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [orden, setOrden] = useState<{ col: Col; asc: boolean }>({ col: "sinPedir", asc: false });
  const nombreMes = MESES[Number(mes.slice(5)) - 1];

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
  const GRILLA = "grid-cols-[minmax(260px,2.6fr)_120px_130px_120px_130px_130px_150px]";
  const cuentaFiltro = (k: Filtro) => filas.filter((f) => dentro(f, k)).length;

  return (
    <div className="space-y-4">
      {/* Resumen: cada cuadro dice qué cuenta */}
      <section aria-label="Resumen" className="grid grid-cols-2 divide-stone-200 overflow-hidden rounded-lg border border-stone-300 bg-white sm:grid-cols-3 lg:grid-cols-6 lg:divide-x">
        <Dato titulo="Clientes activos" valor={resumen.activos} detalle="en la lista de clientes" />
        <Dato titulo="Pidieron en los últimos 7 días" valor={resumen.d7} detalle="esta semana" />
        <Dato titulo="Pidieron hace 8 a 15 días" valor={resumen.d15} detalle="no pidieron esta semana, pero sí la anterior" />
        <Dato titulo="Sin pedir hace más de 15 días" valor={resumen.sin15} rojo={resumen.sin15 > 0} detalle="compraron antes y hace rato que no piden" />
        <Dato titulo="Inactivos" valor={resumen.inactivos} detalle="cargados como cliente, todavía sin ninguna compra" />
        <Dato titulo={`Paquetes en ${nombreMes}`} valor={<>{num(resumen.paqMes)}<Tendencia actual={resumen.paqMes} anterior={resumen.paqAnt} /></>} detalle={resumen.paqAnt > 0 ? `mes anterior: ${num(resumen.paqAnt)}` : "mes anterior: sin datos cargados"} />
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
        Cada cliente aparece en <b>un solo grupo</b>, según hace cuántos días fue su último pedido. <b>Inactivos</b> son los que figuran como cliente pero todavía no hicieron ningún pedido.
        Se cuentan los pedidos mayoristas cargados que no se cancelaron ni quedaron sin entregar. Paquetes = pizzas ÷ 2, como en la hoja de ruta.
      </p>

      {/* Tabla de clientes */}
      <div className="overflow-x-auto rounded-lg border border-stone-300 bg-white">
        <div className="min-w-[1000px]">
          <div className={`grid items-center gap-x-3 border-b border-stone-300 bg-crema-100 px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-stone-500 ${GRILLA}`}>
            <Titulo col="nombre">Cliente</Titulo>
            <Titulo col="ultimo">Último pedido</Titulo>
            <Titulo col="sinPedir">Días sin pedir</Titulo>
            <Titulo col="ped90">Pedidos 90 d</Titulo>
            <Titulo col="paqProm">Paq. por mes</Titulo>
            <Titulo col="paqMes">Paq. {nombreMes}</Titulo>
            <Titulo col="paqAnt">Paq. mes anterior</Titulo>
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
              <span className="tabular-nums">{f.paqProm > 0 ? num(Math.round(f.paqProm * 2) / 2) : <span className="text-stone-300">—</span>}</span>
              <span className="tabular-nums">{f.paqMes > 0 ? num(f.paqMes) : <span className="text-stone-300">—</span>}<Tendencia actual={f.paqMes} anterior={f.paqAnt} /></span>
              <span className="tabular-nums text-stone-600">{f.paqAnt > 0 ? num(f.paqAnt) : <span className="text-stone-300">—</span>}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-[12px] text-stone-500">{lista.length} {lista.length === 1 ? "cliente" : "clientes"}. Tocá el título de una columna para ordenar; tocá un cliente para ver todo su historial de pedidos.</p>
    </div>
  );
}
