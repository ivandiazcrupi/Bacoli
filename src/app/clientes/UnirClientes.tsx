"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { buscarClientes, unirClientes } from "./actions";

// Cliente duplicado: se busca el cliente que queda y se une todo en él (sucursales, pedidos, cuenta corriente). Solo dueños; pide la copia reciente.
export function UnirClientes({ id, nombre, resumen }: { id: string; nombre: string; resumen: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const [lista, setLista] = useState<Awaited<ReturnType<typeof buscarClientes>>>([]);
  const [error, setError] = useState("");
  const [enviando, empezar] = useTransition();

  useEffect(() => {
    if (!q.trim()) { setLista([]); return; }
    const espera = setTimeout(async () => setLista(await buscarClientes(q, id)), 250);
    return () => clearTimeout(espera);
  }, [q, id]);

  const unir = (c: (typeof lista)[number]) => {
    if (!window.confirm(`¿Unir ${nombre} con ${c.nombre}?\n\nTodo lo de ${nombre} (${resumen}) pasa a ${c.nombre} y ${nombre} se elimina.\nNo se puede deshacer (solo con la copia de seguridad).`)) return;
    setError("");
    empezar(async () => {
      const r = await unirClientes(id, c.id);
      if (!r.ok) setError(r.error ?? "No se pudo unir.");
      else { window.alert(r.mensaje); router.push(`/clientes/${c.id}`); }
    });
  };

  if (!abierto) return <button type="button" onClick={() => setAbierto(true)} className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 hover:bg-crema-100">Unir con otro cliente</button>;
  return (
    <div className="w-full max-w-xl space-y-2 rounded-xl border border-stone-300 bg-white p-4 text-left shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">¿Con qué cliente se une {nombre}? <span className="font-normal text-stone-500">(el que queda)</span></p>
        <button type="button" onClick={() => { setAbierto(false); setQ(""); setError(""); }} className="rounded-md border border-stone-400 bg-white px-3 py-1 text-sm hover:bg-crema-100">Cancelar</button>
      </div>
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Escribí el nombre, la razón social o el CUIT" className="h-11 w-full rounded-md border border-stone-400 bg-white px-3 text-base focus:border-verde-700 focus:outline-none" />
      {error && <p className="text-sm font-medium text-rojo-700" role="alert">{error}</p>}
      {lista.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-stone-300">
          {lista.map((c) => (
            <button key={c.id} type="button" disabled={enviando} onClick={() => unir(c)} className="flex w-full items-center justify-between gap-3 border-t border-stone-300 px-4 py-2 text-left text-sm first:border-t-0 hover:bg-crema-100 disabled:opacity-60">
              <span className="font-semibold">{c.nombre}</span>
              <span className="text-stone-500">{[c.razonSocial, c.cuit && `CUIT ${c.cuit}`, `${c.sucursales} sucursal${c.sucursales === 1 ? "" : "es"}`].filter(Boolean).join(" · ")}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
