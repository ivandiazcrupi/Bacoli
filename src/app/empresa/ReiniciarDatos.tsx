"use client";

import { useActionState } from "react";
import { reiniciarDatos, type EstadoReinicio } from "./actions";

// Empezar de cero: explica qué se borra y qué se conserva, y pide escribir BORRAR. Solo se habilita con una copia reciente.
export function ReiniciarDatos({ copiaReciente, pedidos, minoristasQueQuedan }: { copiaReciente: boolean; pedidos: number; minoristasQueQuedan: number }) {
  const [estado, enviar, cargando] = useActionState(reiniciarDatos, undefined as EstadoReinicio);
  return (
    <section className="rounded-xl border border-rojo-600 bg-white p-5 shadow-sm" aria-label="Empezar de cero">
      <h2 className="text-lg font-bold text-rojo-700">Empezar de cero (para pruebas)</h2>
      <div className="mt-2 grid gap-4 text-sm text-stone-700 lg:grid-cols-2">
        <div>
          <p className="font-semibold text-stone-900">Se borra, y no se puede deshacer:</p>
          <ul className="mt-1 list-disc pl-5">
            <li>Todos los pedidos ({pedidos} hoy), mayoristas y minoristas, menos los {minoristasQueQuedan} minoristas más recientes.</li>
            <li>Toda la cuenta corriente: movimientos, pagos y notas de crédito.</li>
            <li>Las hojas de ruta armadas y los días cerrados.</li>
            <li>El contador de remitos vuelve a R-0001.</li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-stone-900">Se conserva:</p>
          <ul className="mt-1 list-disc pl-5">
            <li>Clientes y sucursales, productos, listas y precios.</li>
            <li>Usuarios y roles, camionetas y datos de la empresa.</li>
            <li>Los {minoristasQueQuedan} minoristas más recientes, reiniciados (pendientes, sin día; los de Mercado Pago siguen pagados).</li>
          </ul>
        </div>
      </div>
      <form action={enviar} className="mt-4 flex flex-wrap items-center gap-3">
        <input name="confirmacion" autoComplete="off" placeholder="Escribí BORRAR" aria-label="Escribí BORRAR para confirmar" className="h-10 w-48 rounded-md border border-stone-400 bg-white px-3 text-sm uppercase" />
        <button disabled={cargando || !copiaReciente} onClick={(e) => { if (!window.confirm("¿Seguro? Se borran los pedidos y la cuenta corriente. No se puede deshacer (solo restaurando la copia).")) e.preventDefault(); }} className="h-10 rounded-md bg-rojo-700 px-5 text-sm font-bold text-white hover:bg-rojo-800 disabled:opacity-40">{cargando ? "Borrando…" : "Empezar de cero"}</button>
        {!copiaReciente && <p className="text-sm font-semibold text-rojo-700">Primero bajá la copia de seguridad (botón de arriba): tiene que ser de los últimos 30 minutos.</p>}
      </form>
      {estado?.error && <p className="mt-2 text-sm font-semibold text-rojo-700" role="alert">{estado.error}</p>}
      {estado?.ok && <p className="mt-2 text-sm font-semibold text-verde-700">{estado.ok}</p>}
    </section>
  );
}
