"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { num } from "@/lib/ruta";
import { FiltroLista, SEP } from "../cuentas/FiltroLista";
export type FilaCliente = {
  id: string; nombre: string; barrios: string;
  ultimo: string | null; sinPedir: number | null;
  ritmo: number | null; paq30: number; total: number; telefono: string | null; wa: string | null;
};
type Resumen = { activos: number; d7: number; s7: number; s15: number; s30: number; s45: number; inactivos: number };

const fechaCorta = (s: string | null) => (s ? `${s.slice(8)}/${s.slice(5, 7)}/${s.slice(2, 4)}` : "—");
// Cada cliente cae en UN solo grupo, según hace cuántos días fue su último pedido. La aclaración sale al pasar el mouse.
const FILTROS = [
  ["todos", "Todos", "Todos los clientes activos."],
  ["d7", "Pidieron en los últimos 7 días", "Su último pedido fue hace 7 días o menos."],
  ["s7", "Sin pedir hace 7 días", "Su último pedido fue hace más de 7 y hasta 15 días."],
  ["s15", "Sin pedir hace 15 días", "Su último pedido fue hace más de 15 y hasta 30 días."],
  ["s30", "Sin pedir hace 30 días", "Su último pedido fue hace más de 30 y hasta 45 días."],
  ["s45", "Sin pedir hace 45 días", "Su último pedido fue hace más de 45 días."],
  ["inactivos", "Inactivos", "Figuran como cliente, pero todavía no hicieron ningún pedido."],
] as const;
type Filtro = (typeof FILTROS)[number][0];
const AYUDA = Object.fromEntries(FILTROS.map(([k, , a]) => [k, a])) as Record<Filtro, string>;
const dentro = (f: FilaCliente, k: Filtro) => {
  const d = f.sinPedir;
  switch (k) {
    case "d7": return d !== null && d <= 7;
    case "s7": return d !== null && d > 7 && d <= 15;
    case "s15": return d !== null && d > 15 && d <= 30;
    case "s30": return d !== null && d > 30 && d <= 45;
    case "s45": return d !== null && d > 45;
    case "inactivos": return f.ultimo === null; // nunca hicieron un pedido
    default: return true;
  }
};
// Filtro numérico: "15" (exacto), ">15", ">=15", "<7", "<=7". Una celda sin dato (—) no cumple ningún número.
function coincideNumero(valor: number | null, filtro: string) {
  const t = filtro.trim();
  if (!t) return true;
  const m = t.match(/^(>=|<=|>|<|=)?\s*(\d+(?:[.,]\d+)?)$/);
  if (!m) return true; // todavía escribiendo (ej. ">"): no filtra
  if (valor === null) return false;
  const n = Number(m[2].replace(",", "."));
  switch (m[1]) { case ">": return valor > n; case ">=": return valor >= n; case "<": return valor < n; case "<=": return valor <= n; default: return valor === n; }
}
const estadoContacto = (f: FilaCliente) => (f.wa ? "Con WhatsApp" : f.telefono ? "Teléfono no válido" : "Sin teléfono");
const entradaFiltro = "h-7 w-full min-w-0 rounded border border-stone-300 bg-white px-1.5 text-center text-[12px] font-normal normal-case tracking-normal text-stone-800 placeholder:text-stone-300 focus:border-verde-700 focus:outline-none";

type Col = "nombre" | "ultimo" | "sinPedir" | "ritmo" | "paq30";

// Tono de cada tarjeta: verde = pidieron; rojo (cada vez más fuerte con los días) = hay clientes sin pedir; gris = nada para mirar.
const TONOS: Record<string, { caja: string; numero: string; barra: string }> = {
  neutro: { caja: "border-stone-300 bg-white", numero: "text-stone-900", barra: "bg-stone-300" },
  apagado: { caja: "border-stone-200 bg-crema-50", numero: "text-stone-400", barra: "bg-stone-200" },
  verde: { caja: "border-verde-300 bg-verde-50", numero: "text-verde-700", barra: "bg-verde-600" },
  rojo1: { caja: "border-rojo-200 bg-rojo-50", numero: "text-rojo-700", barra: "bg-rojo-300" },
  rojo2: { caja: "border-rojo-300 bg-rojo-50", numero: "text-rojo-700", barra: "bg-rojo-400" },
  rojo3: { caja: "border-rojo-400 bg-rojo-100", numero: "text-rojo-700", barra: "bg-rojo-500" },
  rojo4: { caja: "border-rojo-600 bg-rojo-100", numero: "text-rojo-800", barra: "bg-rojo-700" },
};

