"use client";

import { useActionState, useState, useTransition } from "react";
import { estiloCampo } from "@/components/campos";
import { guardarComisionVendedor, proponerVendedor, resolverAsignacion } from "./actions";

type Opc = { id: string; nombre: string };
const hoyAR = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());

// Proponer el vendedor de un cliente (paso 1 del doble chequeo). En la ficha del cliente el cliente ya viene fijo.
export function FormProponer({ vendedores, clientes, clienteId, actual }: { vendedores: Opc[]; clientes?: Opc[]; clienteId?: string; actual?: string }) {
  const [estado, enviar, cargando] = useActionState(proponerVendedor, undefined);
  return (
    <form action={enviar} className="flex flex-wrap items-end gap-3">
      {clienteId ? <input type="hidden" name="clienteId" value={clienteId} /> : (
        <label className="min-w-64 flex-1 text-xs font-semibold text-stone-600">Cliente
          <select name="clienteId" required defaultValue="" className={`${estiloCampo} mt-1`}>
            <option value="" disabled hidden>Elegí el cliente</option>
            {clientes?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
      )}
      <label className="min-w-52 text-xs font-semibold text-stone-600">Vendedor
        <select name="vendedorId" defaultValue={actual ?? ""} className={`${estiloCampo} mt-1`}>
          <option value="">Sin vendedor</option>
          {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
        </select>
      </label>
      <label className="text-xs font-semibold text-stone-600">Vale desde
        <input type="date" name="desde" defaultValue={hoyAR()} max={hoyAR()} className={`${estiloCampo} mt-1`} />
      </label>
      <button disabled={cargando} className="h-[46px] rounded-md bg-stone-800 px-5 text-sm font-semibold text-white hover:bg-stone-700 disabled:opacity-60">{cargando ? "…" : "Proponer cambio"}</button>
      {estado?.error && <p className="w-full text-sm font-medium text-rojo-700">{estado.error}</p>}
      {estado?.ok && <p className="w-full text-sm font-medium text-verde-800">{estado.ok}</p>}
    </form>
  );
}

// Paso 2: aprobar o rechazar. Quien propuso no puede aprobar (lo tiene que hacer otro dueño), pero sí retirar su propuesta.
export function BotonesResolver({ id, mio, cliente, vendedor }: { id: string; mio: boolean; cliente: string; vendedor: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const resolver = (aprobar: boolean) => {
    const texto = aprobar ? `¿Aprobás que ${cliente} pase a ${vendedor}? Desde hoy sus ventas cuentan para ese vendedor.` : mio ? `¿Retirar tu propuesta para ${cliente}?` : `¿Rechazar el cambio de ${cliente} a ${vendedor}?`;
    if (!window.confirm(texto)) return;
    empezar(async () => { const r = await resolverAsignacion(id, aprobar); setError(r?.error ?? null); });
  };
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-2">
      <button type="button" disabled={pendiente || mio} onClick={() => resolver(true)} title={mio ? "Lo propusiste vos: lo tiene que aprobar otro dueño" : ""} className="rounded-md bg-verde-700 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-verde-800 disabled:cursor-not-allowed disabled:opacity-40">Aprobar</button>
      <button type="button" disabled={pendiente} onClick={() => resolver(false)} className="rounded-md border border-stone-400 bg-white px-3 py-1.5 text-[13px] font-semibold hover:border-stone-700 disabled:opacity-50">{mio ? "Retirar" : "Rechazar"}</button>
      {error && <span className="w-full text-right text-xs font-medium text-rojo-700">{error}</span>}
    </span>
  );
}

// % de comisión de un vendedor.
export function FormComision({ vendedorId, pct }: { vendedorId: string; pct: string }) {
  const [estado, enviar, cargando] = useActionState(guardarComisionVendedor.bind(null, vendedorId), undefined);
  return (
    <form action={enviar} className="inline-flex items-center gap-1.5">
      <input name="pct" inputMode="decimal" defaultValue={pct} placeholder="0" aria-label="% de comisión" className="h-8 w-16 rounded border border-stone-400 bg-white px-2 text-center text-[13px] focus:border-verde-700 focus:outline-none" />
      <span className="text-stone-500">%</span>
      <button disabled={cargando} className="h-8 rounded border border-stone-300 bg-white px-2 text-[12px] font-semibold hover:border-stone-600 disabled:opacity-50">{cargando ? "…" : "Guardar"}</button>
      {estado?.error && <span className="text-xs text-rojo-700">{estado.error}</span>}
      {estado?.ok && <span className="text-xs text-verde-800">✓</span>}
    </form>
  );
}
