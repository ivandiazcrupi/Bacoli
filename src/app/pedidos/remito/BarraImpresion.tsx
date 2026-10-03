"use client";

import Link from "next/link";

// Barra de arriba de la pantalla del remito. No sale en la impresión. El remito siempre sale con precios.
export function BarraImpresion({ volver, textoVolver }: { volver: string; textoVolver: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-300 bg-white px-4 py-3 print:hidden">
      <Link href={volver} className="text-sm text-stone-600">← {textoVolver}</Link>
      <button type="button" onClick={() => window.print()} className="rounded-lg bg-verde-700 px-5 py-2.5 font-semibold text-white">Imprimir</button>
    </div>
  );
}
