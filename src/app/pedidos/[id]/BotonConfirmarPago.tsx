"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { confirmarPagoWeb } from "../actions";

// Pedido de la tienda sin pago: se confirma cuando llega la transferencia.
export function BotonConfirmarPago({ pedidoId }: { pedidoId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [trabajando, empezar] = useTransition();
  return (
    <span className="inline-flex flex-col items-center gap-1">
      <span className="font-semibold text-rojo-700">Falta confirmar</span>
      <button
        type="button"
        disabled={trabajando}
        onClick={() => empezar(async () => {
          const r = await confirmarPagoWeb(pedidoId);
          if (!r.ok) setError(r.error ?? "No se pudo confirmar.");
          router.refresh();
        })}
        className="rounded-md border border-verde-700 bg-white px-2 py-1 text-xs font-semibold text-verde-800 hover:bg-verde-700 hover:text-white"
      >
        {trabajando ? "…" : "Confirmar transferencia"}
      </button>
      {error && <span className="text-xs text-rojo-700" role="alert">{error}</span>}
    </span>
  );
}
