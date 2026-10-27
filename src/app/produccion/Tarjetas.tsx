"use client";

import { useRef, useState, useTransition } from "react";
import { borrarCarga, cargarProduccion, empezarTanda } from "./actions";

type Fila = { id: string; producto: string; cantidad: number; desperdicio: number; inicio: string | null; fin: string | null; quien: string; puedeBorrar: boolean };

const hora = (iso: string) => new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));

export function Tarjetas({ productos, tandas }: { productos: { id: string; nombre: string }[]; tandas: Fila[] }) {
  const [pendiente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<{ producto: string; texto: string; error: boolean } | null>(null);
  const nombre = (id: string) => productos.find((p) => p.id === id)?.nombre ?? id;

  function enviar(producto: string, form: HTMLFormElement) {
    const datos = new FormData(form);
    iniciar(async () => {
      const r = await cargarProduccion(producto, datos);
      if (r.error) setAviso({ producto, texto: r.error, error: true });
      else { setAviso({ producto, texto: "Cargado ✓", error: false }); form.reset(); }
    });
  }

  return (
    <div className="space-y-3">
      {productos.map((p) => {
        const mias = tandas.filter((t) => t.producto === p.id);
        const abierta = mias.find((t) => !t.fin);
        const total = mias.filter((t) => t.fin).reduce((s, t) => s + t.cantidad, 0);
        const desp = mias.filter((t) => t.fin).reduce((s, t) => s + t.desperdicio, 0);
        return (
          <form key={p.id} onSubmit={(e) => { e.preventDefault(); enviar(p.id, e.currentTarget); }} className="rounded-lg border border-stone-300 bg-white p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-base font-bold">{p.nombre}</h2>
              <span className="text-sm text-stone-600">Hoy: <b className="text-stone-900">{total}</b> un.{desp > 0 && <> · desperdicio <b className="text-rojo-700">{desp}</b></>}</span>
            </div>
            {abierta && <p className="mt-1 text-sm font-medium text-verde-700">▶ Tanda empezada a las {hora(abierta.inicio!)}</p>}
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-stone-600">Producido
                <input name="cantidad" inputMode="numeric" pattern="[0-9]*" placeholder="0" className="mt-1 h-14 w-full rounded-lg border border-stone-400 bg-white px-3 text-center text-2xl font-bold" />
              </label>
              <label className="text-xs font-semibold text-stone-600">Desperdicio
                <input name="desperdicio" inputMode="numeric" pattern="[0-9]*" placeholder="0" className="mt-1 h-14 w-full rounded-lg border border-stone-400 bg-white px-3 text-center text-2xl font-bold" />
              </label>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {abierta ? <span className="flex h-14 items-center justify-center rounded-lg bg-stone-100 text-sm text-stone-500">Ya empezada</span> : (
                <button type="button" disabled={pendiente} onClick={() => iniciar(async () => { const r = await empezarTanda(p.id); if (r.error) setAviso({ producto: p.id, texto: r.error, error: true }); else setAviso(null); })} className="h-14 rounded-lg border border-stone-400 bg-white text-base font-bold uppercase tracking-wide hover:bg-stone-50 disabled:opacity-60">▶ Empecé</button>
              )}
              <button disabled={pendiente} className="h-14 rounded-lg bg-verde-700 text-base font-bold uppercase tracking-wide text-white hover:bg-verde-800 disabled:opacity-60">✓ Cargar</button>
            </div>
            {aviso?.producto === p.id && <p className={`mt-2 text-sm font-medium ${aviso.error ? "text-rojo-700" : "text-verde-700"}`}>{aviso.texto}</p>}
          </form>
        );
      })}

      <section className="rounded-lg border border-stone-300 bg-white">
        <h2 className="border-b border-stone-300 bg-stone-50 px-4 py-2 text-sm font-bold uppercase tracking-wide text-stone-600">Cargas de hoy</h2>
        {tandas.length === 0 ? <p className="p-4 text-sm text-stone-500">Todavía no se cargó nada hoy.</p> : (
          <ul className="divide-y divide-stone-200">
            {[...tandas].reverse().map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <p className="font-semibold">{nombre(t.producto)}</p>
                  <p className="text-stone-600">
                    {t.fin ? <>{hora(t.fin)} · <b className="text-stone-900">{t.cantidad}</b> un.{t.desperdicio > 0 && <> · desperdicio <b className="text-rojo-700">{t.desperdicio}</b></>}</> : <>Empezada {hora(t.inicio!)} · sin cargar</>}
                    {" · "}{t.quien}
                  </p>
                </div>
                {t.puedeBorrar && (
                  <button type="button" aria-label="Borrar esta carga" disabled={pendiente} onClick={() => { if (window.confirm("¿Borrar esta carga?")) iniciar(async () => { await borrarCarga(t.id); }); }} className="h-10 w-10 shrink-0 rounded-lg border border-stone-300 text-lg text-rojo-700">✕</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
