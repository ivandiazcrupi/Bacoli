"use client";

import { useState, useTransition } from "react";
import { compararMailsAhora, type ResultadoComparacion } from "./actions";

const color = { igual: "bg-verde-50 text-verde-700", difiere: "bg-rojo-50 text-rojo-700", "sin-pedido": "bg-[#fdf8e3] text-[#8a6a05]" } as const;
const texto = { igual: "Igual", difiere: "Difiere", "sin-pedido": "Sin pedido todavía" } as const;

export function Comparacion() {
  const [r, setR] = useState<ResultadoComparacion | null>(null);
  const [leyendo, empezar] = useTransition();
  const [soloDif, setSoloDif] = useState(true);
  const filas = r?.resumen?.filas.filter((f) => !soloDif || f.estado !== "igual").slice().reverse() ?? [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={leyendo} onClick={() => empezar(async () => setR(await compararMailsAhora()))} className="h-10 rounded-md bg-verde-700 px-5 text-sm font-bold text-white hover:bg-verde-800 disabled:opacity-50">
          {leyendo ? "Leyendo los mails…" : "Leer los mails y comparar"}
        </button>
        {r && <span className={`text-sm ${r.ok ? "text-stone-700" : "font-semibold text-rojo-700"}`} role="status">{r.mensaje}</span>}
      </div>

      {r?.resumen && (
        <>
          <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-stone-300 bg-stone-300 sm:grid-cols-4" aria-label="Resumen">
            {[
              { t: "Iguales", v: r.resumen.iguales, c: "text-verde-700" },
              { t: "Con diferencias", v: r.resumen.difieren, c: r.resumen.difieren ? "text-rojo-700" : "text-stone-800" },
              { t: "Sin pedido todavía", v: r.resumen.sinPedido, c: "text-stone-800" },
              { t: "Con email", v: `${r.resumen.conEmail} de ${r.resumen.filas.length}`, c: "text-stone-800" },
            ].map((x) => (
              <div key={x.t} className="bg-white px-4 py-3 text-center">
                <p className="text-[11px] font-bold uppercase tracking-wide text-stone-500">{x.t}</p>
                <p className={`mt-1 text-2xl font-extrabold tabular-nums ${x.c}`}>{x.v}</p>
              </div>
            ))}
          </section>

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
                <span className="space-y-0.5 text-stone-700">{f.diferencias.length ? f.diferencias.map((d) => <span key={d} className="block">{d}</span>) : <span className="text-stone-400">—</span>}</span>
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
