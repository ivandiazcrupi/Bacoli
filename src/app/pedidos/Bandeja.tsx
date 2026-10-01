"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { formatoPesos } from "@/lib/numeros";
import { asignarADia } from "./actions";
import type { FilaBandeja } from "./filas";

export type DiaBoton = { fecha: string; corta: string; hoy: boolean; cerrado: boolean };

const COLUMNAS = "lg:grid-cols-[1.1fr_1.7fr_2.4fr_7rem_23rem_5rem]";

// PEDIDOS: lo cargado que espera día. Al tocar el día, el pedido se MUEVE a ese día (sale de esta lista, como el cortar y pegar de la planilla).
export function Bandeja({ filas: iniciales, dias }: { filas: FilaBandeja[]; dias: DiaBoton[] }) {
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

  const botones = (f: FilaBandeja, grande?: boolean) => (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Asignar a un día">
      {dias.map((d) => (
        <button
          key={d.fecha}
          type="button"
          disabled={d.cerrado}
          onClick={() => asignar(f, d.fecha)}
          title={d.cerrado ? "Día cerrado" : undefined}
          className={`rounded-md border px-2.5 font-semibold shadow-sm hover:border-verde-700 hover:bg-verde-50 hover:text-verde-800 disabled:opacity-40 ${grande ? "h-11 min-w-12 text-base" : "h-9 text-sm"} ${d.hoy ? "border-verde-700 text-verde-800" : "border-stone-400 bg-white"}`}
        >
          {d.corta}
        </button>
      ))}
    </div>
  );

  if (filas.length === 0) {
    return <p className="rounded-lg border border-dashed border-stone-400 p-8 text-center text-stone-600">No hay pedidos esperando día. Los pedidos nuevos aparecen acá.</p>;
  }

  return (
    <div className="space-y-2">
      {error && <p className="rounded-lg border border-rojo-600 bg-rojo-50 p-3 text-sm text-rojo-700" role="alert">{error}</p>}
      <div className={`hidden gap-x-4 rounded-t-xl bg-verde-800 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white lg:grid ${COLUMNAS}`}>
        <span>Barrio</span><span>Cliente</span><span>Pedido</span><span className="text-right">Monto</span><span>Asignar a un día</span><span />
      </div>
      {filas.map((f) => (
        <div key={f.id} className="rounded-xl border border-stone-300 bg-white px-4 py-3 shadow-sm">
          <div className={`hidden items-center gap-x-4 lg:grid ${COLUMNAS}`}>
            <span className="text-sm font-semibold">{f.barrio}</span>
            <span className="text-sm leading-snug">
              <b>{f.cliente}</b>
              {f.comentario && <span className="block text-xs font-medium text-rojo-700">{f.comentario}</span>}
            </span>
            <span className="text-sm leading-snug text-stone-700">{f.items.map((i) => `${i.cantidad} ${i.nombre}`).join(" · ")}</span>
            <span className="text-right text-sm font-semibold tabular-nums">{formatoPesos(f.monto)}</span>
            {botones(f)}
            <Link href={`/pedidos/${f.id}`} className="text-right text-sm font-medium text-verde-800 hover:underline">Abrir →</Link>
          </div>

          <div className="space-y-2 lg:hidden">
            <p className="font-semibold">{f.barrio} · {f.cliente}</p>
            {f.comentario && <p className="text-sm font-medium text-rojo-700">{f.comentario}</p>}
            <p className="text-sm text-stone-700">{f.items.map((i) => `${i.cantidad} ${i.nombre}`).join(" · ")}</p>
            <p className="flex items-center justify-between"><b className="tabular-nums">{formatoPesos(f.monto)}</b><Link href={`/pedidos/${f.id}`} className="text-sm font-medium text-verde-800">Abrir →</Link></p>
            {botones(f, true)}
          </div>
        </div>
      ))}
    </div>
  );
}
