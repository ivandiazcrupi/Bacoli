"use client";

import { useEffect, useRef, useState } from "react";
import { desbloquearDesdeAsistente, preguntarAlAsistente } from "@/app/asistente/actions";
import type { Consulta, Mensaje } from "@/lib/asistente/asistente";

// Botón flotante "Preguntar" (abajo a la izquierda) que abre un mini chat: se le pregunta cualquier cosa de los datos y responde con la IA.
type Item = Mensaje & { consultas?: Consulta[]; error?: boolean };

const SUGERENCIAS = ["¿Cuánto facturamos ayer?", "¿Cuánto vamos facturado en la tienda online este mes?", "¿Cuántos paquetes entregamos esta semana?"];

// Negrita simple (**texto**) sin armar HTML a mano.
function Texto({ t }: { t: string }) {
  return <>{t.split(/\*\*(.+?)\*\*/g).map((p, i) => (i % 2 ? <strong key={i}>{p}</strong> : <span key={i}>{p}</span>))}</>;
}

export function Asistente({ bloqueadoInicial }: { bloqueadoInicial: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [bloqueado, setBloqueado] = useState(bloqueadoInicial);
  const [pidiendoClave, setPidiendoClave] = useState(false);
  const [clave, setClave] = useState("");
  const [errorClave, setErrorClave] = useState("");
  const fin = useRef<HTMLDivElement>(null);

  useEffect(() => { fin.current?.scrollIntoView({ block: "end" }); }, [items, pensando, abierto]);

  const enviar = async (pregunta: string) => {
    const q = pregunta.trim();
    if (!q || pensando) return;
    const nuevos: Item[] = [...items, { rol: "user", texto: q }];
    setItems(nuevos);
    setTexto("");
    setPensando(true);
    try {
      const r = await preguntarAlAsistente(nuevos.filter((m) => !m.error).map(({ rol, texto }) => ({ rol, texto })));
      setItems([...nuevos, r.ok ? { rol: "assistant", texto: r.texto, consultas: r.consultas } : { rol: "assistant", texto: r.error, error: true }]);
    } catch {
      setItems([...nuevos, { rol: "assistant", texto: "No pude conectarme. Probá de nuevo.", error: true }]);
    } finally {
      setPensando(false);
    }
  };

  const desbloquear = async () => {
    setErrorClave("");
    const r = await desbloquearDesdeAsistente(clave);
    if (r.ok) { setBloqueado(false); setPidiendoClave(false); setClave(""); } else setErrorClave(r.error ?? "No se pudo.");
  };

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="fixed bottom-10 left-4 z-40 inline-flex items-center gap-1.5 rounded-full border border-verde-700 bg-verde-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-verde-800 print:hidden">
        ✦ Preguntar
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-2 right-2 z-50 flex h-[min(34rem,calc(100vh-2rem))] flex-col rounded-lg border border-stone-400 bg-white shadow-xl sm:left-4 sm:right-auto sm:w-[26rem] print:hidden" role="dialog" aria-label="Asistente">
      <div className="flex items-center justify-between border-b border-stone-300 px-3 py-2">
        <span className="text-sm font-bold text-stone-900">✦ Preguntale al sistema</span>
        <span className="flex items-center gap-2">
          {items.length > 0 && <button type="button" onClick={() => setItems([])} className="text-xs text-stone-500 hover:text-stone-900">Nueva conversación</button>}
          <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar" className="px-1 text-lg leading-none text-stone-500 hover:text-stone-900">✕</button>
        </span>
      </div>

      {bloqueado ? (
        <div className="border-b border-stone-200 bg-crema-50 px-3 py-1.5 text-xs text-stone-600">
          {pidiendoClave ? (
            <form onSubmit={(e) => { e.preventDefault(); void desbloquear(); }} className="flex items-center gap-1.5">
              <input type="password" autoFocus value={clave} onChange={(e) => setClave(e.target.value)} placeholder="Contraseña de Estadísticas" className="h-7 min-w-0 flex-1 rounded border border-stone-300 px-2 text-xs" />
              <button type="submit" className="h-7 rounded bg-stone-800 px-2 text-xs font-semibold text-white">Entrar</button>
              <button type="button" onClick={() => { setPidiendoClave(false); setErrorClave(""); }} className="text-stone-500">✕</button>
            </form>
          ) : (
            <span>🔒 Los montos en pesos están bloqueados. <button type="button" onClick={() => setPidiendoClave(true)} className="font-semibold text-verde-800 underline">Desbloquear</button></span>
          )}
          {errorClave && <p className="mt-1 text-rojo-700">{errorClave}</p>}
        </div>
      ) : null}

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3 text-[13.5px]">
        {items.length === 0 && (
          <div className="space-y-2 text-stone-600">
            <p>Preguntame lo que quieras de los pedidos, clientes y ventas. Por ejemplo:</p>
            {SUGERENCIAS.map((s) => (
              <button key={s} type="button" onClick={() => void enviar(s)} className="block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-left text-stone-800 hover:bg-crema-100">{s}</button>
            ))}
          </div>
        )}
        {items.map((m, i) => (
          <div key={i} className={m.rol === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={`max-w-[92%] whitespace-pre-wrap rounded-lg px-3 py-2 ${m.rol === "user" ? "bg-stone-800 text-white" : m.error ? "border border-rojo-200 bg-rojo-50 text-rojo-800" : "border border-stone-200 bg-crema-50 text-stone-900"}`}>
              <Texto t={m.texto} />
              {m.consultas && m.consultas.length > 0 && (
                <details className="mt-2 text-xs text-stone-500">
                  <summary className="cursor-pointer select-none">Cómo lo calculé</summary>
                  <ul className="mt-1 space-y-2">
                    {m.consultas.map((c, k) => (
                      <li key={k}>
                        <b className="text-stone-700">{c.para}</b>
                        <pre className="mt-0.5 overflow-x-auto whitespace-pre-wrap rounded bg-white p-1.5 text-[11px] text-stone-700">{c.detalle}</pre>
                        <span>→ {c.resultado.slice(0, 160)}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </div>
        ))}
        {pensando && <p className="text-stone-500">Pensando…</p>}
        <div ref={fin} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void enviar(texto); }} className="flex gap-2 border-t border-stone-300 p-2">
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribí tu pregunta…" aria-label="Pregunta" disabled={pensando} maxLength={1000} className="h-10 min-w-0 flex-1 rounded-md border border-stone-300 px-3 text-sm focus:border-verde-700 focus:outline-none" />
        <button type="submit" disabled={pensando || !texto.trim()} className="h-10 rounded-md bg-verde-700 px-4 text-sm font-semibold text-white hover:bg-verde-800 disabled:opacity-50">Enviar</button>
      </form>
    </div>
  );
}
