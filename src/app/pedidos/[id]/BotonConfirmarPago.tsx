"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { marcarPagoWeb } from "../actions";

// Pago de un pedido de la tienda: pendiente (rojo) o pagado (verde). Confirmar y deshacer piden confirmación, con el monto a la vista.
// Los de Mercado Pago no se tocan acá (si se devuelve el pago, se cancela el pedido).
export function BotonConfirmarPago({ pedidoId, nombre, monto, pagado, medio, detalle, puedeCambiar }: { pedidoId: string; nombre: string; monto: string; pagado: boolean; medio: string | null; detalle: string | null; puedeCambiar: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [trabajando, empezar] = useTransition();
  const cambiar = (nuevo: boolean) => {
    const texto = nuevo
      ? `¿Confirmás que YA LLEGÓ la transferencia de ${monto} de ${nombre}?\n\nRevisá que esté acreditada en la cuenta. Se puede deshacer mientras el pedido no se entregue.`
      : `¿Volver a "pendiente de pago" el pedido de ${nombre}?`;
    if (!window.confirm(texto)) return;
    setError(null);
    empezar(async () => {
      const r = await marcarPagoWeb(pedidoId, nuevo);
      if (!r.ok) setError(r.error ?? "No se pudo cambiar el pago.");
      router.refresh();
    });
  };
  return (
    <span className="inline-flex flex-col items-center gap-1">
      {pagado ? <span className="font-semibold text-verde-700">Pagado · {medio}</span> : <span className="font-semibold text-rojo-700">Pendiente de pago</span>}
      {pagado && detalle && <span className="text-xs font-normal text-stone-500">{detalle}</span>}
      {puedeCambiar && !pagado && (
        <button type="button" disabled={trabajando} onClick={() => cambiar(true)} className="rounded-md border border-stone-500 bg-white px-2 py-1 text-xs font-semibold text-stone-800 hover:bg-stone-800 hover:text-white">
          {trabajando ? "…" : "Confirmar pago…"}
        </button>
      )}
      {puedeCambiar && pagado && medio === "Transferencia" && (
        <button type="button" disabled={trabajando} onClick={() => cambiar(false)} className="text-xs font-normal text-stone-500 underline underline-offset-2 hover:text-rojo-700">Deshacer pago</button>
      )}
      {error && <span className="text-xs text-rojo-700" role="alert">{error}</span>}
    </span>
  );
}
