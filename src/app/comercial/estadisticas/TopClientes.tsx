"use client";

import { useState } from "react";
import { BarrasH, SinDatos } from "./Graficos";

type Fila = { nombre: string; paquetes: number; neto: number; pedidos: number };
const pesos = (n: number) => n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const PRIMEROS = 15;
const paq = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 1 });

// Ranking de clientes (cada cliente junto, sumando todas sus sucursales) que se puede mirar por paquetes, facturación o cantidad de pedidos.
export function TopClientes({ filas }: { filas: Fila[] }) {
  const [medida, setMedida] = useState<"paquetes" | "neto" | "pedidos">("paquetes");
  const [todos, setTodos] = useState(false); // por defecto los 15 primeros; "Ver todos" despliega el resto
  const completo = [...filas].sort((a, b) => b[medida] - a[medida]).filter((f) => f[medida] > 0);
  const ord = todos ? completo : completo.slice(0, PRIMEROS);
  const total = filas.reduce((t, f) => t + f[medida], 0);
  const top = ord.reduce((t, f) => t + f[medida], 0);
  const fmt = medida === "neto" ? pesos : medida === "paquetes" ? paq : (n: number) => String(n);
  return (
    <div>
      <div role="group" aria-label="Medir por" className="mb-3 inline-flex overflow-hidden rounded-md border border-stone-300 text-[13px]">
        {([["paquetes", "Paquetes"], ["neto", "Facturación"], ["pedidos", "Pedidos"]] as const).map(([k, t]) => (
          <button key={k} type="button" aria-pressed={medida === k} onClick={() => setMedida(k)} className={`h-8 px-4 ${medida === k ? "bg-stone-800 font-semibold text-white" : "bg-white text-stone-600 hover:bg-crema-100"}`}>{t}</button>
        ))}
      </div>
      {ord.length === 0 ? <SinDatos /> : (
        <>
          <BarrasH filas={ord.map((f) => ({ nombre: f.nombre, valor: f[medida], extra: `${f.pedidos} ${f.pedidos === 1 ? "pedido" : "pedidos"}` }))} formato={fmt} color={medida === "neto" ? "#3b6ea5" : "#026433"} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12px] text-stone-500">{todos ? `Los ${completo.length} clientes` : `Los ${ord.length} primeros`} suman el <b className="text-stone-800">{total > 0 ? Math.round((top / total) * 100) : 0}%</b> del total del mes.</p>
            {completo.length > PRIMEROS && (
              <button type="button" aria-expanded={todos} onClick={() => setTodos(!todos)} className="h-8 rounded-md border border-stone-300 bg-white px-4 text-[13px] font-semibold text-stone-700 hover:border-stone-700 hover:bg-stone-800 hover:text-white">
                {todos ? `Mostrar solo los ${PRIMEROS} primeros ▴` : `Ver los ${completo.length} clientes ▾`}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
