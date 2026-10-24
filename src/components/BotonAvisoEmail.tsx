"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { marcarAvisoEnviado, prepararAviso, quitarMarcaAviso } from "@/app/pedidos/aviso-email";

type Mail = { para: string; asunto: string; texto: string };

function Copiar({ texto, etiqueta }: { texto: string; etiqueta: string }) {
  const [listo, setListo] = useState(false);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(texto); } catch {
      const t = document.createElement("textarea");
      t.value = texto; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove();
    }
    setListo(true);
    setTimeout(() => setListo(false), 2000);
  };
  return <button type="button" onClick={copiar} className="h-8 shrink-0 rounded-md border border-stone-400 bg-white px-3 text-[13px] font-semibold hover:bg-crema-100">{listo ? "✓ Copiado" : etiqueta}</button>;
}

/**
 * Botón de cada pedido de la tienda: arma el mail "tu pedido llegará el…" para ESE cliente y lo muestra listo para copiar y pegar en Gmail.
 * Después de mandarlo a mano se marca "Ya lo envié" y el pedido queda con "✓ Email enviado".
 */
export function BotonAvisoEmail({ pedidoId, tieneEmail, avisoEn, grande }: { pedidoId: string; tieneEmail: boolean; avisoEn: string | null; grande?: boolean }) {
  const router = useRouter();
  const [trabajando, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mail, setMail] = useState<Mail | null>(null);
  const tamano = grande ? "h-11 px-5 text-base" : "mt-1 h-7 px-3 text-[12px]";

  const abrir = () => empezar(async () => {
    setError(null);
    const v = await prepararAviso(pedidoId);
    if (!v.ok) { setError(v.error ?? "No se pudo preparar el mail."); return; }
    setMail({ para: v.para!, asunto: v.asunto!, texto: v.texto! });
  });
  const yaLoEnvie = () => empezar(async () => {
    const r = await marcarAvisoEnviado(pedidoId);
    if (!r.ok) { setError(r.error ?? "No se pudo anotar."); return; }
    setMail(null);
    router.refresh();
  });
  const deshacer = () => {
    if (!window.confirm("¿Sacar la marca de “email enviado”? Hacelo solo si se marcó por error.")) return;
    empezar(async () => { await quitarMarcaAviso(pedidoId); router.refresh(); });
  };

  if (!tieneEmail) return <span className={`block text-stone-400 ${grande ? "text-sm" : "text-[11px]"}`} title="Cargá el email en “Editar pedido”">Sin email</span>;
  return (
    <span className="block">
      {avisoEn ? (
        <span className={`inline-flex items-center gap-2 ${grande ? "text-base" : "mt-1 text-[12px]"}`}>
          <span className={`inline-flex items-center rounded-md bg-verde-50 font-semibold text-verde-700 ${grande ? "h-11 px-5" : "h-7 px-3"}`}>✓ Email enviado {avisoEn}</span>
          <button type="button" onClick={deshacer} disabled={trabajando} className="text-[11px] text-stone-400 underline decoration-stone-300 hover:text-stone-700">deshacer</button>
        </span>
      ) : (
        <button type="button" disabled={trabajando} onClick={abrir} className={`inline-flex items-center rounded-md bg-verde-700 font-bold text-white hover:bg-verde-800 disabled:opacity-50 ${tamano}`}>
          {trabajando && !mail ? "Preparando…" : "✉ Preparar email"}
        </button>
      )}
      {error && <span className="mt-0.5 block text-[11px] font-semibold text-rojo-700" role="alert">{error}</span>}

      {mail && (
        <span className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Email para el cliente">
          <span className="block max-h-[90vh] w-full max-w-xl overflow-auto rounded-xl border border-stone-300 bg-white p-5 text-left normal-case tracking-normal text-stone-900">
            <span className="block text-lg font-semibold">Email para el cliente</span>
            <span className="mt-0.5 block text-sm text-stone-600">Copiá cada parte, pegala en un mail nuevo de Gmail, enviá, y después tocá “Ya lo envié”.</span>

            <span className="mt-4 block text-[11px] font-semibold uppercase tracking-wide text-stone-500">Para</span>
            <span className="mt-1 flex items-center justify-between gap-3 rounded-md border border-stone-300 bg-crema-50 px-3 py-2 text-sm"><span className="break-all">{mail.para}</span><Copiar texto={mail.para} etiqueta="Copiar" /></span>

            <span className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-stone-500">Asunto</span>
            <span className="mt-1 flex items-center justify-between gap-3 rounded-md border border-stone-300 bg-crema-50 px-3 py-2 text-sm"><span>{mail.asunto}</span><Copiar texto={mail.asunto} etiqueta="Copiar" /></span>

            <span className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-stone-500">Mensaje</span>
            <span className="mt-1 block whitespace-pre-wrap rounded-md border border-stone-300 bg-crema-50 px-3 py-2 text-sm">{mail.texto}</span>
            <span className="mt-2 flex flex-wrap items-center gap-2">
              <Copiar texto={mail.texto} etiqueta="Copiar mensaje" />
              <a href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(mail.para)}&su=${encodeURIComponent(mail.asunto)}&body=${encodeURIComponent(mail.texto)}`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-md border border-stone-400 bg-white px-3 text-[13px] font-semibold hover:bg-crema-100" title="Abre un mail nuevo en Gmail ya completo (con la cuenta de Gmail que tengas abierta en el navegador)">Abrir en Gmail ↗</a>
            </span>

            <span className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-stone-200 pt-4">
              <button type="button" onClick={() => setMail(null)} className="h-10 rounded-md border border-stone-400 bg-white px-4 text-sm font-medium hover:bg-crema-100">Cerrar</button>
              <button type="button" disabled={trabajando} onClick={yaLoEnvie} className="h-10 rounded-md bg-verde-700 px-5 text-sm font-bold text-white hover:bg-verde-800 disabled:opacity-50">{trabajando ? "Anotando…" : "✓ Ya lo envié"}</button>
            </span>
          </span>
        </span>
      )}
    </span>
  );
}
