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
  const tamano = grande ? "h-9 px-3 text-sm" : "mt-0.5 px-2 py-0.5 text-[11px]";

  const enviar = () => empezar(async () => {
    setError(null);
    const v = await prepararAviso(pedidoId);
    if (!v.ok) { setError(v.error ?? "No se pudo preparar el mail."); return; }
    if (!window.confirm(`Se va a enviar este email a ${v.para}:\n\nAsunto: ${v.asunto}\n\n${v.texto}\n\n¿Lo enviamos?`)) return;
    const r = await enviarAviso(pedidoId);
    if (!r.ok) { setError(r.error ?? "No se pudo enviar."); return; }
    setEnviadoAhora(true);
    router.refresh();
  });

  if (!tieneEmail) return <span className={`block text-stone-400 ${grande ? "text-sm" : "text-[11px]"}`} title="Cargá el email en “Editar pedido”">Sin email</span>;
  return (
    <span className="block">
      {emitido ? (
        <span className={`inline-flex flex-wrap items-center justify-center gap-x-2 ${grande ? "text-sm" : "text-[11px]"}`}>
          <span className="font-semibold text-verde-700">✓ Email enviado{avisoEn ? ` ${avisoEn}` : ""}</span>
          <button type="button" disabled={trabajando} onClick={enviar} className="text-stone-500 underline decoration-stone-300 underline-offset-2 hover:text-stone-800 disabled:opacity-50">{trabajando ? "Enviando…" : "reenviar"}</button>
        </span>
      ) : (
        <button type="button" disabled={trabajando} onClick={enviar} className={`rounded border border-stone-400 bg-white font-medium text-stone-700 shadow-sm hover:bg-crema-100 disabled:opacity-50 ${tamano}`}>
          {trabajando ? "Enviando…" : "✉ Enviar email"}
        </button>
      )}
      {error && <span className="mt-0.5 block text-[11px] font-semibold text-rojo-700" role="alert">{error}</span>}
    </span>
  );
}
