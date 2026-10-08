"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { buscarDestinos, cambiarClientePedido, type Destino } from "../../actions";

// "Se cargó al cliente equivocado": se busca el cliente/sucursal correcto y el pedido pasa a él (con aviso de confirmación).
export function CambiarCliente({ pedidoId, clienteActual }: { pedidoId: string; clienteActual: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<Destino[]>([]);
  const [error, setError] = useState("");
  const [enviando, empezar] = useTransition();

  useEffect(() => {
    if (!q.trim()) { setResultados([]); return; }
    const espera = setTimeout(async () => setResultados(await buscarDestinos(q)), 250);
    return () => clearTimeout(espera);
  }, [q]);

  const elegir = (d: Destino) => {
    if (!window.confirm(`¿Pasar este pedido a ${d.cliente} · ${[d.alias, d.direccion].filter(Boolean).join(" · ")}?\n\nSale de la cuenta de ${clienteActual} y suma en la de ${d.cliente} (queda anotado en las dos cuentas).`)) return;
    setError("");
    empezar(async () => {
      const r = await cambiarClientePedido(pedidoId, d.puntoId);
      if (!r.ok) setError(r.error ?? "No se pudo cambiar.");
      else { setAbierto(false); setQ(""); router.refresh(); }
    });
  };

  if (!abierto) {
    return <button type="button" onClick={() => setAbierto(true)} className="rounded-md border border-stone-400 bg-white px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-crema-100">Cambiar de cliente</button>;
  }
  return (
    <div className="w-full space-y-2 rounded-xl border border-stone-300 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">¿A qué cliente va este pedido? <span className="font-normal text-stone-500">(ahora está en {clienteActual})</span></p>
        <button type="button" onClick={() => { setAbierto(false); setQ(""); setError(""); }} className="rounded-md border border-stone-400 bg-white px-3 py-1 text-sm hover:bg-crema-100">Cancelar</button>
      </div>
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Escribí el cliente, la sucursal o el barrio" className="h-11 w-full rounded-md border border-stone-400 bg-white px-3 text-base focus:border-verde-700 focus:outline-none" />
      {error && <p className="text-sm text-rojo-700" role="alert">{error}</p>}
      {resultados.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-stone-300">
          {resultados.map((d) => (
            <button key={d.puntoId} type="button" disabled={enviando} onClick={() => elegir(d)} className="grid w-full grid-cols-[1fr_1.5fr_2fr] items-center gap-x-3 border-t border-stone-300 px-4 py-2 text-center text-sm first:border-t-0 hover:bg-crema-100 disabled:opacity-60">
              <span className="font-semibold">{d.barrio}</span>
              <span className="font-semibold">{d.cliente}</span>
              <span>{[d.alias, d.direccion].filter(Boolean).join(" · ")}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
