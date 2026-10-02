"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { anularNotaCredito } from "../actions";

export function AnularNota({ notaId }: { notaId: string }) {
  const router = useRouter();
  const [, empezar] = useTransition();
  return (
    <button
      type="button"
      onClick={() => {
        if (!window.confirm("¿Anular esta nota de crédito? Los comprobantes vuelven a deber ese monto. Queda registrada como anulada.")) return;
        empezar(async () => {
          const r = await anularNotaCredito(notaId);
          if (!r.ok) window.alert(r.error);
          router.refresh();
        });
      }}
      className="text-xs text-stone-500 underline hover:text-rojo-700"
    >
      anular
    </button>
  );
}
