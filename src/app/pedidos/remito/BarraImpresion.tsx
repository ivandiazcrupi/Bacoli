"use client";

import Link from "next/link";

// Barra de arriba de la pantalla del remito. No sale en la impresión.
export function BarraImpresion({ volver, textoVolver, conPrecios, enlacePrecios }: { volver: string; textoVolver: string; conPrecios: boolean; enlacePrecios: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3 print:hidden">
      <Link href={volver} className="text-sm text-stone-600">← {textoVolver}</Link>
      <div className="flex items-center gap-3">
        <Link href={enlacePrecios} className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm">{conPrecios ? "Sin precios" : "Con precios"}</Link>
        <button type="button" onClick={() => window.print()} className="rounded-lg bg-amber-700 px-5 py-2.5 font-semibold text-white">Imprimir</button>
      </div>
    </div>
  );
}
