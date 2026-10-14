"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { IVA_ENVIO } from "@/lib/cuenta";
import { formatoPesos, leerMonto } from "@/lib/numeros";
import { buscarDestinos, crearPedido, datosNuevoPedido, type DatosPedido, type Destino } from "../pedidos/actions";

// Cargar un pedido desde el CELULAR (lo usa Diego todo el día): pasos grandes, botones para el dedo y el total siempre a la vista.
// 1) elegir el cliente (aparecen sus clientes sin escribir nada; se puede buscar) · 2) cantidades y precios · 3) Guardar.
const input = "h-12 w-full rounded-lg border border-stone-400 bg-white px-3 text-base text-stone-900 focus:border-verde-700 focus:outline-none focus:ring-2 focus:ring-verde-700/25";
const paso = "h-14 w-14 shrink-0 rounded-xl border border-stone-400 bg-white text-3xl font-medium leading-none text-stone-800 active:bg-stone-100";

export function PedidoMovil({ inicial }: { inicial: DatosPedido | null }) {
  const [destino, setDestino] = useState<DatosPedido | null>(inicial);
  const [hecho, setHecho] = useState<string | null>(null);
  const [vuelta, setVuelta] = useState(0);
  if (hecho) {
    return (
      <div className="space-y-4 rounded-2xl border border-verde-700 bg-verde-50 p-6 text-center">
        <p className="text-4xl text-verde-700" aria-hidden>✓</p>
        <p className="text-lg font-semibold text-verde-800">{hecho}</p>
        <div className="grid gap-3">
          <button type="button" onClick={() => { setHecho(null); setDestino(null); setVuelta((v) => v + 1); }} className="h-14 rounded-xl bg-verde-700 text-base font-bold uppercase tracking-wide text-white active:bg-verde-800">Cargar otro pedido</button>
          <Link href="/vendedor/pedidos" className="flex h-14 items-center justify-center rounded-xl border border-stone-400 bg-white text-base font-semibold text-stone-800">Ver mis pedidos</Link>
        </div>
      </div>
    );
  }
  return destino
    ? <Formulario key={`${destino.puntoId}-${vuelta}`} destino={destino} cambiar={() => setDestino(null)} listo={setHecho} />
    : <ElegirCliente key={vuelta} elegido={setDestino} />;
}

