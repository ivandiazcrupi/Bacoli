"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { aplicarEnvioAl21 } from "./actions";

export function AplicarEnvio({ cantidad, diferencia }: { cantidad: number; diferencia: string }) {
  const router = useRouter();
  const [trabajando, empezar] = useTransition();
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const aplicar = () => {
    if (!window.confirm(`¿Poner el envío al 21% de IVA en estas ${cantidad} ${cantidad === 1 ? "factura" : "facturas"}?\n\nLos montos suben ${diferencia} en total y la cuenta corriente de cada cliente se ajusta sola. Las facturas que ya están en ARCA no cambian allá.\n\nTiene que estar bajada la copia de seguridad de los últimos 30 minutos.`)) return;
    empezar(async () => {
      const r = await aplicarEnvioAl21();
      setMensaje({ ok: r.ok, texto: r.ok ? (r.mensaje ?? "Listo.") : (r.error ?? "No se pudo.") });
      router.refresh();
    });
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" disabled={trabajando} onClick={aplicar} className="rounded-md bg-verde-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-verde-800 disabled:opacity-50">{trabajando ? "Aplicando…" : "Poner el envío al 21% en estas facturas"}</button>
      {mensaje && <p className={`text-sm font-medium ${mensaje.ok ? "text-verde-800" : "text-rojo-700"}`} role="status">{mensaje.texto}</p>}
    </div>
  );
}
