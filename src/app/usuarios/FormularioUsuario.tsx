"use client";

import { useActionState } from "react";
import { NOMBRE_ROL } from "@/lib/roles";
import { crearUsuario } from "./actions";

const campo = "mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-3 text-base";

export function FormularioUsuario() {
  const [estado, accion, cargando] = useActionState(crearUsuario, undefined);

  return (
    <form action={accion} className="space-y-3 rounded-lg border border-stone-200 bg-white p-4">
      <h2 className="font-semibold">Nuevo usuario</h2>
      <label className="block text-sm font-medium">
        Nombre
        <input name="nombre" required className={campo} />
      </label>
      <label className="block text-sm font-medium">
        Usuario (para entrar)
        <input name="usuario" required autoCapitalize="none" autoCorrect="off" autoComplete="off" className={campo} />
      </label>
      <label className="block text-sm font-medium">
        Email (opcional)
        <input name="email" type="email" className={campo} />
      </label>
      <label className="block text-sm font-medium">
        Contraseña inicial (mín. 4 caracteres)
        <input name="password" type="text" minLength={4} required autoComplete="off" className={campo} />
      </label>
      <label className="block text-sm font-medium">
        Rol
        <select name="rol" required defaultValue="" className={campo}>
          <option value="" disabled hidden>Elegí un rol</option>
          {Object.entries(NOMBRE_ROL).map(([valor, texto]) => (
            <option key={valor} value={valor}>{texto}</option>
          ))}
        </select>
      </label>
      {estado?.error && <p className="text-sm text-rojo-700">{estado.error}</p>}
      {estado?.ok && <p className="text-sm text-verde-700">{estado.ok}</p>}
      <button disabled={cargando} className="w-full rounded-lg bg-verde-700 px-4 py-3 font-semibold text-white disabled:opacity-60">
        {cargando ? "Creando…" : "Crear usuario"}
      </button>
    </form>
  );
}
