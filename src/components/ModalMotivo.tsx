"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Cuadro para escribir un motivo obligatorio (por ejemplo, por qué no se entregó un pedido).
export function ModalMotivo({ abierto, titulo, ayuda, textoBoton, enviando = false, error, onGuardar, onCancelar }: {
  abierto: boolean;
  titulo: string;
  ayuda?: string;
  textoBoton: string;
  enviando?: boolean;
  error?: string | null;
  onGuardar: (motivo: string) => void;
  onCancelar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const campo = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (abierto) {
      setTexto("");
      setTimeout(() => campo.current?.focus(), 30);
    }
  }, [abierto]);
  if (!abierto || typeof document === "undefined") return null;
  const valido = texto.trim().length >= 3;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={titulo} onMouseDown={(e) => { if (e.target === e.currentTarget) onCancelar(); }}>
      <div className="w-full max-w-md space-y-3 rounded-xl border border-stone-400 bg-white p-5 shadow-xl">
        <h3 className="text-lg font-bold">{titulo}</h3>
        {ayuda && <p className="text-sm text-stone-600">{ayuda}</p>}
        <textarea
          ref={campo}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && valido && !enviando) onGuardar(texto); if (e.key === "Escape") onCancelar(); }}
          rows={3}
          maxLength={300}
          placeholder="Ej.: Local cerrado, no quiso recibir, no tenía plata…"
          className="w-full rounded-md border border-stone-400 bg-white px-3 py-2 text-base focus:border-verde-700 focus:outline-none"
        />
        {error && <p className="text-sm text-rojo-700" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancelar} className="h-10 rounded-md border border-stone-400 bg-white px-4 text-sm font-medium">Cancelar</button>
          <button type="button" disabled={!valido || enviando} onClick={() => onGuardar(texto)} className="h-10 rounded-md bg-rojo-700 px-5 text-sm font-semibold text-white disabled:opacity-40">{enviando ? "Guardando…" : textoBoton}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