function Tarjeta({ titulo, valor, tono, activa, ayuda, onClick }: { titulo: string; valor: number; tono: keyof typeof TONOS; activa: boolean; ayuda: string; onClick: () => void }) {
  const t = TONOS[tono];
  // La tarjeta elegida se marca con un borde grueso negro (outline: las sombras están apagadas en todo el sistema), una flechita hacia la tabla y el texto "Mostrando abajo".
  return (
    <div className="relative">
      <button type="button" onClick={onClick} title={ayuda} aria-pressed={activa}
        className={`group relative flex h-full w-full flex-col items-center overflow-hidden rounded-xl border px-3 pb-3 pt-4 text-center transition hover:-translate-y-0.5 hover:shadow-md ${t.caja} ${activa ? "outline outline-[3px] outline-offset-2 outline-stone-800" : ""}`}>
        <span className={`absolute inset-x-0 top-0 h-1.5 ${t.barra}`} />
        <span className="flex min-h-[2rem] w-full items-center justify-center whitespace-normal text-[11.5px] font-bold uppercase leading-tight tracking-wide text-stone-600">{titulo}</span>
        <span className={`mt-1 text-4xl font-extrabold tabular-nums leading-none ${t.numero}`}>{valor}</span>
        <span className={`mt-2 text-[12px] ${activa ? "font-bold text-stone-900" : "font-medium text-stone-500 group-hover:text-stone-800"}`}>{activa ? "● Mostrando abajo" : valor === 0 ? "Ninguno" : "Ver clientes ›"}</span>
      </button>
      {activa && <span aria-hidden className="absolute -bottom-[15px] left-1/2 h-0 w-0 -translate-x-1/2 border-x-[10px] border-t-[10px] border-x-transparent border-t-stone-800" />}
    </div>
  );
}

