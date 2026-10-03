"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { guardarNotaPedido } from "@/app/pedidos/actions";

// Observación rápida del pedido (horario, "dejar con el portero"…) sin abrir ni editar el pedido.
// Es la misma nota del pedido: se ve en rojo debajo de la dirección, en la hoja de ruta y en el detalle.
export function NotaRapida({ pedidoId, nota, bloqueada = false }: { pedidoId: string; nota: string; bloqueada?: boolean }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(nota);
  const [error, setError] = useState<string | null>(null);
  const [guardando, empezar] = useTransition();

  if (bloqueada) return null;
  if (!editando) {
    return (
      <button type="button" onClick={() => { setTexto(nota); setError(null); setEditando(true); }} className="mx-auto mt-0.5 block text-[10.5px] font-medium text-stone-400 underline-offset-2 hover:text-stone-800 hover:underline">
        {nota ? "✎ nota" : "+ nota"}
      </button>
    );
  }
  const guardar = () => {
    setError(null);
    empezar(async () => {
      try {
        await guardarNotaPedido(pedidoId, texto);
        setEditando(false);
        router.refresh();
      } catch {
        setError("No se pudo guardar.");
      }
    });
  };
  return (
    <span className="mt-1 flex flex-col gap-1">
      <input
        autoFocus
        value={texto}
        maxLength={150}
        disabled={guardando}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); guardar(); } if (e.key === "Escape") setEditando(false); }}
        placeholder="Ej.: Recibe hasta las 10 hs"
        aria-label="Nota del pedido"
        className="h-8 w-full rounded-md border border-stone-500 bg-white px-2 text-left text-[12.5px] text-stone-900 focus:border-verde-700 focus:outline-none"
      />
      <span className="flex items-center justify-center gap-2 text-[11.5px]">
        <button type="button" disabled={guardando} onClick={guardar} className="rounded border border-verde-700 bg-white px-2 py-0.5 font-semibold text-verde-800 hover:bg-verde-700 hover:text-white">{guardando ? "…" : "Guardar"}</button>
        <button type="button" onClick={() => setEditando(false)} className="text-stone-500 underline">Cancelar</button>
        {error && <span className="text-rojo-700">{error}</span>}
      </span>
    </span>
  );
}
