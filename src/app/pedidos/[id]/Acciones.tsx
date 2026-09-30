"use client";

import { useActionState } from "react";
import { Mensajes, estiloBoton } from "@/components/campos";
import { marcarEntregado, type EstadoPedidoForm } from "../actions";

type Renglon = { id: string; nombre: string; unidad: string; cantidad: number; entregada: number | null };

export function FormularioEntrega({ pedidoId, items }: { pedidoId: string; items: Renglon[] }) {
  const [estado, enviar, cargando] = useActionState(marcarEntregado.bind(null, pedidoId), undefined as EstadoPedidoForm);
  return (
    <form action={enviar} className="space-y-3 rounded-lg border border-stone-200 bg-white p-4">
      <h2 className="font-semibold">Marcar como entregado</h2>
      <p className="text-sm text-stone-600">Si se entregó todo, confirmá. Si faltó algo, cambiá la cantidad entregada.</p>
      <ul className="divide-y divide-stone-100">
        {items.map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-3 py-2">
            <span className="min-w-0 truncate">{i.nombre} <span className="text-xs text-stone-500">de {i.cantidad}</span></span>
            <input
              name={`e_${i.id}`}
              aria-label={`Entregado de ${i.nombre}`}
              inputMode="numeric"
              defaultValue={i.entregada ?? i.cantidad}
              className="h-11 w-20 rounded-lg border border-stone-300 bg-white text-center text-lg tabular-nums"
            />
          </li>
        ))}
      </ul>
      <Mensajes estado={estado} />
      <button disabled={cargando} className="w-full rounded-lg bg-verde-700 px-4 py-3 font-semibold text-white disabled:opacity-60">{cargando ? "Guardando…" : "Confirmar entrega"}</button>
    </form>
  );
}

export function BotonConAviso({ texto, aviso, clase }: { texto: string; aviso: string; clase: string }) {
  return (
    <button
      className={clase}
      onClick={(e) => {
        if (!window.confirm(aviso)) e.preventDefault();
      }}
    >
      {texto}
    </button>
  );
}

export { estiloBoton };
