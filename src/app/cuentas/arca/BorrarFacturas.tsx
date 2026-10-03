"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { borrarFacturasArca } from "./actions";

export function BorrarFacturas({ cantidad }: { cantidad: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [trabajando, empezar] = useTransition();
  const borrar = () => {
    if (!window.confirm(`¿Borrar las ${cantidad} facturas y notas de crédito cargadas de ARCA?\n\nSe pierden también los pagos marcados en ellas y las notas aplicadas. No se tocan los pedidos ni los remitos. Después podés volver a subir el archivo.`)) return;
    empezar(async () => { const r = await borrarFacturasArca(); if (!r.ok) setError(r.error ?? "No se pudo."); router.refresh(); });
  };
  return (
    <div className="mt-3">
      <button type="button" onClick={borrar} disabled={trabajando || cantidad === 0} className="rounded-md border border-rojo-600 bg-white px-3 py-1.5 text-xs font-semibold text-rojo-700 hover:bg-rojo-50 disabled:opacity-40">{trabajando ? "Borrando…" : `Borrar las ${cantidad} facturas cargadas (solo dueños)`}</button>
      {error && <p className="mt-1 text-xs font-semibold text-rojo-700" role="alert">{error}</p>}
    </div>
  );
}
