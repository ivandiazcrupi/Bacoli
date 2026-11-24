"use client";

import { useState } from "react";

// Filtro chico arriba de las sucursales de la ficha: escribís parte del barrio o la dirección y se esconden las demás (solo en pantalla, no cambia nada).
export function FiltroSucursales({ contenedor }: { contenedor: string }) {
  const [q, setQ] = useState("");
  const aplicar = (texto: string) => {
    setQ(texto);
    const palabras = texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/\s+/).filter(Boolean);
    document.querySelectorAll<HTMLElement>(`#${contenedor} [data-sucursal]`).forEach((el) => {
      const t = (el.dataset.sucursal ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      el.style.display = palabras.every((w) => t.includes(w)) ? "" : "none";
    });
  };
  return (
    <div className="mx-auto flex max-w-md items-center gap-2">
      <input value={q} onChange={(e) => aplicar(e.target.value)} placeholder="Filtrar sucursales por barrio o dirección…" aria-label="Filtrar sucursales" className="h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm focus:border-verde-700 focus:outline-none" />
      {q && <button type="button" onClick={() => aplicar("")} className="text-sm font-semibold text-stone-500 hover:text-stone-900">Quitar ✕</button>}
    </div>
  );
}
