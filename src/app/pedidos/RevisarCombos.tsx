"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { aplicarCombosWeb, revisarCombosWeb } from "./actions";

type Cambio = { itemId: string; orden: string; cliente: string; actual: number; nuevo: number; estado: string; dia: string | null };

// TEMPORAL: muestra qué combos de la tienda tienen la cantidad mal y deja aplicar la corrección tildada. Después se borra.
export function RevisarCombos() {
  const router = useRouter();
  const [cambios, setCambios] = useState<Cambio[] | null>(null);
  const [tildados, setTildados] = useState<Set<string>>(new Set());
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [trabajando, empezar] = useTransition();

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={trabajando}
        onClick={() => empezar(async () => {
          setMensaje(null);
          const r = await revisarCombosWeb();
          setMensaje(r.mensaje);
          setCambios(r.cambios);
          setTildados(new Set(r.cambios.map((c) => c.itemId)));
        })}
        className="h-9 rounded-md border border-stone-400 bg-white px-3 text-sm font-medium hover:bg-crema-100 disabled:opacity-50"
      >
        {trabajando ? "Revisando…" : "Revisar combos"}
      </button>
      {mensaje && <span className="ml-3 text-sm text-stone-700" role="status">{mensaje}</span>}
      {cambios && cambios.length > 0 && (
        <div className="max-w-xl rounded-md border border-stone-300 bg-white p-3 text-[13px]">
          <p className="mb-2 text-stone-600">Incluye pedidos pendientes, los de las hojas de ruta y los ya entregados (no los cancelados). Bajá la copia de seguridad (Empresa) antes de aplicar.</p>
          <ul className="space-y-1">
            {cambios.map((c) => (
              <li key={c.itemId}>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={tildados.has(c.itemId)} onChange={(e) => setTildados((t) => { const n = new Set(t); if (e.target.checked) n.add(c.itemId); else n.delete(c.itemId); return n; })} />
                  <span>N° {c.orden} · {c.cliente}: combos <b>{c.actual} → {c.nuevo}</b> ({c.nuevo * 2} focaccias) · <span className="text-stone-500">{c.estado === "ENTREGADO" ? "ya entregado" : c.estado === "NO_ENTREGADO" ? "no entregado" : "pendiente"}{c.dia ? ` · hoja del ${c.dia.split("-").reverse().join("/")}` : " · sin día"}</span></span>
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={trabajando || tildados.size === 0}
            onClick={() => {
              if (!window.confirm(`¿Corregir ${tildados.size} combos?`)) return;
              empezar(async () => {
                const r = await aplicarCombosWeb([...tildados]);
                setMensaje(r.mensaje);
                setCambios(null);
                router.refresh();
              });
            }}
            className="mt-3 h-9 rounded-md bg-verde-700 px-4 text-sm font-semibold text-white hover:bg-verde-800 disabled:opacity-50"
          >
            Aplicar corrección
          </button>
        </div>
      )}
    </div>
  );
}
