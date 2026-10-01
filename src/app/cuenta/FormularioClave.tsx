"use client";

import { useActionState } from "react";
import { Bloque, Campo, Mensajes, estiloCampo } from "@/components/campos";
import { cambiarContrasena, cambiarUsuario } from "./actions";

const boton = "rounded-md bg-verde-700 px-6 py-3 font-semibold text-white shadow-sm hover:bg-verde-800 disabled:opacity-60";

export function FormularioClave() {
  const [estado, enviar, cargando] = useActionState(cambiarContrasena, undefined);
  return (
    <Bloque titulo="Contraseña" ayuda="Para entrar al sistema. Mínimo 4 caracteres.">
      <form action={enviar} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo etiqueta="Contraseña actual">
            <input name="actual" type="password" autoComplete="current-password" required className={estiloCampo} />
          </Campo>
          <Campo etiqueta="Contraseña nueva">
            <input name="nueva" type="password" autoComplete="new-password" minLength={4} required className={estiloCampo} />
          </Campo>
          <Campo etiqueta="Repetí la contraseña nueva">
            <input name="repetida" type="password" autoComplete="new-password" required className={estiloCampo} />
          </Campo>
        </div>
        <Mensajes estado={estado} />
        <div className="flex justify-end"><button disabled={cargando} className={boton}>{cargando ? "Guardando…" : "Cambiar contraseña"}</button></div>
      </form>
    </Bloque>
  );
}

export function FormularioUsuario({ usuario }: { usuario: string }) {
  const [estado, enviar, cargando] = useActionState(cambiarUsuario, undefined);
  return (
    <Bloque titulo="Usuario" ayuda="Con este nombre entrás al sistema.">
      <form action={enviar} className="flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1">
          <Campo etiqueta="Usuario (para entrar)">
            <input name="usuario" defaultValue={usuario} required autoCapitalize="none" autoCorrect="off" autoComplete="off" className={estiloCampo} />
          </Campo>
        </div>
        <button disabled={cargando} className={`${boton} mb-px`}>{cargando ? "Guardando…" : "Cambiar usuario"}</button>
        <div className="w-full"><Mensajes estado={estado} /></div>
      </form>
    </Bloque>
  );
}
