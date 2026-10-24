"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { enviarAviso, prepararAviso } from "@/app/pedidos/aviso-email";

/** Botón de cada pedido de la tienda: manda el mail "tu pedido llegará el…" a ESE cliente (pide confirmar) y queda marcado como emitido. */
export function BotonAvisoEmail({ pedidoId, tieneEmail, avisoEn, grande }: { pedidoId: string; tieneEmail: boolean; avisoEn: string | null; grande?: boolean }) {
  const router = useRouter();
  const [trabajando, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [enviadoAhora, setEnviadoAhora] = useState(false);
  const emitido = avisoEn || enviadoAhora;
  const tamano = grande ? "h-11 px-5 text-base" : "mt-1 h-7 px-3 text-[12px]";

  const enviar = () => empezar(async () => {
    setError(null);
    const v = await prepararAviso(pedidoId);
    if (!v.ok) { setError(v.error ?? "No se pudo preparar el mail."); return; }
    if (!window.confirm(`Se va a enviar este email a ${v.para}:\n\nAsunto: ${v.asunto}\n\n${v.texto}\n\nSe manda UNA sola vez: si después hay que escribirle algo más al cliente, se hace a mano.\n\n¿Lo enviamos?`)) return;
    const r = await enviarAviso(pedidoId);
    if (!r.ok) { setError(r.error ?? "No se pudo enviar."); return; }
    setEnviadoAhora(true);
    router.refresh();
  });

  if (!tieneEmail) return <span className={`block text-stone-400 ${grande ? "text-sm" : "text-[11px]"}`} title="Cargá el email en “Editar pedido”">Sin email</span>;
  return (
    <span className="block">
      {emitido ? (
        <span className={`inline-flex items-center rounded-md bg-verde-50 font-semibold text-verde-700 ${grande ? "h-11 px-5 text-base" : "mt-1 h-7 px-3 text-[12px]"}`} title="Ya se le mandó el aviso. Si hay que escribirle algo más, se hace a mano.">
          ✓ Email enviado{avisoEn ? ` ${avisoEn}` : ""}
        </span>
      ) : (
        <button type="button" disabled={trabajando} onClick={enviar} className={`inline-flex items-center rounded-md bg-verde-700 font-bold text-white hover:bg-verde-800 disabled:opacity-50 ${tamano}`}>
          {trabajando ? "Enviando…" : "✉ Enviar email"}
        </button>
      )}
      {error && <span className="mt-0.5 block text-[11px] font-semibold text-rojo-700" role="alert">{error}</span>}
    </span>
  );
}
