"use client";

import { useMemo, useState, useTransition } from "react";
import { aprenderBarriosAhora, compararMailsAhora, type ResultadoAprendizaje, type ResultadoComparacion } from "./actions";

const color = { igual: "bg-verde-50 text-verde-700", difiere: "bg-rojo-50 text-rojo-700", "sin-pedido": "bg-[#fdf8e3] text-[#8a6a05]" } as const;
const texto = { igual: "Igual", difiere: "Difiere", "sin-pedido": "Sin pedido todavía" } as const;

export function Comparacion() {
  const [r, setR] = useState<ResultadoComparacion | null>(null);
  const [leyendo, empezar] = useTransition();
  const [soloDif, setSoloDif] = useState(true);
  const [aprendizaje, setAprendizaje] = useState<ResultadoAprendizaje | null>(null);
  const [aprendiendo, aprender] = useTransition();
  const [sinBarrio, setSinBarrio] = useState(false); // el barrio lo corrige el equipo a mano: se puede dejar de mirar
  // Con "ignorar barrio", una orden que solo difería en el barrio pasa a "igual".
  const todas = useMemo(() => (r?.resumen?.filas ?? []).map((f) => {
    if (f.estado === "sin-pedido") return f;
    const dif = sinBarrio ? f.diferencias.filter((d) => d.campo !== "Barrio") : f.diferencias;
    return { ...f, diferencias: dif, estado: dif.length ? ("difiere" as const) : ("igual" as const) };
  }), [r, sinBarrio]);
  const porCampo = useMemo(() => { const m = new Map<string, number>(); for (const f of todas) for (const d of f.diferencias) m.set(d.campo, (m.get(d.campo) ?? 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]); }, [todas]);
  const cuentan = { iguales: todas.filter((f) => f.estado === "igual").length, difieren: todas.filter((f) => f.estado === "difiere").length, sinPedido: todas.filter((f) => f.estado === "sin-pedido").length };
  const filas = todas.filter((f) => !soloDif || f.estado !== "igual").slice().reverse();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={leyendo} onClick={() => empezar(async () => setR(await compararMailsAhora()))} className="h-10 rounded-md bg-verde-700 px-5 text-sm font-bold text-white hover:bg-verde-800 disabled:opacity-50">
          {leyendo ? "Leyendo los mails…" : "Leer los mails y comparar"}
        </button>
        {r && <span className={`text-sm ${r.ok ? "text-stone-700" : "font-semibold text-rojo-700"}`} role="status">{r.mensaje}</span>}
      </div>

      <section className="rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm">
        <p className="text-[11px] font-bold uppercase tracking-wide text-stone-500">Barrios</p>
        <p className="mt-1 text-stone-600">El mail solo trae el código postal, y un mismo código puede ser de dos barrios. Este botón mira los pedidos que ya tenés cargados (con los barrios que corrigió el equipo) y, para cada código postal, se queda con el barrio que más se usó. Desde ese momento los pedidos nuevos entran con ese barrio. No cambia ningún pedido ya cargado.</p>
        <button type="button" disabled={aprendiendo} onClick={() => aprender(async () => setAprendizaje(await aprenderBarriosAhora()))} className="mt-2 h-9 rounded-md border border-stone-400 bg-white px-4 text-sm font-semibold hover:bg-crema-100 disabled:opacity-50">
          {aprendiendo ? "Aprendiendo…" : "Aprender los barrios de los pedidos cargados"}
        </button>
        {aprendizaje && <p className={`mt-2 ${aprendizaje.ok ? "text-stone-800" : "font-semibold text-rojo-700"}`} role="status">{aprendizaje.mensaje}</p>}
        {aprendizaje && aprendizaje.dudosos.length > 0 && (
          <div className="mt-2">
            <p className="text-stone-600">Códigos postales con más de un barrio (se usa el más repetido; conviene revisarlos):</p>
            <ul className="mt-1 columns-1 gap-6 text-[13px] sm:columns-2">{aprendizaje.dudosos.map((d) => <li key={d.cp}><b>{d.cp}</b> — {d.detalle}</li>)}</ul>
          </div>
        )}
      </section>

      {r && r.campos.length > 0 && (
        <details className="rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm">
          <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-wide text-stone-600">Todos los datos que trae el mail de Empretienda ({r.campos.length})</summary>
          <table className="mt-2 w-full text-left text-[13px]">
            <thead><tr className="text-stone-500"><th className="py-1 pr-3 font-medium">Dato</th><th className="py-1 pr-3 font-medium">Mails que lo traen</th><th className="py-1 font-medium">Ejemplo</th></tr></thead>
            <tbody>{r.campos.map((c) => <tr key={c.nombre} className="border-t border-stone-200"><td className="py-1 pr-3 font-medium">{c.nombre}</td><td className="py-1 pr-3 tabular-nums">{c.veces}</td><td className="py-1 text-stone-600">{c.ejemplo || "—"}</td></tr>)}</tbody>
          </table>
          {r.ejemplo && <details className="mt-3"><summary className="cursor-pointer text-stone-600">Ver el último mail tal cual lo lee el sistema</summary><pre className="mt-1 whitespace-pre-wrap text-[12px] text-stone-600">{r.ejemplo}</pre></details>}
        </details>
      )}

      {r?.resumen && (
        <>
          <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-stone-300 bg-stone-300 sm:grid-cols-4" aria-label="Resumen">
            {[
              { t: "Iguales", v: cuentan.iguales, c: "text-verde-700" },
              { t: "Con diferencias", v: cuentan.difieren, c: cuentan.difieren ? "text-rojo-700" : "text-stone-800" },
              { t: "Sin pedido todavía", v: cuentan.sinPedido, c: "text-stone-800" },
              { t: "Con email", v: `${r.resumen.conEmail} de ${r.resumen.filas.length}`, c: "text-stone-800" },
            ].map((x) => (
              <div key={x.t} className="bg-white px-4 py-3 text-center">
                <p className="text-[11px] font-bold uppercase tracking-wide text-stone-500">{x.t}</p>
                <p className={`mt-1 text-2xl font-extrabold tabular-nums ${x.c}`}>{x.v}</p>
              </div>
            ))}
          </section>

          <div className="rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-stone-500">Diferencias por tipo</p>
            {porCampo.length === 0 ? <p className="text-verde-700">Ninguna: todo coincide.</p> : (
              <p className="flex flex-wrap gap-x-5 gap-y-1">{porCampo.map(([campo, n]) => <span key={campo}><b className="tabular-nums">{n}</b> <span className="text-stone-600">{campo.toLowerCase()}</span></span>)}</p>
            )}
            <label className="mt-2 flex items-center gap-2 text-stone-700">
              <input type="checkbox" checked={sinBarrio} onChange={(e) => setSinBarrio(e.target.checked)} className="h-4 w-4 accent-[#026433]" /> Ignorar el barrio <span className="text-stone-400">(el equipo lo corrige a mano al armar el reparto; el mail lo calcula por código postal)</span>
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" checked={soloDif} onChange={(e) => setSoloDif(e.target.checked)} className="h-4 w-4 accent-[#026433]" /> Mostrar solo lo que no coincide
          </label>

          <div className="overflow-hidden rounded-xl border border-stone-300 bg-white">
            <div className="grid grid-cols-[90px_minmax(0,1fr)_minmax(0,1.6fr)_150px] gap-x-3 border-b border-stone-300 bg-crema-100 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-stone-600">
              <span>Orden</span><span>Cliente · email</span><span>Diferencias</span><span className="text-center">Resultado</span>
            </div>
            {filas.length === 0 && <p className="px-4 py-6 text-center text-sm text-stone-500">{soloDif ? "No hay diferencias: todo lo leído coincide con los pedidos cargados." : "No hay órdenes."}</p>}
            {filas.map((f) => (
              <div key={f.orden} className="grid grid-cols-[90px_minmax(0,1fr)_minmax(0,1.6fr)_150px] items-start gap-x-3 border-t border-stone-200 px-4 py-2.5 text-[13px]">
                <span className="font-semibold tabular-nums">#{f.orden}</span>
                <span className="min-w-0"><span className="block truncate font-medium">{f.cliente || "—"}</span><span className="block truncate text-[12px] text-stone-500">{f.email || "sin email"}</span></span>
                <span className="space-y-0.5 text-stone-700">{f.diferencias.length ? f.diferencias.map((d) => <span key={d.campo} className="block"><b className="font-semibold">{d.campo}:</b> {d.texto}</span>) : <span className="text-stone-400">—</span>}</span>
                <span className={`mx-auto rounded-full px-3 py-0.5 text-center text-[12px] font-bold ${color[f.estado]}`}>{texto[f.estado]}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {r && r.ilegibles.length > 0 && (
        <section className="rounded-xl border border-stone-300 bg-white p-4">
          <h2 className="mb-2 text-[12px] font-bold uppercase tracking-[0.12em] text-stone-600">Mails de la etiqueta que no se entendieron ({r.ilegibles.length})</h2>
          <ul className="space-y-2 text-[13px]">
            {r.ilegibles.map((m, i) => <li key={i} className="border-b border-stone-200 pb-2"><b>{m.asunto}</b> <span className="text-stone-400">{m.fecha.slice(0, 10)}</span><pre className="mt-1 whitespace-pre-wrap text-[12px] text-stone-500">{m.texto}</pre></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
