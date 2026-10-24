"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { traerPedidosWeb } from "./actions";

const boton = "h-8 whitespace-nowrap rounded-md border border-stone-400 bg-white px-2.5 text-[12px] font-medium shadow-sm hover:bg-crema-100 disabled:opacity-50";

// El resultado sale como un cartelito flotante abajo: no ocupa lugar en la pantalla.
function Cartel({ texto, ok, cerrar }: { texto: string; ok: boolean; cerrar: () => void }) {
  return (
    <div role="status" className={`fixed bottom-14 left-1/2 z-40 max-w-xl -translate-x-1/2 rounded-lg border bg-white px-4 py-3 text-sm shadow-lg ${ok ? "border-stone-400 text-stone-800" : "border-rojo-600 text-rojo-700"}`}>
      <button type="button" onClick={cerrar} aria-label="Cerrar" className="float-right ml-3 text-stone-400 hover:text-stone-800">✕</button>
      {texto}
    </div>
  );
}

// Botón chico de la lista "Minoristas (web)": trae los pedidos nuevos de la tienda (también se hace solo cada 15 minutos).
export function BotonTraerPedidos() {
  const router = useRouter();
  const [msg, setMsg] = useState<{ texto: string; ok: boolean } | null>(null);
  const [trabajando, empezar] = useTransition();
  return (
    <>
      <button type="button" disabled={trabajando} className={boton} onClick={() => empezar(async () => {
        setMsg(null);
        const r = await traerPedidosWeb();
        setMsg({ texto: r.mensaje, ok: r.ok });
        router.refresh();
      })}>
        {trabajando ? "Trayendo…" : "Traer pedidos ahora"}
      </button>
      {msg && <Cartel {...msg} cerrar={() => setMsg(null)} />}
    </>
  );
}
