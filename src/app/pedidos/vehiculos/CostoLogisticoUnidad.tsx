"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { guardarCostoLogisticoUnidad } from "../ruta/actions";

/** Costo logístico por unidad (el tope): lo que no tendría que pasar de costo de envío cada pizza, prepizza o focaccia. Solo dueños. */
export function CostoLogisticoUnidad({ inicial, porDefecto }: { inicial: string; porDefecto: number }) {
  const router = useRouter();
  const [texto, setTexto] = useState(inicial);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [guardando, empezar] = useTransition();
  const guardar = () => empezar(async () => {
    setMsg(null);
    const r = await guardarCostoLogisticoUnidad(texto);
    setMsg(r.ok ? { t: "Guardado.", ok: true } : { t: r.error ?? "No se pudo guardar.", ok: false });
    if (r.ok) router.refresh();
  });
  return (
    <section className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-stone-300 bg-white px-5 py-3 text-sm">
      <div>
        <p className="font-semibold text-stone-900">Costo logístico por unidad</p>
        <p className="text-[12.5px] text-stone-500">El tope de envío por cada pizza, prepizza o focaccia. En la hoja de ruta, cada camioneta se compara contra este valor.</p>
      </div>
      <label className="ml-auto flex items-center gap-2">
        $
        <input inputMode="decimal" value={texto} placeholder={String(porDefecto)} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") guardar(); }} className="h-9 w-28 rounded-md border border-stone-400 bg-white px-2 text-right tabular-nums focus:border-verde-700 focus:outline-none" aria-label="Costo logístico por unidad" />
      </label>
      <button type="button" disabled={guardando} onClick={guardar} className="h-9 rounded-md bg-verde-700 px-4 text-sm font-bold text-white hover:bg-verde-800 disabled:opacity-50">{guardando ? "Guardando…" : "Guardar"}</button>
      {msg && <span className={msg.ok ? "text-stone-600" : "font-semibold text-rojo-700"} role="status">{msg.t}</span>}
    </section>
  );
}
