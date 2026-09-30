"use client";

import { useActionState } from "react";
import { Campo, Mensajes, estiloBoton, estiloCampo } from "@/components/campos";
import { cambiarContrasena } from "./actions";

export function FormularioClave() {
  const [estado, enviar, cargando] = useActionState(cambiarContrasena, undefined);
  return (
    <form action={enviar} className="space-y-3 rounded-lg border border-stone-200 bg-white p-4">
      <Campo etiqueta="Contraseña actual">
        <input name="actual" type="password" autoComplete="current-password" required className={estiloCampo} />
      </Campo>
      <Campo etiqueta="Contraseña nueva (mín. 8 caracteres)">
        <input name="nueva" type="password" autoComplete="new-password" minLength={8} required className={estiloCampo} />
      </Campo>
      <Campo etiqueta="Repetí la contraseña nueva">
        <input name="repetida" type="password" autoComplete="new-password" required className={estiloCampo} />
      </Campo>
      <Mensajes estado={estado} />
      <button disabled={cargando} className={estiloBoton}>{cargando ? "Guardando…" : "Cambiar contraseña"}</button>
    </form>
  );
}
