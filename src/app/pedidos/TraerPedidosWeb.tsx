"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { actualizarBarriosTienda, traerPedidosWeb } from "./actions";

// Botón de la lista "Minoristas (web)": lee la planilla de la tienda y trae los pedidos nuevos (también se hace solo cada 15 minutos).
export function TraerPedidosWeb() {
  const router = useRouter();
  const [mensaje, setMensaje] = useState<{ texto: string; ok: boolean } | null>(null);
  const [trabajando, empezar] = useTransition();
  const [dudosos, setDudosos] = useState<{ cp: string; detalle: string }[]>([]);
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
      <button
        type="button"
        disabled={trabajando}
        title="Mira los pedidos ya cargados y aprende qué barrio usa el equipo para cada código postal"
        onClick={() => empezar(async () => {
          setMensaje(null);
          const r = await actualizarBarriosTienda();
          setMensaje({ texto: r.mensaje, ok: r.ok });
          setDudosos(r.dudosos);
        })}
        className="h-9 rounded-md border border-stone-400 bg-white px-3 text-sm font-medium shadow-sm hover:bg-crema-100 disabled:opacity-50"
      >
        Actualizar barrios
      </button>
      {mensaje && <span className={`text-sm ${mensaje.ok ? "text-stone-700" : "text-rojo-700"}`} role="status">{mensaje.texto}</span>}
      {dudosos.length > 0 && (
        <p className="w-full text-[12.5px] text-stone-600">Códigos postales con más de un barrio (esos pedidos entran con el barrio a completar): {dudosos.map((d) => `${d.cp} → ${d.detalle}`).join(" · ")}</p>
      )}
    </div>
  );
}