// ── Paso 1: elegir el cliente ──
function ElegirCliente({ elegido }: { elegido: (d: DatosPedido) => void }) {
  const [q, setQ] = useState("");
  const [lista, setLista] = useState<Destino[] | null>(null);
  const [abriendo, setAbriendo] = useState<string | null>(null);
  useEffect(() => {
    const espera = setTimeout(async () => setLista(await buscarDestinos(q)), q ? 250 : 0);
    return () => clearTimeout(espera);
  }, [q]);
  const abrir = async (d: Destino) => {
    setAbriendo(d.puntoId);
    const datos = await datosNuevoPedido(d.puntoId);
    setAbriendo(null);
    if (datos) elegido(datos);
  };
  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-stone-700">¿Para qué cliente es el pedido?
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o barrio" autoComplete="off" className={`${input} mt-1`} />
      </label>
      {lista === null && <p className="py-6 text-center text-sm text-stone-500">Cargando tus clientes…</p>}
      {lista !== null && lista.length === 0 && (
        <div className="space-y-3 rounded-xl border border-dashed border-stone-300 bg-white p-5 text-center">
          <p className="text-[15px] text-stone-700">{q.trim() ? <>No encontré ningún cliente tuyo con “<b>{q.trim()}</b>”.</> : "Todavía no tenés clientes cargados."}</p>
          <Link href="/vendedor/clientes/nuevo" className="flex h-12 items-center justify-center rounded-xl bg-verde-700 text-sm font-bold uppercase tracking-wide text-white">+ Cargar cliente nuevo</Link>
        </div>
      )}
      {lista !== null && lista.length > 0 && (
        <ul className="space-y-2">
          {lista.map((d) => (
            <li key={d.puntoId}>
              <button type="button" onClick={() => abrir(d)} disabled={abriendo !== null} className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-left active:bg-stone-100 disabled:opacity-60">
                <span className="block text-[16px] font-semibold text-stone-900">{d.cliente}</span>
                <span className="block text-[14px] text-stone-600">{d.barrio} · {[d.alias, d.direccion].filter(Boolean).join(" · ")}</span>
                {abriendo === d.puntoId && <span className="text-xs text-stone-500">Abriendo…</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {lista !== null && lista.length > 0 && (
        <Link href="/vendedor/clientes/nuevo" className="flex h-12 items-center justify-center rounded-xl border border-stone-400 bg-white text-sm font-bold uppercase tracking-wide text-stone-700">+ Cargar cliente nuevo</Link>
      )}
    </div>
  );
}

// ── Paso 2: productos ──
function Formulario({ destino, cambiar, listo }: { destino: DatosPedido; cambiar: () => void; listo: (texto: string) => void }) {
  const [estado, enviar, cargando] = useActionState(crearPedido, undefined);
  const [q, setQ] = useState<Record<string, number>>({});
  const [precios, setPrecios] = useState<Record<string, string>>({});
  const [ivas, setIvas] = useState<Record<string, string>>({});
  const [conFactura, setConFactura] = useState(destino.facturado);
  const [otro, setOtro] = useState({ nombre: "", cantidad: "1", precio: "", unidad: "paquete", iva: "0" });
  const [masAbierto, setMasAbierto] = useState(false);
  const [envio, setEnvio] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (estado?.ok) listo(estado.ok); }, [estado, listo]);
  const cant = (id: string) => q[id] ?? 0;
  const mover = (id: string, d: number) => setQ((x) => ({ ...x, [id]: Math.max(0, (x[id] ?? 0) + d) }));
  const importe = (id: string) => cant(id) * (leerMonto(precios[id] ?? "") ?? 0);
  const otroQ = Number(otro.cantidad.replace(/\D/g, "") || 0);
  const otroImp = otro.nombre.trim() ? otroQ * (leerMonto(otro.precio) ?? 0) : 0;
  const montoEnvio = Math.max(0, leerMonto(envio) ?? 0);

  const { neto, iva } = useMemo(() => {
    let neto = 0, iva = 0;
    for (const p of destino.productos) { const i = importe(p.id); neto += i; if (conFactura) iva += (i * (leerMonto(ivas[p.id] ?? "0") ?? 0)) / 100; }
    neto += otroImp; if (conFactura) iva += (otroImp * (leerMonto(otro.iva) ?? 0)) / 100;
    neto += montoEnvio; if (conFactura) iva += (montoEnvio * IVA_ENVIO) / 100;
    return { neto, iva };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, precios, ivas, conFactura, otroImp, otro.iva, montoEnvio]);

  const elegidos = destino.productos.filter((p) => cant(p.id) > 0);
  const hayAlgo = elegidos.length > 0 || (otro.nombre.trim() && otroQ > 0);
  const faltaPrecio = elegidos.some((p) => !(leerMonto(precios[p.id] ?? "") ?? 0)) || (otro.nombre.trim() !== "" && !(leerMonto(otro.precio) ?? 0));
  const antes = (e: React.FormEvent) => {
    if (!hayAlgo) { e.preventDefault(); setError("Sumá la cantidad de al menos un producto con el +."); return; }
    if (faltaPrecio) { e.preventDefault(); setError("Falta escribir el precio de lo que pidió (los renglones marcados en rojo)."); return; }
    setError(null);
  };
  const cuantos = elegidos.length + (otro.nombre.trim() && otroQ > 0 ? 1 : 0);
  const arriba = useRef<HTMLDivElement>(null);

  return (
    <form action={enviar} onSubmit={antes} className="pb-40">
      <div ref={arriba} />
      <input type="hidden" name="puntoId" value={destino.puntoId} />
      <input type="hidden" name="conFactura" value={conFactura ? "1" : "0"} />
      <input type="hidden" name="m_total" value="1" />
      <input type="hidden" name="envio" value={envio} />
      <input type="hidden" name="mn_0" value={otro.nombre} /><input type="hidden" name="mc_0" value={otro.cantidad} /><input type="hidden" name="mp_0" value={otro.precio} /><input type="hidden" name="mu_0" value={otro.unidad} /><input type="hidden" name="mi_0" value={otro.iva} />

      <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-stone-300 bg-white px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-[17px] font-bold text-stone-900">{destino.cliente}</p>
          <p className="truncate text-[13px] text-stone-600">{destino.sucursal}</p>
        </div>
        <button type="button" onClick={cambiar} className="shrink-0 rounded-lg border border-stone-400 bg-white px-3 py-2 text-sm font-semibold text-stone-700 active:bg-stone-100">Cambiar</button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2" role="group" aria-label="Tipo de comprobante">
        {[{ v: false, t: "Con remito" }, { v: true, t: "Con factura" }].map((o) => (
          <button key={String(o.v)} type="button" aria-pressed={conFactura === o.v} onClick={() => setConFactura(o.v)} className={`h-12 rounded-xl border text-[15px] font-semibold ${conFactura === o.v ? "border-stone-800 bg-stone-800 text-white" : "border-stone-400 bg-white text-stone-700"}`}>{o.t}</button>
        ))}
      </div>

      <p className="mb-2 text-sm font-semibold text-stone-700">¿Qué pidió?</p>
      <ul className="space-y-2">
        {destino.productos.map((p) => {
          const n = cant(p.id);
          const precio = leerMonto(precios[p.id] ?? "") ?? 0;
          return (
            <li key={p.id} className={`rounded-xl border bg-white ${n > 0 ? "border-verde-700" : "border-stone-300"}`}>
              <div className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-semibold leading-tight text-stone-900">{p.nombre}</p>
                  <p className="text-[12.5px] text-stone-500">por {p.unidad}</p>
                </div>
                <button type="button" className={paso} onClick={() => mover(p.id, -1)} aria-label={`Menos ${p.nombre}`}>−</button>
                <input name={`q_${p.id}`} inputMode="numeric" aria-label={`Cantidad de ${p.nombre}`} value={n || ""} placeholder="0" onChange={(e) => setQ((x) => ({ ...x, [p.id]: Number(e.target.value.replace(/\D/g, "") || 0) }))} className="h-14 w-16 shrink-0 rounded-xl border border-stone-400 bg-white text-center text-2xl font-semibold tabular-nums" />
                <button type="button" className={paso} onClick={() => mover(p.id, 1)} aria-label={`Más ${p.nombre}`}>+</button>
              </div>
              {n > 0 && (
                <div className="flex items-center gap-2 border-t border-stone-200 bg-stone-50 px-3 py-2.5">
                  <label className="relative flex-1">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" aria-hidden>$</span>
                    <input name={`pr_${p.id}`} inputMode="decimal" aria-label={`Precio de ${p.nombre}`} placeholder="Precio" value={precios[p.id] ?? ""} onChange={(e) => setPrecios((x) => ({ ...x, [p.id]: e.target.value }))} className={`${input} pl-7 ${precio ? "" : "border-rojo-600"}`} />
                  </label>
                  {conFactura && (
                    <select name={`iva_${p.id}`} aria-label={`IVA de ${p.nombre}`} value={ivas[p.id] ?? "0"} onChange={(e) => setIvas((x) => ({ ...x, [p.id]: e.target.value }))} className="h-12 w-[5.5rem] rounded-lg border border-stone-400 bg-white px-1 text-center text-base">
                      {["0", "10,5", "21"].map((t) => <option key={t} value={t}>IVA {t}%</option>)}
                    </select>
                  )}
                  <p className="w-[6.5rem] shrink-0 text-right text-[15px] font-bold tabular-nums">{precio ? formatoPesos(importe(p.id)) : <span className="text-xs font-medium text-rojo-700">Falta precio</span>}</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <button type="button" onClick={() => setMasAbierto((v) => !v)} className="mt-3 flex h-12 w-full items-center justify-between rounded-xl border border-stone-300 bg-white px-4 text-[15px] font-semibold text-stone-700">
        <span>Otro producto, envío y nota</span><span aria-hidden>{masAbierto ? "▴" : "▾"}</span>
      </button>
      <div className={`${masAbierto ? "mt-2 space-y-3 rounded-xl border border-stone-300 bg-white p-4" : "hidden"}`}>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-stone-700">Otro producto (escribilo)</p>
          <input value={otro.nombre} onChange={(e) => setOtro({ ...otro, nombre: e.target.value })} placeholder="Nombre del producto" maxLength={80} className={input} />
          {otro.nombre.trim() && (
            <div className="grid grid-cols-2 gap-2">
              <input value={otro.cantidad} inputMode="numeric" onChange={(e) => setOtro({ ...otro, cantidad: e.target.value.replace(/\D/g, "") })} placeholder="Cantidad" aria-label="Cantidad" className={input} />
              <select value={otro.unidad} onChange={(e) => setOtro({ ...otro, unidad: e.target.value })} aria-label="Se pide por" className={input}><option value="paquete">Paquete</option><option value="unidad">Unidad</option></select>
              <input value={otro.precio} inputMode="decimal" onChange={(e) => setOtro({ ...otro, precio: e.target.value })} placeholder="Precio $" aria-label="Precio" className={`${input} ${leerMonto(otro.precio) ? "" : "border-rojo-600"}`} />
              {conFactura && <select value={otro.iva} onChange={(e) => setOtro({ ...otro, iva: e.target.value })} aria-label="IVA" className={input}>{["0", "10,5", "21"].map((t) => <option key={t} value={t}>IVA {t}%</option>)}</select>}
            </div>
          )}
        </div>
        <label className="block text-sm font-semibold text-stone-700">Envío (si se cobra)
          <input value={envio} inputMode="decimal" onChange={(e) => setEnvio(e.target.value)} placeholder="$ 0" className={`${input} mt-1`} />
        </label>
        <label className="block text-sm font-semibold text-stone-700">Nota importante <span className="font-normal text-stone-500">(se ve en la ruta)</span>
          <input name="nota" placeholder="Ej.: entregar en el vecino" className={`${input} mt-1`} />
        </label>
      </div>

      {(error || estado?.error || estado?.aviso) && (
        <p role="alert" className="mt-3 rounded-xl border border-rojo-600 bg-rojo-50 px-4 py-3 text-[15px] font-medium text-rojo-700">{error ?? estado?.error ?? estado?.aviso}</p>
      )}

      {/* Barra fija abajo: el total y el botón siempre al alcance del pulgar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-300 bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
        <div className="mx-auto max-w-xl">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-sm text-stone-600">{cuantos === 0 ? "Todavía no sumaste nada" : `${cuantos} ${cuantos === 1 ? "producto" : "productos"}${conFactura && iva > 0 ? ` · IVA ${formatoPesos(iva)}` : ""}`}</span>
            <span className="text-2xl font-bold tabular-nums text-stone-900">{formatoPesos(neto + iva)}</span>
          </div>
          <button disabled={cargando} className="h-14 w-full rounded-xl bg-verde-700 text-base font-bold uppercase tracking-wide text-white active:bg-verde-800 disabled:opacity-60">{cargando ? "Guardando…" : "Guardar pedido"}</button>
        </div>
      </div>
    </form>
  );
}
