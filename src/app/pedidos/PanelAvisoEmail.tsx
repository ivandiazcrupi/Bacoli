"use client";

import { useState, useTransition } from "react";
import { guardarConfigAviso, type ConfigAviso } from "./aviso-email";

const primeraMayus = (t: string) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();

// El mail que se le manda a cada cliente de la tienda, armado en un solo lugar. Se cambia el día (lo habitual), el horario y el texto.
export function PanelAvisoEmail({ inicial }: { inicial: ConfigAviso }) {
  const [c, setC] = useState(inicial);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [guardando, empezar] = useTransition();
  const vista = c.texto.replace(/\{nombre\}/g, primeraMayus("Ivan")).replace(/\{dia\}/g, c.dia || "…").replace(/\{horario\}/g, c.horario);
  const campo = "mt-1 w-full rounded-md border border-stone-400 bg-white px-3 py-2 text-sm shadow-sm focus:border-verde-700 focus:outline-none focus:ring-2 focus:ring-verde-700/25";
  return (
    <details className="w-full rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm">
      <summary className="cursor-pointer font-medium text-stone-700">Email al cliente {c.dia ? <span className="font-normal text-stone-500">· día: {c.dia}</span> : <span className="font-semibold text-rojo-700">· falta cargar el día</span>}</summary>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-600">Día (lo que cambiás cada vez)
              <input value={c.dia} onChange={(e) => setC({ ...c, dia: e.target.value })} placeholder="martes 24" className={campo} />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-600">Horario
              <input value={c.horario} onChange={(e) => setC({ ...c, horario: e.target.value })} placeholder="9 a 18 hs" className={campo} />
            </label>
          </div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-stone-600">Texto del mail
            <textarea value={c.texto} onChange={(e) => setC({ ...c, texto: e.target.value })} rows={8} className={campo} />
            <span className="mt-1 block text-[11.5px] font-normal normal-case tracking-normal text-stone-500">Se reemplazan solos: {"{nombre}"} (el del cliente), {"{dia}"} y {"{horario}"}. Podés agregar avisos, por ejemplo “por alta demanda puede haber demoras”.</span>
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" disabled={guardando} onClick={() => empezar(async () => { const r = await guardarConfigAviso(c); setMsg({ t: r.mensaje, ok: r.ok }); })} className="h-9 rounded-md bg-verde-700 px-4 text-sm font-bold text-white hover:bg-verde-800 disabled:opacity-50">{guardando ? "Guardando…" : "Guardar mail"}</button>
            {msg && <span className={msg.ok ? "text-stone-700" : "font-semibold text-rojo-700"} role="status">{msg.t}</span>}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-600">Así le llega (ejemplo)</p>
          <pre className="mt-1 whitespace-pre-wrap rounded-md border border-stone-300 bg-crema-50 p-3 font-sans text-sm text-stone-800">{vista}</pre>
          <p className="mt-2 text-[12px] text-stone-500">El botón “✉ Enviar email” está en cada pedido de la tienda (Pedidos, hoja de ruta y detalle). Pide confirmar y después queda marcado como enviado.</p>
        </div>
      </div>
    </details>
  );
}
