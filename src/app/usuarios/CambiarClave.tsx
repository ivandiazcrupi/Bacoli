"use client";

import { useActionState } from "react";
import { restablecerClave } from "./actions";

export function CambiarClave({ id }: { id: string }) {
  const [estado, accion, cargando] = useActionState(restablecerClave.bind(null, id), undefined);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer rounded-lg border border-stone-300 px-3 py-2">Cambiar contraseña</summary>
      <form action={accion} className="mt-2 flex flex-wrap items-center gap-2">
        <input name="nueva" type="text" minLength={4} required autoComplete="off" placeholder="Contraseña nueva" className="rounded-lg border border-stone-300 px-3 py-2" />
        <button disabled={cargando} className="rounded-lg bg-amber-700 px-3 py-2 font-semibold text-white disabled:opacity-60">Guardar</button>
        {estado?.error && <p className="w-full text-red-700">{estado.error}</p>}
        {estado?.ok && <p className="w-full text-green-700">{estado.ok}</p>}
      </form>
    </details>
  );
}
