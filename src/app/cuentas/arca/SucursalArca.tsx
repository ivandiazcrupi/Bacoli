"use client";

import { useState, useTransition } from "react";
import { guardarDatosArca } from "./actions";

type Punto = { id: string; barrio: string; direccion: string };

// Sucursal y aclaración de una factura de ARCA (se guarda sola al elegir o al salir del campo).
export function SucursalArca({ id, puntos, puntoId, observacion }: { id: string; puntos: Punto[]; puntoId: string | null; observacion: string | null }) {
  const [punto, setPunto] = useState(puntoId ?? "");
  const [obs, setObs] = useState(observacion ?? "");
  const [guardado, setGuardado] = useState(false);
  const [, empezar] = useTransition();
  const guardar = (p: string, o: string) => empezar(async () => { await guardarDatosArca(id, p, o); setGuardado(true); setTimeout(() => setGuardado(false), 1500); });
  return (
    <div className="flex flex-col gap-1">
      {puntos.length > 0 && (
        <select value={punto} onChange={(e) => { setPunto(e.target.value); guardar(e.target.value, obs); }} aria-label="Sucursal" className="h-8 rounded-md border border-stone-400 bg-white px-1 text-[12px]">
          <option value="">Sucursal…</option>
          {puntos.map((p) => <option key={p.id} value={p.id}>{p.barrio} · {p.direccion}</option>)}
        </select>
      )}
      <input value={obs} onChange={(e) => setObs(e.target.value)} onBlur={() => obs.trim() !== (observacion ?? "") && guardar(punto, obs)} placeholder="Observación (barrio, aclaración)" aria-label="Observación" maxLength={150} className="h-8 rounded-md border border-stone-400 bg-white px-2 text-[12px]" />
      {guardado && <span className="text-[11px] font-semibold text-verde-700">Guardado ✓</span>}
    </div>
  );
}
