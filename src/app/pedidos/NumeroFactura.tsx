"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { guardarNumeroFactura } from "./dia/actions";

// Casillero para cargar a mano el N° de factura de un pedido (se guarda al salir del campo).
export function NumeroFactura({ pedidoId, inicial, bloqueado }: { pedidoId: string; inicial: string; bloqueado: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [, empezar] = useTransition();
  return (
    <span className="block">
      <input
        aria-label="Número de factura"
        placeholder="Cargar N°"
        defaultValue={inicial}
        disabled={bloqueado}
        onBlur={(e) => {
          if (e.target.value.trim() === inicial) return;
          setError(null);
          empezar(async () => {
            const r = await guardarNumeroFactura(pedidoId, e.target.value);
            if (!r.ok) setError(r.error ?? "No se pudo guardar.");
            router.refresh();
          });
        }}
        className={`h-8 w-40 rounded border bg-white px-2 text-center text-sm tabular-nums ${inicial ? "border-stone-300" : "border-rojo-600"}`}
      />
      {error && <span className="mt-1 block text-xs font-normal text-rojo-700" role="alert">{error}</span>}
    </span>
  );
}
