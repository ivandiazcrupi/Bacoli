"use client";

import { useState, useTransition } from "react";
import { guardarNotaPedido } from "../actions";

// Observación del pedido: se escribe y se guarda ahí mismo (sin tocar el resto del pedido).
export function NotaEditable({ pedidoId, inicial }: { pedidoId: string; inicial: string }) {
  const [texto, setTexto] = useState(inicial);
  const [guardado, setGuardado] = useState(inicial);
  const [trabajando, empezar] = useTransition();
  const cambio = texto.trim() !== guardado;

  const guardar = () =>
    empezar(async () => {
      const r = await guardarNotaPedido(pedidoId, texto);
      setTexto(r.texto);
      setGuardado(r.texto);
    });

  return (
    <div className="flex h-full flex-col gap-2">
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault(); // no debe confirmar la entrega
            if (cambio) guardar();
          }
        }}
        placeholder="Ej.: Entregar en el vecino"
        aria-label="Observación del pedido"
        className="h-10 w-full rounded-md border border-stone-400 bg-white px-3 text-sm text-rojo-700 placeholder:text-stone-400 focus:border-verde-700 focus:outline-none"
      />
      <div className="flex items-center justify-between gap-2 text-xs text-stone-500">
        <span>Se ve en rojo debajo de la dirección.</span>
        <button type="button" onClick={guardar} disabled={!cambio || trabajando} className="h-8 rounded-md border border-stone-400 bg-white px-3 text-sm font-medium text-stone-800 shadow-sm hover:border-verde-700 disabled:opacity-40">{trabajando ? "Guardando…" : cambio ? "Guardar nota" : "Guardada"}</button>
      </div>
    </div>
  );
}
