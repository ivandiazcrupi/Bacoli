"use client";

import { useActionState } from "react";
import { Campo, Mensajes, estiloBoton, estiloCampo } from "@/components/campos";
import { crearMarca } from "./actions";

export function FormularioMarca() {
  const [estado, enviar, cargando] = useActionState(crearMarca, undefined);
  return (
    <form key={JSON.stringify(estado ?? null)} action={enviar} className="space-y-3 rounded-lg border border-stone-200 bg-white p-4">
      <h2 className="font-semibold">Nueva marca</h2>
      <Campo etiqueta="Nombre" ayuda="Ej: VACALIN. Después se la asignas a cada cliente desde su ficha.">
        <input name="nombre" defaultValue={estado?.valores?.nombre ?? ""} required className={estiloCampo} />
      </Campo>
      <Mensajes estado={estado} />
      <button disabled={cargando} className={estiloBoton}>{cargando ? "Creando…" : "Crear marca"}</button>
    </form>
  );
}
