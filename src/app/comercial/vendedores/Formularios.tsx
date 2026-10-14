"use client";

import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import { estiloCampo } from "@/components/campos";
import { cambiarActivoVendedor, eliminarVendedor, entrarVendedores, guardarClaveVendedores, guardarClientesDeVendedor, guardarVendedor, importarComisionista, salirVendedores } from "./actions";

type Opc = { id: string; nombre: string };
const hoyAR = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
const primeroDeMes = () => `${hoyAR().slice(0, 7)}-01`;
const etiqueta = "block text-xs font-medium text-stone-500";
const primario = "rounded-lg bg-stone-900 px-6 py-3 text-[15px] font-semibold text-white hover:bg-stone-700 disabled:opacity-60";
const Mensaje = ({ e }: { e: { ok?: string; error?: string } | undefined }) => (
  <>
    {e?.error && <p className="text-sm font-medium text-rojo-700">{e.error}</p>}
    {e?.ok && <p className="text-sm font-medium text-verde-800">{e.ok}</p>}
  </>
);

// ── Contraseña del apartado ──
export function FormClave({ hayClave, esDueno }: { hayClave: boolean; esDueno: boolean }) {
  const [entrar, accionEntrar, entrando] = useActionState(entrarVendedores, undefined);
  const [crear, accionCrear, creando] = useActionState(guardarClaveVendedores, undefined);
  const [olvide, setOlvide] = useState(false);
  const nueva = !hayClave || olvide;
  if (nueva && !esDueno) return <p className="text-center text-sm text-stone-600">Todavía no hay contraseña. Pedile a un dueño que la cree.</p>;
  return (
    <div className="mx-auto w-full max-w-sm space-y-4">
      {nueva ? (
        <form action={accionCrear} className="space-y-4">
          <label className={etiqueta}>{hayClave ? "Nueva contraseña" : "Elegí una contraseña para este apartado"}
            <input name="nueva" type="password" autoFocus autoComplete="new-password" className={`${estiloCampo} mt-1`} />
          </label>
          <button disabled={creando} className={`${primario} w-full`}>{creando ? "…" : "Guardar y entrar"}</button>
          <Mensaje e={crear} />
          {olvide && <button type="button" onClick={() => setOlvide(false)} className="block w-full text-center text-sm text-stone-500 hover:underline">Volver</button>}
        </form>
      ) : (
        <form action={accionEntrar} className="space-y-4">
          <label className={etiqueta}>Contraseña
            <input name="clave" type="password" autoFocus autoComplete="current-password" className={`${estiloCampo} mt-1`} />
          </label>
          <button disabled={entrando} className={`${primario} w-full`}>{entrando ? "…" : "Entrar"}</button>
          <Mensaje e={entrar} />
          {esDueno && <button type="button" onClick={() => setOlvide(true)} className="block w-full text-center text-sm text-stone-500 hover:underline">Me olvidé la contraseña</button>}
        </form>
      )}
    </div>
  );
}

export function CambiarClave() {
  const [abierto, setAbierto] = useState(false);
  const [estado, enviar, cargando] = useActionState(guardarClaveVendedores, undefined);
  if (!abierto) return <button type="button" onClick={() => setAbierto(true)} className="text-sm text-stone-500 hover:text-stone-900 hover:underline">Cambiar contraseña</button>;
  return (
    <form action={enviar} className="flex flex-wrap items-center gap-2">
      <input name="nueva" type="password" placeholder="Nueva contraseña" autoComplete="new-password" className="h-9 w-48 rounded-md border border-stone-300 px-3 text-sm" />
      <button disabled={cargando} className="h-9 rounded-md bg-stone-900 px-4 text-sm font-semibold text-white disabled:opacity-60">Guardar</button>
      <button type="button" onClick={() => setAbierto(false)} className="text-sm text-stone-500 hover:underline">Cancelar</button>
      <Mensaje e={estado} />
    </form>
  );
}

export function BotonSalir() {
  return <form action={salirVendedores}><button className="text-sm text-stone-500 hover:text-stone-900 hover:underline">Bloquear</button></form>;
}

