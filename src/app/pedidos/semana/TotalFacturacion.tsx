"use client";

import { useActionState, useState } from "react";
import { bloquearTotales, desbloquearTotales } from "./actions";

// Totales de la semana: ocultos hasta poner la contraseña (la misma de Vendedores y Estadísticas).
export function DesbloquearTotales() {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState(desbloquearTotales, undefined);
  if (!abierto) return <button type="button" onClick={() => setAbierto(true)} className="text-sm font-semibold text-stone-600 underline hover:text-stone-900">Desbloquear totales</button>;
  return (
    <form action={accion} className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-1">
        <input name="clave" type="password" autoFocus required placeholder="Contraseña" autoComplete="off" className="w-28 rounded border border-stone-400 bg-white px-2 py-1 text-sm font-normal" />
        <button disabled={pendiente} className="rounded bg-stone-800 px-2 py-1 text-sm font-semibold text-white disabled:opacity-60">Ver</button>
      </div>
      {estado?.error && <span className="text-xs font-normal text-rojo-700">{estado.error}</span>}
    </form>
  );
}

export function OcultarTotales() {
  return <form action={bloquearTotales}><button className="text-[11px] font-normal text-stone-500 underline hover:text-stone-800">Ocultar</button></form>;
}
