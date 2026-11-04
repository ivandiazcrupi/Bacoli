"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { num } from "@/lib/ruta";
import { coincideNumero } from "@/lib/filtroNumero";
import { FiltroLista, SEP } from "../cuentas/FiltroLista";
export type FilaCliente = {
  id: string; clienteId: string; nombre: string; barrios: string;
  ultimo: string | null; entrega: string | null; sinEntrega: number | null; dif: number | null; enCurso: string | null;
  ritmo: number | null; paq30: number; total: number; telefono: string | null; wa: string | null;
};

const fechaCorta = (s: string | null) => (s ? `${s.slice(8)}/${s.slice(5, 7)}/${s.slice(2, 4)}` : "—");
// Cada cliente cae en UN solo grupo, según hace cuántos días fue su última ENTREGA (no su último pedido). La aclaración sale al pasar el mouse.
const FILTROS = [
  ["todos", "Todos", "Todos los clientes activos."],
  ["curso", "Con pedido en curso", "Ya pidieron y el pedido todavía no se entregó (tiene día de entrega o espera día): no hace falta llamarlos."],
  ["d7", "Recibieron en los últimos 7 días", "Se les entregó hace 7 días o menos."],
  ["s7", "Sin entrega hace 7 días", "Su última entrega fue hace más de 7 y hasta 15 días."],
  ["s15", "Sin entrega hace 15 días", "Su última entrega fue hace más de 15 y hasta 30 días."],
  ["s30", "Sin entrega hace 30 días", "Su última entrega fue hace más de 30 y hasta 45 días."],
  ["s45", "Sin entrega hace 45 días", "Su última entrega fue hace más de 45 días."],
  ["inactivos", "Nunca recibieron", "Figuran como cliente, pero todavía no se les entregó ningún pedido."],
] as const;
type Filtro = (typeof FILTROS)[number][0];
const AYUDA = Object.fromEntries(FILTROS.map(([k, , a]) => [k, a])) as Record<Filtro, string>;
// Grupo de un cliente (uno solo, sin acumular). Con un pedido en curso no hay que llamarlo: queda solo en su grupo.
const grupoDe = (f: FilaCliente): Exclude<Filtro, "todos"> => {
  const d = f.sinEntrega;
  if (f.enCurso !== null) return "curso";
  if (d === null) return "inactivos"; // todavía no se les entregó nada
  return d <= 7 ? "d7" : d <= 15 ? "s7" : d <= 30 ? "s15" : d <= 45 ? "s30" : "s45";
};
const dentro = (f: FilaCliente, k: Filtro) => k === "todos" || grupoDe(f) === k;
const estadoContacto = (f: FilaCliente) => (f.wa ? "Con WhatsApp" : f.telefono ? "Teléfono no válido" : "Sin teléfono");
const entradaFiltro = "h-7 w-full min-w-0 rounded border border-stone-300 bg-white px-1.5 text-center text-[12px] font-normal normal-case tracking-normal text-stone-800 placeholder:text-stone-300 focus:border-verde-700 focus:outline-none";

type Col = "nombre" | "ultimo" | "entrega" | "sinEntrega" | "dif" | "ritmo" | "paq30";

// Tarjetas minimalistas: blancas, con el número en color (verde = pidieron, rojo = hay clientes sin pedir). La elegida se pinta en gris oscuro.
const COLOR_NUM: Record<string, string> = { neutro: "text-stone-900", apagado: "text-stone-300", verde: "text-verde-700", rojo1: "text-rojo-600", rojo2: "text-rojo-600", rojo3: "text-rojo-700", rojo4: "text-rojo-800" };

