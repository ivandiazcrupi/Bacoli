"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { estiloCampo } from "@/components/campos";

// Buscador que filtra mientras se escribe (sin apretar Enter) y dos desplegables que aplican al elegir.
export function FiltrosClientes({ q, zona, estado, zonas }: { q: string; zona: string; estado: string; zonas: { id: string; nombre: string }[] }) {
  const router = useRouter();
  const [texto, setTexto] = useState(q);
  const [pendiente, empezar] = useTransition();
  const espera = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(espera.current), []);

  function ir(cambio: { q?: string; zona?: string; estado?: string }) {
    const v = { q: texto, zona, estado, ...cambio };
    const partes = Object.entries(v).filter(([k, x]) => x && !(k === "estado" && x === "activos"));
    empezar(() => router.replace(`/clientes${partes.length ? `?${new URLSearchParams(partes)}` : ""}`));
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            clearTimeout(espera.current);
            const nuevo = e.target.value;
            espera.current = setTimeout(() => ir({ q: nuevo }), 250);
          }}
          placeholder="Buscar cliente, sucursal o barrio"
          aria-label="Buscar cliente"
          autoComplete="off"
          className={`${estiloCampo} mt-0 pr-10`}
        />
        {pendiente && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">…</span>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select value={zona} onChange={(e) => ir({ zona: e.target.value })} aria-label="Zona" className={`${estiloCampo} mt-0`}>
          <option value="">Todas las zonas</option>
          {zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
        </select>
        <select value={estado} onChange={(e) => ir({ estado: e.target.value })} aria-label="Estado" className={`${estiloCampo} mt-0`}>
          <option value="activos">Activos</option>
          <option value="inactivos">Desactivados</option>
          <option value="todos">Todos</option>
        </select>
      </div>
    </div>
  );
}
