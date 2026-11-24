"use client";

import Link from "next/link";
import { useState } from "react";
import { CargaRapida, FilaTarea } from "./Controles";

type T = { id: string; titulo: string; hecha: boolean };

// Cuadro de tareas del Inicio, ordenado de arriba para abajo: 1) cargar una tarea, 2) elegir qué lista mirar (Mis tareas / Generales), 3) la lista.
// Generales = lo que todavía no tiene dueño: cada una trae "Me la quedo".
export function CajaInicio({ mias, generales, personas, miId }: { mias: T[]; generales: T[]; personas: { id: string; nombre: string }[]; miId: string }) {
  const pendMias = mias.filter((t) => !t.hecha).length;
  const [ver, setVer] = useState<"mias" | "generales">(pendMias === 0 && generales.length > 0 ? "generales" : "mias");
  const lista = ver === "mias" ? mias : generales;
  const pestana = (id: "mias" | "generales", texto: string, n: number, aviso: boolean) => (
    <button key={id} type="button" role="tab" aria-selected={ver === id} onClick={() => setVer(id)} className={`flex h-9 flex-1 items-center justify-center gap-2 rounded-md text-[13.5px] font-semibold transition ${ver === id ? "bg-white text-stone-900 outline outline-1 outline-stone-300" : "text-stone-500 hover:text-stone-800"}`}>
      {texto}
      <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-none ${aviso && n > 0 ? "border border-[#d9a406] bg-[#fdf8e3] text-[#8a6a05]" : "bg-stone-200 text-stone-600"}`}>{n}</span>
    </button>
  );
  return (
    <section aria-label="Tareas" className="mt-2 w-full rounded-xl border border-stone-300 bg-white p-4 text-left">
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.12em] text-stone-600">Tareas</h2>
        <Link href="/tareas" className="text-[12.5px] font-semibold text-stone-600 underline-offset-2 hover:underline">Ver las del equipo ›</Link>
      </header>

      <CargaRapida personas={personas} miId={miId} compacta />

      <div role="tablist" aria-label="Qué lista ver" className="mt-3 flex gap-1 rounded-lg bg-stone-100 p-1">
        {pestana("mias", "Mis tareas", pendMias, false)}
        {pestana("generales", "Generales", generales.length, true)}
      </div>

      <div className="mt-2">
        {lista.length === 0 ? (
          <p className="px-1 py-4 text-center text-[13.5px] text-stone-400">{ver === "mias" ? "No tenés tareas por ahora." : "Nada sin dueño: todas las tareas ya tienen quién las haga ✓"}</p>
        ) : (
          <ul className="max-h-[38vh] overflow-y-auto overscroll-contain pr-1">
            {lista.map((t) => <FilaTarea key={t.id} id={t.id} titulo={t.titulo} hecha={t.hecha} tomable={ver === "generales"} />)}
          </ul>
        )}
      </div>
    </section>
  );
}
