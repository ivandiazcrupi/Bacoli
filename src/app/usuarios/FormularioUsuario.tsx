"use client";

import { useActionState } from "react";
import { Bloque, Campo, Mensajes, estiloCampo } from "@/components/campos";
import { NOMBRE_ROL } from "@/lib/roles";
import { crearUsuario } from "./actions";

export function FormularioUsuario() {
  const [estado, accion, cargando] = useActionState(crearUsuario, undefined);

  return (
    <Bloque titulo="Nuevo usuario" ayuda="Para sumar a alguien del equipo. El email es opcional.">
      <form action={accion} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Campo etiqueta="Nombre"><input name="nombre" required className={estiloCampo} /></Campo>
          <Campo etiqueta="Usuario (para entrar)"><input name="usuario" required autoCapitalize="none" autoCorrect="off" autoComplete="off" className={estiloCampo} /></Campo>
          <Campo etiqueta="Email (opcional)"><input name="email" type="email" className={estiloCampo} /></Campo>
          <Campo etiqueta="Contraseña inicial (mín. 4)"><input name="password" type="text" minLength={4} required autoComplete="off" className={estiloCampo} /></Campo>
          <Campo etiqueta="Rol">
            <select name="rol" required defaultValue="" className={estiloCampo}>
              <option value="" disabled hidden>Elegí un rol</option>
              {Object.entries(NOMBRE_ROL).map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
            </select>
          </Campo>
        </div>
        <Mensajes estado={estado} />
        <div className="flex justify-end">
          <button disabled={cargando} className="rounded-md bg-verde-700 px-8 py-3 font-semibold text-white shadow-sm hover:bg-verde-800 disabled:opacity-60">{cargando ? "Creando…" : "Crear usuario"}</button>
        </div>
      </form>
    </Bloque>
  );
}
