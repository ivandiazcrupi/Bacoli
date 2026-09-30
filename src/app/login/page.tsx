"use client";

import { useActionState } from "react";
import { iniciarSesion } from "./actions";

export default function LoginPage() {
  const [estado, accion, cargando] = useActionState(iniciarSesion, undefined);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-1 text-3xl font-bold">BACOLI</h1>
      <p className="mb-6 text-stone-600">Ingresá para continuar</p>
      <form action={accion} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Usuario</span>
          <input
            name="usuario"
            defaultValue={estado?.usuario}
            type="text"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            required
            className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-3 text-base"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Contraseña</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-3 text-base"
          />
        </label>
        {estado?.error && <p className="text-sm text-rojo-700">{estado.error}</p>}
        <button
          disabled={cargando}
          className="w-full rounded-lg bg-verde-700 px-4 py-3 font-semibold text-white disabled:opacity-60"
        >
          {cargando ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </main>
  );
}
