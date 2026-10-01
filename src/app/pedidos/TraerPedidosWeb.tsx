"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { traerPedidosWeb } from "./actions";

// Botón de la lista "Minoristas (web)": lee la planilla de la tienda y trae los pedidos nuevos (también se hace solo cada 15 minutos).
export function TraerPedidosWeb() {
  const router = useRouter();
  const [mensaje, setMensaje] = useState<{ texto: string; ok: boolean } | null>(null);
  const [trabajando, empezar] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={trabajando}
        onClick={() => empezar(async () => {
          setMensaje(null);
          const r = await traerPedidosWeb();
          setMensaje({ texto: r.mensaje, ok: r.ok });
          router.refresh();
        })}
        className="h-9 rounded-md border border-stone-400 bg-white px-3 text-sm font-medium shadow-sm hover:bg-crema-100 disabled:opacity-50"
      >
        {trabajando ? "Trayendo…" : "Traer pedidos ahora"}
      </button>
      {mensaje && <span className={`text-sm ${mensaje.ok ? "text-stone-700" : "text-rojo-700"}`} role="status">{mensaje.texto}</span>}
    </div>
  );
}
