"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { asignarADia } from "../../actions";

export type DiaChip = { fecha: string; texto: string; pedidos: number; vehiculos: number; cerrado: boolean };

// Los seis días de la semana para ir día por día. También reciben pedidos arrastrados desde "Pendientes".
export function DiasSemana({ fecha, lunesTexto, hrefAnterior, hrefSiguiente, hrefSemana, dias }: { fecha: string; lunesTexto: string; hrefAnterior: string; hrefSiguiente: string; hrefSemana: string; dias: DiaChip[] }) {
  const router = useRouter();
  const [encima, setEncima] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, empezar] = useTransition();

  const soltar = (d: DiaChip, id: string) => {
    setEncima(null);
    if (!id) return;
    setError(null);
    empezar(async () => {
      const r = await asignarADia(id, d.fecha);
      if (!r.ok) setError(r.error ?? "No se pudo asignar.");
      router.refresh();
    });
  };

  return (
    <>
      <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Días de la semana">
        <Link href={hrefAnterior} className="rounded-md border border-stone-400 bg-white px-3 py-2.5 text-sm shadow-sm hover:border-verde-700" aria-label="Semana anterior">←</Link>
        <Link href={hrefSemana} title="Ver el resumen de la semana" className="rounded-md bg-verde-800 px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-verde-700">Semana {lunesTexto}</Link>
        <Link href={hrefSiguiente} className="rounded-md border border-stone-400 bg-white px-3 py-2.5 text-sm shadow-sm hover:border-verde-700" aria-label="Semana siguiente">→</Link>
        <span className="mx-1 hidden h-8 w-px bg-stone-300 sm:block" />
        {dias.map((d) => {
          const activo = d.fecha === fecha;
          const sobre = encima === d.fecha && !d.cerrado;
          return (
            <Link
              key={d.fecha}
              href={`/pedidos/dia/${d.fecha}`}
              aria-current={activo ? "page" : undefined}
              onDragOver={(e) => { if (!d.cerrado) { e.preventDefault(); setEncima(d.fecha); } }}
              onDragLeave={() => setEncima((x) => (x === d.fecha ? null : x))}
              onDrop={(e) => { e.preventDefault(); soltar(d, e.dataTransfer.getData("text/pedido")); }}
              className={`flex min-w-24 flex-col items-center justify-center gap-0.5 rounded-lg border px-3 py-2 text-center shadow-sm transition ${sobre ? "border-verde-700 bg-verde-100 text-verde-900 ring-2 ring-verde-600" : activo ? "border-verde-800 bg-verde-800 text-white" : "border-stone-400 bg-white text-stone-800 hover:border-verde-700"}`}
            >
              <span className="text-sm font-bold uppercase leading-none tracking-wide">{d.texto}</span>
              <span className={`text-[11px] leading-none ${activo && !sobre ? "text-verde-100" : "text-stone-500"}`}>
                {d.pedidos} {d.pedidos === 1 ? "pedido" : "pedidos"}{d.vehiculos ? ` · ${d.vehiculos} veh.` : ""}
              </span>
            </Link>
          );
        })}
      </nav>
      {error && <p className="rounded-lg border border-rojo-600 bg-rojo-50 p-3 text-sm text-rojo-700" role="alert">{error}</p>}
    </>
  );
}
