"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deshacerPago } from "../actions";

export function DeshacerPago({ pedidoId }: { pedidoId: string }) {
  const router = useRouter();
  const [, empezar] = useTransition();
  return (
    <button
      type="button"
      onClick={() => {
        if (!window.confirm("¿Deshacer este pago? El comprobante vuelve a figurar sin pagar.")) return;
        empezar(async () => {
          const r = await deshacerPago(pedidoId);
          if (!r.ok) window.alert(r.error);
          router.refresh();
        });
      }}
      className="text-xs text-stone-500 underline hover:text-rojo-700"
    >
      deshacer
    </button>
  );
}
