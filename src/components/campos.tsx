import type { ReactNode } from "react";

export const estiloCampo = "mt-1 w-full rounded-md border border-stone-400 bg-white px-3 py-2.5 text-base font-normal text-stone-900 shadow-sm placeholder:text-stone-400 focus:border-verde-700 focus:outline-none focus:ring-2 focus:ring-verde-700/25";
/** Campo de datos: se ve en MAYÚSCULA al escribir (y se guarda así). */
export const estiloDato = `${estiloCampo} dato`;
export const estiloBoton = "w-full rounded-lg bg-verde-700 px-4 py-3 font-semibold text-white disabled:opacity-60";
export const estiloBotonChico = "rounded-md border border-stone-400 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:border-verde-700 hover:text-verde-800";
/** Barra de encabezado de las tablas: verde oscuro con letras blancas (Clientes, Sucursales, Pedidos del cliente). */
export const cabeceraTabla = "border-b border-stone-300 bg-crema-200 text-xs font-semibold uppercase tracking-wide text-stone-700";

export function Campo({ etiqueta, ayuda, children }: { etiqueta: string; ayuda?: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-stone-700">
      {etiqueta}
      {children}
      {ayuda && <span className="mt-1 block text-xs font-normal text-stone-500">{ayuda}</span>}
    </label>
  );
}

export function Mensajes({ estado }: { estado?: { error?: string; ok?: string } }) {
  return (
    <>
      {estado?.error && <p className="text-sm text-rojo-700">{estado.error}</p>}
      {estado?.ok && <p className="text-sm text-verde-700">{estado.ok}</p>}
    </>
  );
}

/** Tarjeta de formulario: panel lateral crema con barra verde (título y ayuda) y los campos a la derecha, centrados de arriba a abajo. */
export function Bloque({ titulo, ayuda, children }: { titulo: string; ayuda: string; children: ReactNode }) {
  return (
    <section className="grid overflow-hidden rounded-xl border border-stone-300 bg-white shadow-sm lg:grid-cols-[15rem_1fr]">
      <div className="flex flex-col justify-center border-b border-stone-300 border-l-4 border-l-verde-700 bg-crema-100 p-5 lg:border-b-0 lg:border-r">
        <h2 className="text-sm font-bold uppercase tracking-wide text-verde-800">{titulo}</h2>
        <p className="mt-1 text-xs leading-snug text-stone-600">{ayuda}</p>
      </div>
      <div className="flex items-center p-5"><div className="w-full">{children}</div></div>
    </section>
  );
}
