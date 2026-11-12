"use client";

import { useEffect, useRef, useState } from "react";

/** Separador de las opciones elegidas cuando el filtro es de varias (se guardan juntas en un solo texto). */
export const SEP = "\u001f";

// Desplegable con buscador, como el filtro de Excel: se abre, se va escribiendo y la lista se achica; se elige con un toque.
export function FiltroLista({ opciones, valor, onCambio, titulo, vacio = "Todos", aceptaLibre = false, clase = "", varios = false }: {
  opciones: string[];
  valor: string;
  onCambio: (v: string) => void;
  titulo: string;
  vacio?: string;
  aceptaLibre?: boolean; // Enter con un texto que no está en la lista lo usa igual (para buscar por palabras)
  clase?: string;
  varios?: boolean; // se pueden tildar varias opciones (el valor queda como "a␟b␟c")
}) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const caja = useRef<HTMLDivElement>(null);
  const [borrador, setBorrador] = useState<string[]>([]);

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
    setBorrador(valor.split(SEP).filter(Boolean));
    setAbierto(true);
  };
  const elegir = (v: string) => { onCambio(v); setAbierto(false); };
  const elegidas = varios ? valor.split(SEP).filter(Boolean) : [];
  // En "varios" se trabaja sobre un borrador: recién al tocar Aceptar se aplica; Cancelar lo descarta.
  const alternar = (o: string) => setBorrador((b) => (b.includes(o) ? b.filter((x) => x !== o) : [...b, o]));
  const aceptar = () => { onCambio(borrador.join(SEP)); setAbierto(false); };
  const resumen = varios ? (elegidas.length === 0 ? "" : elegidas.length === 1 ? elegidas[0] : `${elegidas.length} elegidos`) : valor;
  const palabras = texto.toLowerCase().split(/\s+/).filter(Boolean);
  const lista = opciones.filter((o) => palabras.every((w) => o.toLowerCase().includes(w)));
  // "Seleccionar todo" tilda todo lo que aparece con la búsqueda actual; las ya tildadas con otra búsqueda se conservan.
  const tildarTodo = () => setBorrador((b) => [...new Set([...b, ...lista])]);

  return (
    <>
      <button ref={boton} type="button" aria-label={titulo} aria-expanded={abierto} onClick={() => (abierto ? setAbierto(false) : abrir())}
        className={`flex h-7 w-full min-w-0 items-center justify-between gap-1 rounded border border-stone-300 bg-white px-1.5 text-center text-[12px] text-stone-800 hover:border-stone-500 ${resumen ? "font-semibold" : "text-stone-400"} ${clase}`}>
        <span className="min-w-0 flex-1 truncate" title={varios && elegidas.length > 1 ? elegidas.join(" · ") : undefined}>{resumen || vacio}</span><span className="text-[9px] text-stone-400">▼</span>
      </button>
      {abierto && pos && (
        <div ref={caja} style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width }} className="z-50 rounded-md border border-stone-300 bg-white p-3 text-left text-[13px] font-normal normal-case tracking-normal text-stone-800 shadow-lg">
          {varios && (
            <div className="mb-2 flex items-center justify-between text-[12px]">
              <span><button type="button" onClick={tildarTodo} className="font-semibold text-verde-700 hover:underline">Seleccionar todo {lista.length}</button> <span className="text-stone-400">·</span> <button type="button" onClick={() => setBorrador([])} className="font-semibold text-verde-700 hover:underline">Borrar</button></span>
              <span className="text-stone-500">Mostrando {lista.length}</span>
            </div>
          )}
          <div className="relative mb-2">
            <input autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar" aria-label={`Buscar en ${titulo}`}
              onKeyDown={(e) => {
                if (e.key === "Escape") setAbierto(false);
                if (e.key === "Enter") { e.preventDefault(); if (varios) aceptar(); else if (lista.length > 0 && (lista.length === 1 || !aceptaLibre)) elegir(lista[0]); else if (aceptaLibre && texto.trim()) elegir(texto.trim()); }
              }}
              className="h-8 w-full rounded border border-stone-300 pl-2 pr-8 focus:border-verde-700 focus:outline-none" />
            <svg aria-hidden viewBox="0 0 20 20" className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="8.5" cy="8.5" r="5.5" /><path d="M13 13l4 4" /></svg>
          </div>
          <ul className="max-h-64 overflow-auto" role="listbox">
            {!varios && <li><button type="button" onClick={() => elegir("")} className={`w-full rounded px-2 py-1 text-left hover:bg-crema-100 ${!valor ? "font-semibold" : ""}`}>{vacio}</button></li>}
            {lista.slice(0, 200).map((o) => varios ? (
              <li key={o}><label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-crema-100"><input type="checkbox" checked={borrador.includes(o)} onChange={() => alternar(o)} className="h-4 w-4 accent-[#026433]" /><span className="min-w-0 truncate">{o}</span></label></li>
            ) : (
              <li key={o}><button type="button" onClick={() => elegir(o)} className={`w-full truncate rounded px-2 py-1 text-left hover:bg-crema-100 ${o === valor ? "bg-crema-100 font-semibold" : ""}`}>{o}</button></li>
            ))}
            {lista.length === 0 && <li className="px-2 py-1 text-stone-400">{aceptaLibre && texto.trim() ? <button type="button" onClick={() => elegir(texto.trim())} className="text-left hover:underline">Buscar “{texto.trim()}” ↵</button> : "No hay coincidencias"}</li>}
            {lista.length > 200 && <li className="px-2 py-1 text-[12px] text-stone-400">Seguí escribiendo para ver más…</li>}
          </ul>
          {varios && (
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setAbierto(false)} className="h-8 rounded-md border border-verde-700 bg-white px-4 text-[13px] font-semibold text-verde-700 hover:bg-verde-50">Cancelar</button>
              <button type="button" onClick={aceptar} className="h-8 rounded-md bg-verde-700 px-4 text-[13px] font-semibold text-white hover:bg-verde-800">Aceptar</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
