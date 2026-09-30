import type { ReactNode } from "react";

export const estiloCampo = "mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-3 text-base";
/** Campo de datos: se ve en MAYÚSCULA al escribir (y se guarda así). */
export const estiloDato = `${estiloCampo} dato`;
export const estiloBoton = "w-full rounded-lg bg-verde-700 px-4 py-3 font-semibold text-white disabled:opacity-60";
export const estiloBotonChico = "rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm";

export function Campo({ etiqueta, ayuda, children }: { etiqueta: string; ayuda?: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-medium">
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
