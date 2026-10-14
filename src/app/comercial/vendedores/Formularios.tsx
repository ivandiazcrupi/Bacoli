"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { estiloCampo } from "@/components/campos";
import { cambiarActivoVendedor, crearVendedor, guardarComisionVendedor, guardarVendedor, pasarComisionista, proponerVarios, proponerVendedor, resolverAsignacion, resolverTodas } from "./actions";

type Opc = { id: string; nombre: string };
const hoyAR = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
const boton = "h-[46px] rounded-md bg-stone-800 px-5 text-sm font-semibold text-white hover:bg-stone-700 disabled:opacity-60";
const Mensaje = ({ e }: { e: { ok?: string; error?: string } | undefined }) => (
  <>
    {e?.error && <p className="w-full text-sm font-medium text-rojo-700">{e.error}</p>}
    {e?.ok && <p className="w-full text-sm font-medium text-verde-800">{e.ok}</p>}
  </>
);

// Alta o edición de un vendedor: nombre, % de comisión y (opcional) el usuario con el que entra al sistema.
export function FormVendedor({ vendedor, usuarios }: { vendedor?: { id: string; nombre: string; pct: string; usuarioId: string }; usuarios: Opc[] }) {
  const [estado, enviar, cargando] = useActionState(vendedor ? guardarVendedor.bind(null, vendedor.id) : crearVendedor, undefined);
  return (
    <form key={vendedor ? undefined : estado?.id ?? "nuevo"} action={enviar} className="flex flex-wrap items-end gap-3">
      <label className="min-w-56 flex-1 text-xs font-semibold text-stone-600">Nombre
        <input name="nombre" required defaultValue={vendedor?.nombre} placeholder="Ej: Migue" className={`${estiloCampo} mt-1`} />
      </label>
      <label className="w-32 text-xs font-semibold text-stone-600">% comisión
        <input name="pct" inputMode="decimal" defaultValue={vendedor?.pct} placeholder="Ej: 8" className={`${estiloCampo} mt-1`} />
      </label>
      <label className="min-w-64 text-xs font-semibold text-stone-600">Usuario para entrar (opcional)
        <select name="usuarioId" defaultValue={vendedor?.usuarioId ?? ""} className={`${estiloCampo} mt-1`}>
          <option value="">No entra al sistema</option>
          {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
        </select>
      </label>
      <button disabled={cargando} className={boton}>{cargando ? "…" : vendedor ? "Guardar" : "+ Cargar vendedor"}</button>
      <Mensaje e={estado} />
    </form>
  );
}

// Proponer el vendedor de UN cliente (paso 1 del doble chequeo). En la ficha del cliente el cliente ya viene fijo.
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
      <button disabled={cargando} className={boton}>{cargando ? "…" : "Proponer cambio"}</button>
      <Mensaje e={estado} />
    </form>
  );
}

