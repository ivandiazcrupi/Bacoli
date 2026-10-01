"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { formatoPesos } from "@/lib/numeros";
import { asignarADia } from "../../actions";
import type { DiaBoton } from "../../Bandeja";
import type { FilaBandeja } from "../../filas";

// Pedidos cargados que todavía no tienen día. Se arrastran hasta un día de arriba (o se toca L M M J V S) y salen de esta lista.
export function Pendientes({ filas: iniciales, dias }: { filas: FilaBandeja[]; dias: DiaBoton[] }) {
  const router = useRouter();
  const [filas, setFilas] = useState(iniciales);
  const [error, setError] = useState<string | null>(null);
  const [, empezar] = useTransition();
  useEffect(() => setFilas(iniciales), [iniciales]);

  const asignar = (f: FilaBandeja, fecha: string) => {
    const antes = filas;
    setError(null);
    setFilas((x) => x.filter((y) => y.id !== f.id));
    empezar(async () => {
      const r = await asignarADia(f.id, fecha);
      if (!r.ok) {
        setFilas(antes);
        setError(r.error ?? "No se pudo asignar.");
      }
      router.refresh();
    });
  };

  return (
    <details open={filas.length > 0} className="overflow-hidden rounded-xl border border-stone-400 bg-white shadow-sm">
      <summary className="flex cursor-pointer select-none items-center justify-between gap-3 bg-crema-100 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-verde-900">
        <span>Pendientes <span className="ml-1 rounded-full bg-verde-800 px-2 py-0.5 text-xs text-white">{filas.length}</span></span>
        <span className="text-xs font-medium normal-case tracking-normal text-stone-600">Arrastralos a un día de arriba, o tocá el día</span>
      </summary>
      {error && <p className="m-3 rounded-lg border border-rojo-600 bg-rojo-50 p-2 text-sm text-rojo-700" role="alert">{error}</p>}
      {filas.length === 0 ? (
        <p className="p-4 text-center text-sm text-stone-600">No hay pedidos esperando día.</p>
      ) : (
        <ul className="max-h-72 divide-y divide-stone-300 overflow-y-auto">
          {filas.map((f) => (
            <li
              key={f.id}
              draggable
              onDragStart={(e) => { e.dataTransfer.setData("text/pedido", f.id); e.dataTransfer.effectAllowed = "move"; }}
              className="grid cursor-grab items-center gap-x-4 gap-y-1 px-4 py-2 text-sm active:cursor-grabbing lg:grid-cols-[1.1fr_2fr_2.4fr_6rem_7rem_auto]"
            >
              <span className="font-semibold">{f.barrio}</span>
              <span className="leading-snug"><b>{f.cliente}</b>{f.comentario && <span className="block text-xs font-medium text-rojo-700">{f.comentario}</span>}</span>
              <span className="leading-snug text-stone-700">{f.items.map((i) => `${i.cantidad} ${i.nombre}`).join(" · ")}</span>
              <span className="tabular-nums"><b>{f.items.reduce((t, i) => t + i.cantidad, 0)}</b> paquetes</span>
              <span className="font-semibold tabular-nums lg:text-right">{formatoPesos(f.monto)}</span>
              <span className="flex gap-1" role="group" aria-label="Asignar a un día">
                {dias.map((d) => (
                  <button
                    key={d.fecha}
                    type="button"
                    disabled={d.cerrado}
                    onClick={() => asignar(f, d.fecha)}
                    title={d.cerrado ? `${d.nombre} ${d.numero}: día cerrado` : `Asignar al ${d.nombre.toLowerCase()} ${d.numero}`}
                    aria-label={`Asignar al ${d.nombre.toLowerCase()} ${d.numero}`}
                    className="flex h-9 w-8 flex-col items-center justify-center gap-px rounded-md border border-stone-400 bg-white text-stone-800 hover:border-verde-700 hover:bg-verde-700 hover:text-white disabled:opacity-35"
                  >
                    <span className="text-[13px] font-bold leading-none">{d.letra}</span>
                    <span className="text-[10px] leading-none opacity-70">{d.numero}</span>
                  </button>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
