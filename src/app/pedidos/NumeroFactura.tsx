"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { soloNumeroFactura } from "@/lib/remito";
import { guardarNumeroFactura } from "./dia/actions";

// Casillero para cargar a mano el N° de factura de un pedido (se guarda al salir del campo).
export function NumeroFactura({ pedidoId, inicial: guardado, bloqueado }: { pedidoId: string; inicial: string; bloqueado: boolean }) {
  const inicial = soloNumeroFactura(guardado);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [, empezar] = useTransition();
  return (
    <span className="block">
      <label className={`mx-auto flex h-8 w-36 items-center overflow-hidden rounded-md border bg-white ${inicial ? "border-stone-400" : "border-rojo-600"}`}>
        <span className="flex h-full items-center bg-crema-200 px-2 text-sm font-bold text-stone-800">F-</span>
        <input
        aria-label="Número de factura"
        placeholder="0000"
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
        inputMode="numeric"
        className="h-full w-full min-w-0 px-1 text-center text-sm font-semibold tabular-nums outline-none"
        />
      </label>
      {error && <span className="mt-1 block text-xs font-normal text-rojo-700" role="alert">{error}</span>}
    </span>
  );
}