// ── Vendedor: ficha como la de un cliente (nombre, %, usuario) ──
export function FormVendedor({ vendedor, usuarios }: { vendedor?: { id: string; nombre: string; pct: string; usuarioId: string }; usuarios: Opc[] }) {
  const [estado, enviar, cargando] = useActionState(guardarVendedor.bind(null, vendedor?.id ?? null), undefined);
  return (
    <form action={enviar} className="space-y-5">
      <div className="flex flex-wrap gap-5">
        <label className={`${etiqueta} min-w-56 flex-1`}>Nombre
          <input name="nombre" required defaultValue={vendedor?.nombre} placeholder="Ej: Migue" autoFocus={!vendedor} className={`${estiloCampo} mt-1`} />
        </label>
        <label className={`${etiqueta} w-36`}>Comisión (%)
          <input name="pct" inputMode="decimal" defaultValue={vendedor?.pct} placeholder="Ej: 8" className={`${estiloCampo} mt-1`} />
        </label>
      </div>
      <label className={`${etiqueta} sm:max-w-md`}>Usuario para entrar al sistema <span className="font-normal text-stone-400">(opcional)</span>
        <select name="usuarioId" defaultValue={vendedor?.usuarioId ?? ""} className={`${estiloCampo} mt-1`}>
          <option value="">No entra al sistema</option>
          {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-4">
        <button disabled={cargando} className={primario}>{cargando ? "…" : vendedor ? "Guardar cambios" : "Crear vendedor"}</button>
        <Mensaje e={estado} />
      </div>
    </form>
  );
}

// Dar de baja / alta y eliminar: botones de verdad, con aviso de confirmación.
export function AccionesVendedor({ id, nombre, activo, clientes }: { id: string; nombre: string; activo: boolean; clientes: number }) {
  const [pendiente, empezar] = useTransition();
  const baja = () => {
    const txt = activo
      ? `¿Dar de baja a ${nombre}?${clientes ? ` Tiene ${clientes} ${clientes === 1 ? "cliente" : "clientes"}: siguen con él hasta que los pases a otro vendedor.` : ""} Su historial y sus comisiones quedan.`
      : `¿Volver a dar de alta a ${nombre}?`;
    if (window.confirm(txt)) empezar(() => cambiarActivoVendedor(id));
  };
  const borrar = () => {
    if (window.confirm(`¿Eliminar a ${nombre}?${clientes ? ` Sus ${clientes} clientes quedan sin vendedor.` : ""} Se pierde su historial de comisiones. Si solo querés que deje de aparecer, mejor dalo de baja.`)) empezar(() => eliminarVendedor(id));
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" disabled={pendiente} onClick={baja} className="rounded-lg border border-stone-300 bg-white px-5 py-2.5 text-sm font-semibold hover:border-stone-600 disabled:opacity-50">{activo ? "Dar de baja" : "Dar de alta"}</button>
      <button type="button" disabled={pendiente} onClick={borrar} className="rounded-lg border border-rojo-600 bg-white px-5 py-2.5 text-sm font-semibold text-rojo-700 hover:bg-rojo-50 disabled:opacity-50">Eliminar</button>
    </div>
  );
}

// ── Asignar clientes: un solo botón. Se abre una lista: tildado = es de este vendedor. ──
export function AsignarClientes({ vendedorId, nombre, activo, clientes, propios }: { vendedorId: string; nombre: string; activo: boolean; clientes: { id: string; nombre: string; de: string | null }[]; propios: string[] }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [estado, enviar, cargando] = useActionState(guardarClientesDeVendedor.bind(null, vendedorId), undefined);
  const [q, setQ] = useState("");
  const [tildados, setTildados] = useState<Set<string>>(new Set(propios));
  const visibles = useMemo(() => { const w = q.trim().toLowerCase().split(/\s+/).filter(Boolean); return clientes.filter((c) => w.every((x) => c.nombre.toLowerCase().includes(x))); }, [clientes, q]);
  const alternar = (id: string) => setTildados((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <>
      <button type="button" disabled={!activo} onClick={() => dialogo.current?.showModal()} className={`${primario} px-8`}>Asignar clientes</button>
      <dialog ref={dialogo} className="m-auto w-[min(34rem,92vw)] rounded-2xl border border-stone-300 bg-white p-0 shadow-xl backdrop:bg-stone-900/40">
        <form action={enviar} className="flex max-h-[85vh] flex-col">
          <div className="space-y-3 border-b border-stone-200 p-6">
            <h2 className="text-lg font-semibold">Clientes de {nombre}</h2>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente…" className={estiloCampo} />
            <p className="text-sm text-stone-500">{tildados.size} {tildados.size === 1 ? "cliente tildado" : "clientes tildados"}. Los que destildás quedan sin vendedor.</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
            {visibles.slice(0, 400).map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-[15px] hover:bg-stone-50">
                <input type="checkbox" name="clienteId" value={c.id} checked={tildados.has(c.id)} onChange={() => alternar(c.id)} className="h-4 w-4" />
                <span className="flex-1">{c.nombre}</span>
                {c.de && <span className="text-xs text-stone-400">de {c.de}</span>}
              </label>
            ))}
            {visibles.length === 0 && <p className="px-3 py-6 text-center text-sm text-stone-500">No hay clientes con ese nombre.</p>}
          </div>
          <div className="space-y-3 border-t border-stone-200 p-6">
            <label className="flex items-center gap-3 text-sm text-stone-600">Cuenta desde
              <input type="date" name="desde" defaultValue={primeroDeMes()} max={hoyAR()} className="h-9 rounded-md border border-stone-300 px-2 text-sm" />
            </label>
            <div className="flex flex-wrap items-center gap-4">
              <button disabled={cargando} className={primario}>{cargando ? "…" : "Guardar"}</button>
              <button type="button" onClick={() => dialogo.current?.close()} className="text-sm text-stone-500 hover:underline">Cerrar</button>
              <Mensaje e={estado} />
            </div>
          </div>
        </form>
      </dialog>
    </>
  );
}

// ── Comisionista escrito en las fichas (ej. Migue): un botón y queda como vendedor ──
export function BotonImportar({ comisionista, clientes, pct }: { comisionista: string; clientes: number; pct: string }) {
  const [pendiente, empezar] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-5 py-4">
      <p className="text-[15px] text-stone-700"><b>{comisionista}</b> figura como comisionista en {clientes} {clientes === 1 ? "ficha" : "fichas"}{pct ? ` (${pct}%)` : ""}.</p>
      <button type="button" disabled={pendiente} onClick={() => { if (window.confirm(`¿Pasar a ${comisionista} a la lista de vendedores con sus ${clientes} clientes?`)) empezar(async () => { const r = await importarComisionista(comisionista); setMsg(r?.error ?? r?.ok ?? null); }); }}
        className="rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-stone-700 disabled:opacity-60">{pendiente ? "…" : "Pasar a vendedor"}</button>
      {msg && <span className="w-full text-sm text-stone-600">{msg}</span>}
    </div>
  );
}
