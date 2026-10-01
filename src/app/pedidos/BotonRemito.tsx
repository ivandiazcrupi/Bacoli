"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { emitirRemito } from "./remito/actions";

// Emite el remito (si todavía no tiene número) y lo abre en otra pestaña, listo para imprimir.
export function BotonRemito({ pedidoId, numero, clase, textoSinNumero = "Remito" }: { pedidoId: string; numero: string | null; clase: string; textoSinNumero?: string }) {
  const router = useRouter();
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abrir = async () => {
    const ventana = window.open("", "_blank"); // se abre ya, para que el navegador no la bloquee
    setTrabajando(true);
    setError(null);
    const r = await emitirRemito(pedidoId);
    setTrabajando(false);
    if (!r.ok) {
      ventana?.close();
      setError(r.error ?? "No se pudo emitir el remito.");
      return;
    }
    if (ventana) ventana.location.href = `/pedidos/${pedidoId}/remito`;
    router.refresh();
  };

  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" onClick={abrir} disabled={trabajando} className={clase}>{trabajando ? "…" : numero ?? textoSinNumero}</button>
      {error && <span className="text-xs text-rojo-700" role="alert">{error}</span>}
    </span>
  );
}
