"use client";

import { useState } from "react";

/** El email del comprador, bien visible, con el botón de las dos hojas para copiarlo. */
export function CopiarEmail({ email }: { email: string | null }) {
  const [copiado, setCopiado] = useState(false);
  if (!email) return <p className="mt-1.5 text-[13.5px] text-stone-400">Email: sin cargar (se puede cargar en “Editar pedido”)</p>;
  const copiar = async () => {
    try { await navigator.clipboard.writeText(email); } catch {
      const t = document.createElement("textarea");
      t.value = email; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove();
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };
  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[15px]">
      <span className="text-[12px] font-medium uppercase tracking-wide text-stone-500">Email</span>
      <a href={`mailto:${email}`} className="font-semibold text-stone-900 hover:underline">{email}</a>
      <button type="button" onClick={copiar} title="Copiar el email" aria-label="Copiar el email" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-stone-400 bg-white px-2 text-stone-700 hover:bg-crema-100">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg>
        {copiado && <span className="text-[12px] font-semibold text-verde-700">Copiado</span>}
      </button>
    </p>
  );
}