function Tarjeta({ titulo, valor, tono, activa, ayuda, onClick, onQuitar }: { titulo: string; valor: number; tono: string; activa: boolean; ayuda: string; onClick: () => void; onQuitar?: () => void }) {
  return (
    <div className="relative">
      <button type="button" onClick={onClick} title={ayuda} aria-pressed={activa}
        className={`flex h-[92px] w-full flex-col items-center justify-between rounded-lg border px-6 pb-2 pt-2 text-center transition ${activa ? "border-stone-800 bg-stone-800" : "border-stone-300 bg-white hover:border-stone-500"}`}>
        <span className={`flex h-8 w-full items-center justify-center whitespace-normal text-[11px] font-semibold uppercase leading-tight tracking-wide ${activa ? "text-stone-300" : "text-stone-500"}`}>{titulo}</span>
        <span className={`flex flex-1 items-center text-3xl font-bold tabular-nums leading-none ${activa ? "text-white" : COLOR_NUM[tono]}`}>{valor}</span>
      </button>
      {activa && onQuitar && <button type="button" onClick={onQuitar} aria-label="Salir de este filtro" title="Salir de este filtro" className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded text-[15px] font-bold leading-none text-stone-300 hover:bg-stone-600 hover:text-white">✕</button>}
    </div>
  );
}

export function Tablero({ clientes, sucursales }: { clientes: FilaCliente[]; sucursales: FilaCliente[] }) {
  // Se puede mirar por cliente (todas sus sucursales juntas) o por sucursal; se acuerda de lo último que se eligió.
  // Siempre arranca "Por sucursal" (pedido del dueño); se puede pasar a "Por cliente" mientras se está en la pantalla, pero al volver a entrar vuelve a sucursales.
  const [vista, setVista] = useState<"clientes" | "sucursales">("sucursales");
  const cambiarVista = (v: "clientes" | "sucursales") => setVista(v);
  const filas = vista === "clientes" ? clientes : sucursales;
  const unidad = vista === "clientes" ? ["cliente", "clientes"] : ["sucursal", "sucursales"];
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [orden, setOrden] = useState<{ col: Col; asc: boolean }>({ col: "sinEntrega", asc: false });
  // Filtros de la tabla (como los de Cuenta corriente): arriba de cada columna.
  const [fCliente, setFCliente] = useState("");   // varios clientes (unidos con SEP)
  const [fUltimo, setFUltimo] = useState("");   // fecha del último pedido
  const [fEntrega, setFEntrega] = useState("");  // fecha de la última entrega
  const [fSin, setFSin] = useState("");           // días sin entrega, número: ej. 15, >15, <=7
  const [fDif, setFDif] = useState("");           // días entre pedido y entrega
  const [fRitmo, setFRitmo] = useState("");
  const [fPaq, setFPaq] = useState("");
  const [fContacto, setFContacto] = useState(""); // varios (unidos con SEP)
  const hayFiltros = !!(fCliente || fUltimo.trim() || fEntrega.trim() || fSin.trim() || fDif.trim() || fRitmo.trim() || fPaq.trim() || fContacto);
  const quitarFiltros = () => { setFCliente(""); setFUltimo(""); setFEntrega(""); setFSin(""); setFDif(""); setFRitmo(""); setFPaq(""); setFContacto(""); };
  const elegir = (k: Filtro) => setFiltro(k); // al tocar una tarjeta solo cambia la tabla: la pantalla no se mueve

  // Lo que dicen el buscador y los filtros de las columnas, sin mirar la tarjeta elegida: de acá salen los números de las tarjetas.
  const base = useMemo(() => {
    const palabras = q.toLowerCase().split(/\s+/).filter(Boolean);
    return filas.filter((f) => {
      if (!palabras.every((w) => `${f.nombre} ${f.barrios}`.toLowerCase().includes(w))) return false;
      if (fCliente && !fCliente.split(SEP).includes(f.nombre)) return false;
      if (fUltimo.trim() && !fechaCorta(f.ultimo).includes(fUltimo.trim())) return false;
      if (fEntrega.trim() && !fechaCorta(f.entrega).includes(fEntrega.trim())) return false;
      if (!coincideNumero(f.sinEntrega, fSin) || !coincideNumero(f.dif, fDif) || !coincideNumero(f.ritmo, fRitmo) || !coincideNumero(f.paq30, fPaq)) return false;
      if (fContacto && !fContacto.split(SEP).includes(estadoContacto(f))) return false;
      return true;
    });
  }, [filas, q, fCliente, fUltimo, fEntrega, fSin, fDif, fRitmo, fPaq, fContacto]);

  const resumen = useMemo(() => {
    const r = { activos: base.length, curso: 0, d7: 0, s7: 0, s15: 0, s30: 0, s45: 0, inactivos: 0 };
    for (const f of base) r[grupoDe(f)]++;
    return r;
  }, [base]);

  const lista = useMemo(() => {
    let r = base.filter((f) => dentro(f, filtro));
    const clave = (f: FilaCliente): string | number => {
      if (orden.col === "nombre") return f.nombre.toLowerCase();
      if (orden.col === "ultimo") return f.ultimo ?? "";
      if (orden.col === "entrega") return f.entrega ?? "";
      if (orden.col === "sinEntrega" && f.enCurso !== null) return -1; // con pedido en curso van al final: los primeros son los que hay que llamar
      const v = f[orden.col];
      return v === null ? -Infinity : v; // los que nunca recibieron van al final al ordenar por días sin entrega
    };
    r = [...r].sort((a, b) => { const x = clave(a), y = clave(b); const principal = x < y ? -1 : x > y ? 1 : 0; return principal * (orden.asc ? 1 : -1) || a.nombre.localeCompare(b.nombre, "es") || a.barrios.localeCompare(b.barrios, "es"); }); // los empates siempre quedan de la A a la Z
    return r;
  }, [base, filtro, orden]);

  const ordenarPor = (col: Col) => setOrden((o) => (o.col === col ? { col, asc: !o.asc } : { col, asc: col === "nombre" }));
  const Titulo = ({ col, children, ancho, ayuda }: { col: Col; children: React.ReactNode; ancho?: string; ayuda?: string }) => (
    <button type="button" title={ayuda} onClick={() => ordenarPor(col)} className={`flex items-center justify-center gap-1 uppercase hover:text-stone-900 ${ancho ?? ""}`}>
      {children}{orden.col === col && <span className="text-verde-700">{orden.asc ? "▲" : "▼"}</span>}
    </button>
  );
  const nombres = useMemo(() => [...new Set(filas.map((f) => f.nombre))].sort((a, b) => a.localeCompare(b, "es")), [filas]);
  const GRILLA = "grid-cols-[minmax(230px,2.4fr)_104px_104px_118px_112px_104px_112px_130px]";

  return (
    <div className="space-y-4">
      {/* Tarjetas: cada una filtra la tabla de abajo (la pantalla no se mueve) */}
      <section aria-label="Resumen" className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <Tarjeta titulo={vista === "clientes" ? "Clientes activos" : "Sucursales activas"} valor={resumen.activos} tono="neutro" activa={filtro === "todos"} ayuda={AYUDA.todos} onClick={() => elegir("todos")} />
        <Tarjeta titulo="Con pedido en curso" valor={resumen.curso} tono={resumen.curso > 0 ? "neutro" : "apagado"} activa={filtro === "curso"} ayuda={AYUDA.curso} onClick={() => elegir("curso")} onQuitar={() => elegir("todos")} />
        <Tarjeta titulo="Recibieron en los últimos 7 días" valor={resumen.d7} tono={resumen.d7 > 0 ? "verde" : "apagado"} activa={filtro === "d7"} ayuda={AYUDA.d7} onClick={() => elegir("d7")} onQuitar={() => elegir("todos")} />
        <Tarjeta titulo="Sin entrega hace 7 días" valor={resumen.s7} tono={resumen.s7 > 0 ? "rojo1" : "apagado"} activa={filtro === "s7"} ayuda={AYUDA.s7} onClick={() => elegir("s7")} onQuitar={() => elegir("todos")} />
        <Tarjeta titulo="Sin entrega hace 15 días" valor={resumen.s15} tono={resumen.s15 > 0 ? "rojo2" : "apagado"} activa={filtro === "s15"} ayuda={AYUDA.s15} onClick={() => elegir("s15")} onQuitar={() => elegir("todos")} />
        <Tarjeta titulo="Sin entrega hace 30 días" valor={resumen.s30} tono={resumen.s30 > 0 ? "rojo3" : "apagado"} activa={filtro === "s30"} ayuda={AYUDA.s30} onClick={() => elegir("s30")} onQuitar={() => elegir("todos")} />
        <Tarjeta titulo="Sin entrega hace 45 días" valor={resumen.s45} tono={resumen.s45 > 0 ? "rojo4" : "apagado"} activa={filtro === "s45"} ayuda={AYUDA.s45} onClick={() => elegir("s45")} onQuitar={() => elegir("todos")} />
        <Tarjeta titulo="Nunca recibieron" valor={resumen.inactivos} tono={resumen.inactivos > 0 ? "neutro" : "apagado"} activa={filtro === "inactivos"} ayuda={AYUDA.inactivos} onClick={() => elegir("inactivos")} onQuitar={() => elegir("todos")} />
      </section>

      {/* Buscador y qué se está mostrando */}
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Ver por" className="flex overflow-hidden rounded-md border border-stone-300 bg-white text-[13px] font-semibold">
          {(["sucursales", "clientes"] as const).map((v) => (
            <button key={v} type="button" onClick={() => cambiarVista(v)} aria-pressed={vista === v} className={`h-10 px-4 ${vista === v ? "bg-stone-800 text-white" : "text-stone-600 hover:bg-crema-100"}`}>{v === "clientes" ? "Por cliente" : "Por sucursal"}</button>
          ))}
        </div>
        <input value={q} onChange={(e) => { setQ(e.target.value); if (e.target.value.trim()) setFiltro("todos"); }} title="Al buscar se muestran todos los que coinciden, de cualquier grupo" placeholder="Buscar cliente o barrio…" aria-label="Buscar cliente" className="h-10 w-full max-w-xs rounded-md border border-stone-300 bg-white px-3 text-sm focus:border-verde-700 focus:outline-none" />
        <p className="text-[14px] text-stone-700">
          Mostrando: <b>{FILTROS.find((f) => f[0] === filtro)![1]}</b> · {lista.length} {lista.length === 1 ? unidad[0] : unidad[1]}
          {filtro !== "todos" && <button type="button" onClick={() => setFiltro("todos")} className="ml-3 rounded-full border border-stone-300 bg-white px-3 py-1 text-[12.5px] font-semibold text-stone-700 hover:border-stone-600">Ver todos ✕</button>}
          {hayFiltros && <button type="button" onClick={quitarFiltros} className="ml-3 rounded-full border border-stone-300 bg-white px-3 py-1 text-[12.5px] font-semibold text-stone-700 hover:border-stone-600">Quitar filtros de la tabla ✕</button>}
        </p>
      </div>

      {/* Tabla de clientes */}
      <div className="overflow-x-auto rounded-lg border border-stone-300 bg-white">
        <div className="min-w-[1080px]">
          <div className="border-b border-stone-300 bg-crema-100">
          <div className={`grid items-center gap-x-3 px-4 pt-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-stone-500 ${GRILLA}`}>
            <Titulo col="nombre">{vista === "clientes" ? "Cliente" : "Cliente · sucursal"}</Titulo>
            <Titulo col="ultimo" ayuda="Fecha del último pedido cargado.">Último pedido</Titulo>
            <Titulo col="entrega" ayuda="Fecha de la última vez que se le entregó.">Última entrega</Titulo>
            <Titulo col="sinEntrega" ayuda="Días que pasaron desde su última ENTREGA. Es el que cuenta: verde hasta 7 días, amarillo hasta 30 y rojo más de 30.">Sin entrega (días)</Titulo>
            <Titulo col="dif" ayuda="Días entre el último pedido y la última entrega. Si tiene un signo menos, hay un pedido más nuevo que todavía no se entregó.">Diferencia</Titulo>
            <Titulo col="ritmo" ayuda="Cada cuántos días se le entrega, según sus entregas de los últimos 6 meses. Hacen falta al menos 2.">Entrega cada</Titulo>
            <Titulo col="paq30" ayuda="Paquetes ENTREGADOS en los últimos 30 días (pizzas ÷ 2).">Paquetes 30 días</Titulo>
            <span>Contactar</span>
          </div>
            <div className={`grid items-center gap-x-3 px-4 pb-2.5 pt-1.5 ${GRILLA}`}>
              <FiltroLista varios titulo="Cliente" opciones={nombres} valor={fCliente} onCambio={(v) => { setFCliente(v); if (v) setFiltro("todos"); }} />
              <input aria-label="Filtrar último pedido" value={fUltimo} onChange={(e) => setFUltimo(e.target.value)} placeholder="Ej: 03/10" className={entradaFiltro} />
              <input aria-label="Filtrar última entrega" value={fEntrega} onChange={(e) => setFEntrega(e.target.value)} placeholder="Ej: 03/10" className={entradaFiltro} />
              <input aria-label="Filtrar días sin entrega" value={fSin} onChange={(e) => setFSin(e.target.value)} placeholder="Ej: >15" title="Número exacto o con signo: 15, >15, >=15, <7" className={entradaFiltro} />
              <input aria-label="Filtrar diferencia entre pedido y entrega" value={fDif} onChange={(e) => setFDif(e.target.value)} placeholder="Ej: >7" title="Número exacto o con signo: 7, >7, <0" className={entradaFiltro} />
              <input aria-label="Filtrar cada cuánto se le entrega" value={fRitmo} onChange={(e) => setFRitmo(e.target.value)} placeholder="Ej: <10" title="Número exacto o con signo: 7, >7, <=10" className={entradaFiltro} />
              <input aria-label="Filtrar paquetes" value={fPaq} onChange={(e) => setFPaq(e.target.value)} placeholder="Ej: >=50" title="Número exacto o con signo: 50, >50, <10" className={entradaFiltro} />
              <FiltroLista varios titulo="Contactar" opciones={["Con WhatsApp", "Sin teléfono", "Teléfono no válido"]} valor={fContacto} onCambio={setFContacto} />
            </div>
          </div>
          {lista.length === 0 && <p className="p-10 text-center text-sm text-stone-500">No hay clientes con ese filtro.</p>}
          {lista.map((f) => (
            <div key={f.id} className={`grid h-11 items-center gap-x-3 border-b border-stone-200 px-4 text-center text-[13px] hover:bg-crema-50 ${GRILLA}`}>
              <span className="min-w-0 text-left">
                <Link href={`/clientes/${f.clienteId}/pedidos`} className="block truncate font-semibold hover:underline" title="Ver el historial de pedidos">{f.nombre}</Link>
                {f.barrios && <span className="block truncate text-[11.5px] leading-tight text-stone-500">{f.barrios}</span>}
              </span>
              <span className="tabular-nums text-stone-600">{fechaCorta(f.ultimo)}</span>
              <span className="tabular-nums text-stone-600">{fechaCorta(f.entrega)}</span>
              <span>
                {f.enCurso !== null ? <span className="flex flex-col items-center leading-tight" title={`Ya tiene un pedido en curso: no hace falta llamarlo.${f.sinEntrega !== null ? ` Su última entrega fue hace ${f.sinEntrega} días.` : ""}`}>
                    <span className="rounded-full border border-stone-300 bg-stone-100 px-2.5 py-0.5 text-[12px] font-semibold text-stone-700">{f.enCurso}</span>
                    {f.sinEntrega !== null && <span className="text-[10.5px] text-stone-400">última hace {f.sinEntrega} d</span>}
                  </span>
                  : f.sinEntrega === null ? <span className="rounded-full bg-crema-100 px-2.5 py-0.5 text-[12px] font-semibold text-stone-500" title="Todavía no se le entregó ningún pedido">Sin entregas</span>
                  : <span className={`inline-block min-w-[44px] rounded-full px-2.5 py-0.5 text-[14px] font-bold tabular-nums ${f.sinEntrega > 30 ? "bg-rojo-50 text-rojo-700" : f.sinEntrega > 7 ? "bg-[#fdf8e3] text-[#8a6a05]" : "bg-verde-50 text-verde-800"}`}>{f.sinEntrega === 0 ? "Hoy" : f.sinEntrega}</span>}
              </span>
              <span className="tabular-nums text-stone-600" title={f.dif === null ? "" : f.dif < 0 ? `Tiene un pedido más nuevo (${fechaCorta(f.ultimo)}) que todavía no se entregó` : `Entre el último pedido y la última entrega pasaron ${f.dif} días`}>
                {f.dif === null ? <span className="text-stone-300">—</span> : f.dif === 0 ? "Mismo día" : f.dif < 0 ? <span className="text-[#8a6a05]">−{Math.abs(f.dif)} {Math.abs(f.dif) === 1 ? "día" : "días"}</span> : `${f.dif} ${f.dif === 1 ? "día" : "días"}`}
              </span>
              <span className="tabular-nums text-stone-700" title={f.ritmo !== null ? `Se le entrega cada ${f.ritmo} días` : "Todavía no hay entregas suficientes para saberlo"}>{f.ritmo !== null ? `${f.ritmo} ${f.ritmo === 1 ? "día" : "días"}` : <span className="text-stone-300">—</span>}</span>
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
      <p className="text-[12px] text-stone-500">{lista.length} {lista.length === 1 ? unidad[0] : unidad[1]}. Tocá el título de una columna para ordenar; tocá un cliente para ver todo su historial de pedidos. La tabla empieza por los que hace más tiempo no reciben.</p>
    </div>
  );
}
