"use client";

import { BotonVolver } from "@/components/BotonVolver";

// Barra de arriba de la pantalla del remito. No sale en la impresión. El remito siempre sale con precios.
export function BarraImpresion({ volver }: { volver: string; textoVolver?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 border-b border-stone-300 bg-white px-4 py-3 print:hidden">
      <button type="button" onClick={() => window.print()} className="rounded-lg bg-verde-700 px-5 py-2.5 font-semibold text-white">Imprimir</button>
      <BotonVolver fallback={volver} />
    </div>
  );
}
