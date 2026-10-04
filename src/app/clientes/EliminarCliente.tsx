"use client";

import { useActionState } from "react";
import { eliminarCliente } from "./actions";

// Eliminar un cliente (solo dueños, y solo si nunca tuvo movimiento). Si tiene historial, explica por qué no y sugiere desactivar.
export function EliminarCliente({ id, nombre }: { id: string; nombre: string }) {
  const [estado, enviar, cargando] = useActionState(eliminarCliente, undefined);
  return (
    <form action={enviar} onSubmit={(e) => { if (!window.confirm(`¿Eliminar al cliente ${nombre}?\n\nSe borran también sus sucursales. No se puede deshacer.`)) e.preventDefault(); }} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <button disabled={cargando} className="rounded-md border border-rojo-600 bg-white px-4 py-2 text-sm font-semibold text-rojo-700 hover:bg-rojo-50 disabled:opacity-60">{cargando ? "…" : "Eliminar"}</button>
      {estado?.error && <p className="max-w-sm text-right text-xs font-medium text-rojo-700" role="alert">{estado.error}</p>}
    </form>
  );
}
