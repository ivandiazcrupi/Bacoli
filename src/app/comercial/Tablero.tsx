"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
// Paquetes con punto de miles y coma decimal (10.320,5).
const num = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 1 });

export type FilaCliente = {
  id: string; nombre: string; barrios: string;
  ultimo: string | null; sinPedir: number | null; ritmo: number | null; atrasado: boolean;
  ped90: number; paqMes: number; paqAnt: number; paqProm: number; total: number;
};
type Resumen = { activos: number; pidieron30: number; sin30: number; nunca: number; atrasados: number; paqMes: number; paqAnt: number };

const fechaCorta = (s: string | null) => (s ? `${s.slice(8)}/${s.slice(5, 7)}/${s.slice(2, 4)}` : "—");
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const FILTROS = [
  ["todos", "Todos"],
  ["semana", "Pidieron esta semana"],
  ["15", "Sin pedir +15 días"],
  ["30", "Sin pedir +30 días"],
  ["60", "Sin pedir +60 días"],
  ["atrasados", "Atrasados"],
  ["nunca", "Nunca pidieron"],
] as const;
type Filtro = (typeof FILTROS)[number][0];
type Col = "nombre" | "ultimo" | "sinPedir" | "ritmo" | "ped90" | "paqProm" | "paqMes" | "paqAnt";

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
      switch (filtro) {
        case "semana": return f.sinPedir !== null && f.sinPedir <= 7;
        case "15": return f.sinPedir !== null && f.sinPedir > 15;
        case "30": return f.sinPedir !== null && f.sinPedir > 30;
        case "60": return f.sinPedir !== null && f.sinPedir > 60;
        case "atrasados": return f.atrasado;
        case "nunca": return f.ultimo === null;
        default: return true;
      }
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
  const GRILLA = "grid-cols-[minmax(240px,2.4fr)_112px_120px_100px_110px_120px_130px_140px]";
  const cuentaFiltro = (k: Filtro) => (k === "todos" ? filas.length : filas.filter((f) => {
    switch (k) { case "semana": return f.sinPedir !== null && f.sinPedir <= 7; case "15": return f.sinPedir !== null && f.sinPedir > 15; case "30": return f.sinPedir !== null && f.sinPedir > 30; case "60": return f.sinPedir !== null && f.sinPedir > 60; case "atrasados": return f.atrasado; case "nunca": return f.ultimo === null; default: return true; }
  }).length);

  return (
    <div className="space-y-4">
      {/* Resumen: cada cuadro dice qué cuenta y qué significa */}
      <section aria-label="Resumen" className="grid grid-cols-2 divide-stone-200 overflow-hidden rounded-lg border border-stone-300 bg-white sm:grid-cols-3 lg:grid-cols-6 lg:divide-x">
        <Dato titulo="Clientes activos" valor={resumen.activos} detalle="en la lista de clientes" />
        <Dato titulo="Pidieron en los últimos 30 días" valor={resumen.pidieron30} detalle={`${resumen.activos ? Math.round((resumen.pidieron30 / resumen.activos) * 100) : 0}% de los clientes activos`} />
        <Dato titulo="Dejaron de pedir" valor={resumen.sin30} rojo={resumen.sin30 > 0} detalle="compraron antes, pero hace más de 30 días que no piden" />
        <Dato titulo="Atrasados" valor={resumen.atrasados} rojo={resumen.atrasados > 0} detalle="hace más tiempo que lo habitual en ellos que no piden (explicado abajo)" ayuda="Un cliente está atrasado cuando ya pasó bastante más tiempo del que suele tardar entre un pedido y otro." />
        <Dato titulo="Nunca pidieron" valor={resumen.nunca} detalle="cargados como cliente, todavía sin ninguna compra" />
        <Dato titulo={`Paquetes en ${nombreMes}`} valor={<>{num(resumen.paqMes)}<Tendencia actual={resumen.paqMes} anterior={resumen.paqAnt} /></>} detalle={resumen.paqAnt > 0 ? `mes anterior: ${num(resumen.paqAnt)}` : "mes anterior: sin datos cargados"} />
      </section>
      <p className="-mt-2 rounded-md border border-stone-200 bg-white px-4 py-2.5 text-[13px] leading-relaxed text-stone-700">
        <b>¿Qué es "atrasado"?</b> Mirando los pedidos de los últimos 6 meses, el sistema calcula cada cuántos días suele pedir cada cliente (la columna <b>"Pide cada"</b>). Si ya pasó bastante más tiempo que ese (más de una vez y media), figura como atrasado: es la señal para llamarlo antes de que deje de comprar. Hace falta que haya pedido al menos 3 veces. Ejemplo: si pide cada 7 días y hace 15 que no pide, está atrasado.
        <span className="mt-1 block text-[12px] text-stone-500">Se cuentan los pedidos mayoristas cargados que no se cancelaron ni quedaron sin entregar. Paquetes = pizzas ÷ 2, como en la hoja de ruta. La flecha compara contra el mes anterior completo (el mes en curso todavía no terminó).</span>
      </p>

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

      {/* Tabla de clientes */}
      <div className="overflow-x-auto rounded-lg border border-stone-300 bg-white">
        <div className="min-w-[1000px]">
          <div className={`grid items-center gap-x-3 border-b border-stone-300 bg-crema-100 px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-stone-500 ${GRILLA}`}>
            <Titulo col="nombre">Cliente</Titulo>
            <Titulo col="ultimo">Último pedido</Titulo>
            <Titulo col="sinPedir">Días sin pedir</Titulo>
            <Titulo col="ritmo">Pide cada</Titulo>
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
                {f.sinPedir === null ? <span className="rounded-full bg-crema-100 px-2.5 py-0.5 text-[12px] font-semibold text-stone-500">Nunca</span>
                  : <span className={`inline-block rounded-full px-2.5 py-0.5 font-bold tabular-nums ${f.sinPedir > 60 ? "bg-rojo-50 text-rojo-700" : f.sinPedir > 30 || f.atrasado ? "bg-[#fdf8e3] text-[#8a6a05]" : "text-stone-800"}`} title={f.atrasado ? `Suele pedir cada ${f.ritmo} días y ya pasó más tiempo: está atrasado` : undefined}>{f.sinPedir === 0 ? "Hoy" : f.sinPedir}</span>}
              </span>
              <span className="tabular-nums text-stone-600">{f.ritmo !== null ? `${f.ritmo} d` : <span className="text-stone-300">—</span>}</span>
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
