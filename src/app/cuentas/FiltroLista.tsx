"use client";

import { useEffect, useRef, useState } from "react";

// Desplegable con buscador, como el filtro de Excel: se abre, se va escribiendo y la lista se achica; se elige con un toque.
export function FiltroLista({ opciones, valor, onCambio, titulo, vacio = "Todos", aceptaLibre = false, clase = "" }: {
  opciones: string[];
  valor: string;
  onCambio: (v: string) => void;
  titulo: string;
  vacio?: string;
  aceptaLibre?: boolean; // Enter con un texto que no está en la lista lo usa igual (para buscar por palabras)
  clase?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node) && !boton.current?.contains(e.target as Node)) setAbierto(false);
    };
    const cerrarAlMover = () => setAbierto(false);
    document.addEventListener("mousedown", fuera);
    window.addEventListener("resize", cerrarAlMover);
    return () => { document.removeEventListener("mousedown", fuera); window.removeEventListener("resize", cerrarAlMover); };
  }, [abierto]);

  const abrir = () => {
    const r = boton.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - 268)), width: Math.max(r.width, 260) });
    setTexto("");
    setAbierto(true);
  };
  const elegir = (v: string) => { onCambio(v); setAbierto(false); };
  const palabras = texto.toLowerCase().split(/\s+/).filter(Boolean);
  const lista = opciones.filter((o) => palabras.every((w) => o.toLowerCase().includes(w)));

  return (
    <>
      <button ref={boton} type="button" aria-label={titulo} aria-expanded={abierto} onClick={() => (abierto ? setAbierto(false) : abrir())}
        className={`flex h-7 w-full min-w-0 items-center justify-between gap-1 rounded border border-stone-300 bg-white px-1.5 text-center text-[12px] text-stone-800 hover:border-stone-500 ${valor ? "font-semibold" : "text-stone-400"} ${clase}`}>
        <span className="min-w-0 flex-1 truncate">{valor || vacio}</span><span className="text-[9px] text-stone-400">▼</span>
      </button>
      {abierto && pos && (
        <div ref={caja} style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width }} className="z-50 rounded-md border border-stone-300 bg-white p-2 text-left text-[13px] font-normal normal-case tracking-normal text-stone-800 shadow-lg">
          <input autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribí para buscar…" aria-label={`Buscar en ${titulo}`}
            onKeyDown={(e) => {
              if (e.key === "Escape") setAbierto(false);
              if (e.key === "Enter") { e.preventDefault(); if (lista.length > 0 && (lista.length === 1 || !aceptaLibre)) elegir(lista[0]); else if (aceptaLibre && texto.trim()) elegir(texto.trim()); }
            }}
            className="mb-1 h-8 w-full rounded border border-stone-300 px-2 focus:border-verde-700 focus:outline-none" />
          <ul className="max-h-64 overflow-auto" role="listbox">
            <li><button type="button" onClick={() => elegir("")} className={`w-full rounded px-2 py-1 text-left hover:bg-crema-100 ${!valor ? "font-semibold" : ""}`}>{vacio}</button></li>
            {lista.slice(0, 200).map((o) => (
              <li key={o}><button type="button" onClick={() => elegir(o)} className={`w-full truncate rounded px-2 py-1 text-left hover:bg-crema-100 ${o === valor ? "bg-crema-100 font-semibold" : ""}`}>{o}</button></li>
            ))}
            {lista.length === 0 && <li className="px-2 py-1 text-stone-400">{aceptaLibre && texto.trim() ? <button type="button" onClick={() => elegir(texto.trim())} className="text-left hover:underline">Buscar “{texto.trim()}” ↵</button> : "No hay coincidencias"}</li>}
            {lista.length > 200 && <li className="px-2 py-1 text-[12px] text-stone-400">Seguí escribiendo para ver más…</li>}
          </ul>
        </div>
      )}
    </>
  );
}