// Asignar VARIOS clientes a un vendedor: buscador + casillas.
export function FormProponerVarios({ vendedorId, clientes }: { vendedorId: string; clientes: { id: string; nombre: string; de: string | null }[] }) {
  const [estado, enviar, cargando] = useActionState(proponerVarios.bind(null, vendedorId), undefined);
  const [q, setQ] = useState("");
  const [tildados, setTildados] = useState<Set<string>>(new Set());
  const visibles = useMemo(() => { const w = q.trim().toLowerCase().split(/\s+/).filter(Boolean); return clientes.filter((c) => w.every((x) => c.nombre.toLowerCase().includes(x))); }, [clientes, q]);
  const alternar = (id: string) => setTildados((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <form action={enviar} className="space-y-3">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente…" className={estiloCampo} />
      <div className="max-h-64 overflow-y-auto rounded-md border border-stone-300">
        {visibles.slice(0, 300).map((c) => (
          <label key={c.id} className="flex cursor-pointer items-center gap-3 border-b border-stone-200 px-3 py-1.5 text-[13.5px] last:border-b-0 hover:bg-stone-50">
            <input type="checkbox" name="clienteId" value={c.id} checked={tildados.has(c.id)} onChange={() => alternar(c.id)} />
            <span className="flex-1">{c.nombre}</span>
            {c.de && <span className="text-[12px] text-stone-500">hoy: {c.de}</span>}
          </label>
        ))}
        {visibles.length === 0 && <p className="px-3 py-4 text-sm text-stone-500">No hay clientes con ese nombre.</p>}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold text-stone-600">Vale desde
          <input type="date" name="desde" defaultValue={hoyAR()} max={hoyAR()} className={`${estiloCampo} mt-1`} />
        </label>
        <button disabled={cargando || tildados.size === 0} className={boton}>{cargando ? "…" : `Proponer ${tildados.size || ""} ${tildados.size === 1 ? "cliente" : "clientes"}`}</button>
        <Mensaje e={estado} />
      </div>
    </form>
  );
}

// Paso 2: aprobar o rechazar. Aprueba solo quien tiene marcado "Aprueba vendedores" en USUARIOS; quien propuso puede retirar su propuesta.
export function BotonesResolver({ id, mio, puede, aprobador, cliente, vendedor }: { id: string; mio: boolean; puede: boolean; aprobador: string | null; cliente: string; vendedor: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const resolver = (aprobar: boolean) => {
    const texto = aprobar ? `¿Aprobás que ${cliente} pase a ${vendedor}? Sus ventas cuentan para ese vendedor desde la fecha elegida.` : mio ? `¿Retirar tu propuesta para ${cliente}?` : `¿Rechazar el cambio de ${cliente} a ${vendedor}?`;
    if (!window.confirm(texto)) return;
    empezar(async () => { const r = await resolverAsignacion(id, aprobar); setError(r?.error ?? null); });
  };
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-2">
      <button type="button" disabled={pendiente || !puede} onClick={() => resolver(true)} title={puede ? "" : aprobador ? `Lo aprueba ${aprobador}` : "Nadie tiene asignado aprobar: se elige en USUARIOS"} className="rounded-md bg-verde-700 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-verde-800 disabled:cursor-not-allowed disabled:opacity-40">Aprobar</button>
      <button type="button" disabled={pendiente || (!puede && !mio)} onClick={() => resolver(false)} className="rounded-md border border-stone-400 bg-white px-3 py-1.5 text-[13px] font-semibold hover:border-stone-700 disabled:opacity-50">{mio && !puede ? "Retirar" : "Rechazar"}</button>
      {error && <span className="w-full text-right text-xs font-medium text-rojo-700">{error}</span>}
    </span>
  );
}

// Aprobar o rechazar todos los pendientes de una vez.
export function BotonesTodas({ cantidad }: { cantidad: number }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const hacer = (aprobar: boolean) => {
    if (!window.confirm(aprobar ? `¿Aprobar los ${cantidad} cambios pendientes?` : `¿Rechazar los ${cantidad} cambios pendientes?`)) return;
    empezar(async () => { const r = await resolverTodas(aprobar); setMsg(r?.error ?? r?.ok ?? null); });
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" disabled={pendiente} onClick={() => hacer(true)} className="rounded-md bg-verde-700 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-verde-800 disabled:opacity-50">Aprobar todos</button>
      <button type="button" disabled={pendiente} onClick={() => hacer(false)} className="rounded-md border border-stone-400 bg-white px-3 py-1.5 text-[13px] font-semibold hover:border-stone-700 disabled:opacity-50">Rechazar todos</button>
      {msg && <span className="text-xs font-medium text-stone-700">{msg}</span>}
    </span>
  );
}

// % de comisión (edición rápida en la lista).
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

export function BotonActivo({ id, activo, clientes = 0, chico = false }: { id: string; activo: boolean; clientes?: number; chico?: boolean }) {
  const [pendiente, empezar] = useTransition();
  const texto = activo
    ? `¿Dar de baja a este vendedor?${clientes ? ` Tiene ${clientes} ${clientes === 1 ? "cliente" : "clientes"}: siguen asignados a él hasta que los pases a otro vendedor.` : ""} Su historial y sus comisiones quedan, y ya no se le pueden asignar clientes nuevos.`
    : "¿Volver a dar de alta a este vendedor?";
  return (
    <button type="button" disabled={pendiente} onClick={() => { if (window.confirm(texto)) empezar(() => cambiarActivoVendedor(id)); }}
      className={`rounded-md border font-semibold disabled:opacity-50 ${chico ? "px-2.5 py-1 text-[12px]" : "px-3 py-2 text-[13px]"} ${activo ? "border-rojo-600 bg-white text-rojo-700 hover:bg-rojo-50" : "border-verde-700 text-verde-800 hover:bg-verde-50"}`}>{activo ? "Dar de baja" : "Dar de alta"}</button>
  );
}

// Pasar un comisionista de las fichas (ej. Migue 8%) a la lista de vendedores.
export function FormPasar({ comisionista, clientes, pct }: { comisionista: string; clientes: number; pct: string }) {
  const [estado, enviar, cargando] = useActionState(pasarComisionista, undefined);
  return (
    <form action={enviar} className="flex flex-wrap items-center gap-3 py-2.5">
      <input type="hidden" name="comisionista" value={comisionista} />
      <span className="min-w-52 flex-1 text-[14px]"><b>{comisionista}</b> <span className="text-stone-500">· {clientes} {clientes === 1 ? "cliente" : "clientes"}{pct ? ` · ${pct}%` : ""}</span></span>
      <label className="text-xs font-semibold text-stone-600">Vale desde <input type="date" name="desde" defaultValue={hoyAR()} max={hoyAR()} className="ml-1 h-9 rounded border border-stone-400 px-2 text-sm" /></label>
      <button disabled={cargando} onClick={(e) => { if (!window.confirm(`¿Pasar a ${comisionista} a la lista de vendedores y proponer sus ${clientes} clientes? Quedan pendientes hasta que se aprueben.`)) e.preventDefault(); }} className="h-9 rounded-md bg-stone-800 px-4 text-[13px] font-semibold text-white hover:bg-stone-700 disabled:opacity-60">{cargando ? "…" : "Pasar a vendedor"}</button>
      <Mensaje e={estado} />
    </form>
  );
}