export function Tablero({ filas, resumen }: { filas: FilaCliente[]; resumen: Resumen }) {
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [orden, setOrden] = useState<{ col: Col; asc: boolean }>({ col: "sinPedir", asc: false });
  const tabla = useRef<HTMLDivElement>(null);
  // Filtros de la tabla (como los de Cuenta corriente): arriba de cada columna.
  const [fCliente, setFCliente] = useState("");   // varios clientes (unidos con SEP)
  const [fUltimo, setFUltimo] = useState("");
  const [fSin, setFSin] = useState("");           // número: ej. 15, >15, <=7
  const [fRitmo, setFRitmo] = useState("");
  const [fPaq, setFPaq] = useState("");
  const [fContacto, setFContacto] = useState(""); // varios (unidos con SEP)
  const hayFiltros = !!(fCliente || fUltimo.trim() || fSin.trim() || fRitmo.trim() || fPaq.trim() || fContacto);
  const quitarFiltros = () => { setFCliente(""); setFUltimo(""); setFSin(""); setFRitmo(""); setFPaq(""); setFContacto(""); };
  // Al tocar una tarjeta se filtra la tabla y se baja hasta ella.
  const elegir = (k: Filtro) => { setFiltro(k); setTimeout(() => tabla.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); };

  const lista = useMemo(() => {
    const palabras = q.toLowerCase().split(/\s+/).filter(Boolean);
    let r = filas.filter((f) => {
      if (!palabras.every((w) => `${f.nombre} ${f.barrios}`.toLowerCase().includes(w))) return false;
      if (!dentro(f, filtro)) return false;
      if (fCliente && !fCliente.split(SEP).includes(f.nombre)) return false;
      if (fUltimo.trim() && !fechaCorta(f.ultimo).includes(fUltimo.trim())) return false;
      if (!coincideNumero(f.sinPedir, fSin) || !coincideNumero(f.ritmo, fRitmo) || !coincideNumero(f.paq30, fPaq)) return false;
      if (fContacto && !fContacto.split(SEP).includes(estadoContacto(f))) return false;
      return true;
    });
    const clave = (f: FilaCliente): string | number => {
      if (orden.col === "nombre") return f.nombre.toLowerCase();
      if (orden.col === "ultimo") return f.ultimo ?? "";
      const v = f[orden.col];
      return v === null ? -1 : v; // los que nunca pidieron van al final al ordenar por días sin pedir
    };
    r = [...r].sort((a, b) => { const x = clave(a), y = clave(b); return (x < y ? -1 : x > y ? 1 : a.nombre.localeCompare(b.nombre)) * (orden.asc ? 1 : -1); });
    return r;
  }, [filas, q, filtro, orden, fCliente, fUltimo, fSin, fRitmo, fPaq, fContacto]);

  const ordenarPor = (col: Col) => setOrden((o) => (o.col === col ? { col, asc: !o.asc } : { col, asc: col === "nombre" }));
  const Titulo = ({ col, children, ancho, ayuda }: { col: Col; children: React.ReactNode; ancho?: string; ayuda?: string }) => (
    <button type="button" title={ayuda} onClick={() => ordenarPor(col)} className={`flex items-center justify-center gap-1 uppercase hover:text-stone-900 ${ancho ?? ""}`}>
      {children}{orden.col === col && <span className="text-verde-700">{orden.asc ? "▲" : "▼"}</span>}
    </button>
  );
  const nombres = useMemo(() => filas.map((f) => f.nombre).sort((a, b) => a.localeCompare(b, "es")), [filas]);
  const GRILLA = "grid-cols-[minmax(260px,2.6fr)_120px_110px_110px_130px_130px]";

  return (
    <div className="space-y-4">
      {/* Tarjetas: cada una filtra la tabla de abajo y baja hasta ella */}
      <section aria-label="Resumen" className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Tarjeta titulo="Clientes activos" valor={resumen.activos} tono="neutro" activa={filtro === "todos"} ayuda={AYUDA.todos} onClick={() => elegir("todos")} />
        <Tarjeta titulo="Pidieron en los últimos 7 días" valor={resumen.d7} tono={resumen.d7 > 0 ? "verde" : "apagado"} activa={filtro === "d7"} ayuda={AYUDA.d7} onClick={() => elegir("d7")} />
        <Tarjeta titulo="Sin pedir hace 7 días" valor={resumen.s7} tono={resumen.s7 > 0 ? "rojo1" : "apagado"} activa={filtro === "s7"} ayuda={AYUDA.s7} onClick={() => elegir("s7")} />
        <Tarjeta titulo="Sin pedir hace 15 días" valor={resumen.s15} tono={resumen.s15 > 0 ? "rojo2" : "apagado"} activa={filtro === "s15"} ayuda={AYUDA.s15} onClick={() => elegir("s15")} />
        <Tarjeta titulo="Sin pedir hace 30 días" valor={resumen.s30} tono={resumen.s30 > 0 ? "rojo3" : "apagado"} activa={filtro === "s30"} ayuda={AYUDA.s30} onClick={() => elegir("s30")} />
        <Tarjeta titulo="Sin pedir hace 45 días" valor={resumen.s45} tono={resumen.s45 > 0 ? "rojo4" : "apagado"} activa={filtro === "s45"} ayuda={AYUDA.s45} onClick={() => elegir("s45")} />
        <Tarjeta titulo="Inactivos" valor={resumen.inactivos} tono={resumen.inactivos > 0 ? "neutro" : "apagado"} activa={filtro === "inactivos"} ayuda={AYUDA.inactivos} onClick={() => elegir("inactivos")} />
      </section>

      {/* Buscador y qué se está mostrando */}
      <div ref={tabla} className="flex scroll-mt-4 flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente o barrio…" aria-label="Buscar cliente" className="h-10 w-full max-w-xs rounded-md border border-stone-300 bg-white px-3 text-sm focus:border-verde-700 focus:outline-none" />
        <p className="text-[14px] text-stone-700">
          Mostrando: <b>{FILTROS.find((f) => f[0] === filtro)![1]}</b> · {lista.length} {lista.length === 1 ? "cliente" : "clientes"}
          {filtro !== "todos" && <button type="button" onClick={() => setFiltro("todos")} className="ml-3 rounded-full border border-stone-300 bg-white px-3 py-1 text-[12.5px] font-semibold text-stone-700 hover:border-stone-600">Ver todos ✕</button>}
          {hayFiltros && <button type="button" onClick={quitarFiltros} className="ml-3 rounded-full border border-stone-300 bg-white px-3 py-1 text-[12.5px] font-semibold text-stone-700 hover:border-stone-600">Quitar filtros de la tabla ✕</button>}
        </p>
      </div>

      {/* Tabla de clientes */}
      <div className="overflow-x-auto rounded-lg border border-stone-300 bg-white">
        <div className="min-w-[900px]">
          <div className="border-b border-stone-300 bg-crema-100">
          <div className={`grid items-center gap-x-3 px-4 pt-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-stone-500 ${GRILLA}`}>
            <Titulo col="nombre">Cliente</Titulo>
            <Titulo col="ultimo" ayuda="Fecha del último pedido cargado.">Último pedido</Titulo>
            <Titulo col="sinPedir" ayuda="Días que pasaron desde su último pedido.">Sin pedir</Titulo>
            <Titulo col="ritmo" ayuda="Cada cuántos días suele pedir, según sus pedidos de los últimos 6 meses. Hacen falta al menos 2 pedidos.">Pide cada</Titulo>
            <Titulo col="paq30" ayuda="Paquetes pedidos en los últimos 30 días (pizzas ÷ 2).">Paquetes 30 días</Titulo>
            <span>Contactar</span>
          </div>
            <div className={`grid items-center gap-x-3 px-4 pb-2.5 pt-1.5 ${GRILLA}`}>
              <FiltroLista varios titulo="Cliente" opciones={nombres} valor={fCliente} onCambio={setFCliente} />
              <input aria-label="Filtrar último pedido" value={fUltimo} onChange={(e) => setFUltimo(e.target.value)} placeholder="Ej: 03/10" className={entradaFiltro} />
              <input aria-label="Filtrar días sin pedir" value={fSin} onChange={(e) => setFSin(e.target.value)} placeholder="Ej: >15" title="Número exacto o con signo: 15, >15, >=15, <7" className={entradaFiltro} />
              <input aria-label="Filtrar cada cuánto pide" value={fRitmo} onChange={(e) => setFRitmo(e.target.value)} placeholder="Ej: <10" title="Número exacto o con signo: 7, >7, <=10" className={entradaFiltro} />
              <input aria-label="Filtrar paquetes" value={fPaq} onChange={(e) => setFPaq(e.target.value)} placeholder="Ej: >=50" title="Número exacto o con signo: 50, >50, <10" className={entradaFiltro} />
              <FiltroLista varios titulo="Contactar" opciones={["Con WhatsApp", "Sin teléfono", "Teléfono no válido"]} valor={fContacto} onCambio={setFContacto} />
            </div>
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
              <span className="tabular-nums text-stone-700" title={f.ritmo !== null ? `Suele pedir cada ${f.ritmo} días` : "Todavía no hay pedidos suficientes para saberlo"}>{f.ritmo !== null ? `${f.ritmo} ${f.ritmo === 1 ? "día" : "días"}` : <span className="text-stone-300">—</span>}</span>
              <span className="tabular-nums">{f.paq30 > 0 ? num(f.paq30) : <span className="text-stone-300">0</span>}</span>
              <span>
                {f.wa ? <a href={f.wa} target="_blank" rel="noreferrer" title={`Escribirle por WhatsApp${f.telefono ? ` · ${f.telefono}` : ""}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-verde-700 bg-white px-3 text-[12.5px] font-semibold text-verde-800 hover:bg-verde-700 hover:text-white">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .6l-.4.6c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.4.1.6-.1l.8-1c.2-.3.4-.2.6-.1l1.8.9c.3.1.5.2.5.3.1.2.1.8-.1 1.4Z" /></svg>
                  WhatsApp
                </a> : <span className="text-[12px] text-stone-300" title={f.telefono ? "El teléfono cargado no sirve para WhatsApp" : "No tiene teléfono cargado"}>{f.telefono ? "Teléfono no válido" : "Sin teléfono"}</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-[12px] text-stone-500">{lista.length} {lista.length === 1 ? "cliente" : "clientes"}. Tocá el título de una columna para ordenar; tocá un cliente para ver todo su historial de pedidos.</p>
    </div>
  );
}
