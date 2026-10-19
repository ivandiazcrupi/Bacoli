"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { estiloCampo, estiloDato } from "@/components/campos";
import { TIPOS_COMERCIO } from "@/lib/leads";
import { cargarLeadRapido } from "./actions";

// Carga rápida de un posible cliente: nombre (obligatorio), teléfono, barrio y una nota. Enter guarda y deja todo listo para el siguiente.
export function CargaRapida() {
  const [estado, enviar, cargando] = useActionState(cargarLeadRapido, undefined);
  const formulario = useRef<HTMLFormElement>(null);
  const nombre = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (estado?.ok) { formulario.current?.reset(); nombre.current?.focus(); }
  }, [estado]);

  const etiqueta = "block text-[12px] font-semibold uppercase tracking-wide text-stone-500";
  return (
    <section className="rounded-lg border border-stone-300 bg-white px-4 py-3" aria-label="Cargar un posible cliente">
      <form ref={formulario} action={enviar} className="grid items-end gap-3 md:grid-cols-[1.4fr_1fr_1fr_1fr_1.5fr_auto]">
        <label className={etiqueta}>Comercio o persona *
          <input ref={nombre} name="nombre" autoCapitalize="characters" autoComplete="off" required placeholder="Ej.: ALMACÉN LA ESQUINA" className={`${estiloDato} mt-1`} />
        </label>
        <label className={etiqueta}>Teléfono
          <input name="telefono" inputMode="tel" autoComplete="off" placeholder="11 5555 1234" className={`${estiloCampo} mt-1`} />
        </label>
        <label className={etiqueta}>Barrio
          <input name="barrio" autoCapitalize="characters" autoComplete="off" className={`${estiloDato} mt-1`} />
        </label>
        <label className={etiqueta}>Tipo de comercio
          <input name="tipoComercio" list="tipos-comercio" autoCapitalize="characters" autoComplete="off" placeholder="Almacén, pizzería…" className={`${estiloDato} mt-1`} />
          <datalist id="tipos-comercio">{TIPOS_COMERCIO.map((t) => <option key={t} value={t} />)}</datalist>
        </label>
        <label className={etiqueta}>Nota
          <input name="nota" autoComplete="off" placeholder="Cómo llegó, qué le interesa…" className={`${estiloCampo} mt-1`} />
        </label>
        <button disabled={cargando} className="h-11 whitespace-nowrap rounded-lg bg-verde-700 px-6 text-sm font-bold uppercase tracking-wide text-white hover:bg-verde-800 disabled:opacity-60">{cargando ? "Guardando…" : "+ Agregar"}</button>
      </form>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span role="status" className={estado?.error ? "font-medium text-rojo-700" : "font-medium text-verde-800"}>{estado?.error ?? estado?.ok ?? ""}</span>
        <Link href="/comercial/leads/nuevo" className="text-[13px] font-semibold text-stone-600 underline decoration-stone-300 underline-offset-4 hover:text-stone-900">Cargar con más datos ›</Link>
      </div>
    </section>
  );
}
