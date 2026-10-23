"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { IVA_ENVIO } from "@/lib/cuenta";
import { formatoPesos, leerMonto } from "@/lib/numeros";
import { actualizarPedido, buscarDestinos, crearPedido, datosNuevoPedido, type DatosPedido, type Destino } from "../pedidos/actions";

// Cargar un pedido desde el CELULAR (lo usa Diego todo el día): pasos grandes, botones para el dedo y el total siempre a la vista.
// 1) elegir el cliente (aparecen sus clientes sin escribir nada; se puede buscar) · 2) cantidades y precios · 3) Guardar.
const input = "h-12 w-full rounded-lg border border-stone-400 bg-white px-3 text-base text-stone-900 focus:border-verde-700 focus:outline-none focus:ring-2 focus:ring-verde-700/25";
const chip = "h-11 rounded-lg border px-3 text-[15px] font-semibold";
const MOTIVOS = ["Recambio", "Bonificación", "Muestra", "Otro"];
const paso = "h-14 w-14 shrink-0 rounded-xl border border-stone-400 bg-white text-3xl font-medium leading-none text-stone-800 active:bg-stone-100";

/** Valores con los que arranca el formulario cuando se MODIFICA un pedido ya cargado. */
export type EdicionPedido = {
  pedidoId: string;
  conFactura: boolean;
  nota: string;
  envio: string;
  cantidades: Record<string, number>;
  precios: Record<string, string>;
  ivas: Record<string, string>;
  descuentos: Record<string, string>;
  sinCargo: Record<string, number>;
  motivos: Record<string, string>;
  otro: { nombre: string; cantidad: string; precio: string; unidad: string; iva: string } | null;
};

export function PedidoMovil({ inicial, edicion, comisionPct = 0 }: { inicial: DatosPedido | null; edicion?: EdicionPedido; comisionPct?: number }) {
  const [destino, setDestino] = useState<DatosPedido | null>(inicial);
  const [hecho, setHecho] = useState<string | null>(null);
  const [vuelta, setVuelta] = useState(0);
  if (hecho) {
    return (
      <div className="space-y-4 rounded-2xl border border-verde-700 bg-verde-50 p-6 text-center">
        <p className="text-4xl text-verde-700" aria-hidden>✓</p>
        <p className="text-lg font-semibold text-verde-800">{hecho}</p>
        <div className="grid gap-3">
          {!edicion && <button type="button" onClick={() => { setHecho(null); setDestino(null); setVuelta((v) => v + 1); }} className="h-14 rounded-xl bg-verde-700 text-base font-bold uppercase tracking-wide text-white active:bg-verde-800">Cargar otro pedido</button>}
          <Link href="/vendedor/pedidos" className={`flex h-14 items-center justify-center rounded-xl text-base font-semibold ${edicion ? "bg-verde-700 font-bold uppercase tracking-wide text-white" : "border border-stone-400 bg-white text-stone-800"}`}>Ver mis pedidos</Link>
        </div>
      </div>
    );
  }
  return destino
    ? <Formulario key={`${destino.puntoId}-${vuelta}`} destino={destino} cambiar={() => setDestino(null)} listo={setHecho} edicion={edicion} comisionPct={comisionPct} />
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
                <span className="block text-[16px] font-semibold text-stone-900">{d.cliente}{d.inactivo && <span className="ml-2 rounded-full bg-rojo-50 px-2 py-0.5 text-xs font-semibold text-rojo-700">Inactivo</span>}</span>
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
function Formulario({ destino, cambiar, listo, edicion, comisionPct }: { destino: DatosPedido; cambiar: () => void; listo: (texto: string) => void; edicion?: EdicionPedido; comisionPct: number }) {
  const [estado, enviar, cargando] = useActionState(edicion ? actualizarPedido.bind(null, edicion.pedidoId) : crearPedido, undefined);
  const [q, setQ] = useState<Record<string, number>>(edicion?.cantidades ?? {});
  const [precios, setPrecios] = useState<Record<string, string>>(edicion?.precios ?? {});
  const [ivas, setIvas] = useState<Record<string, string>>(edicion?.ivas ?? {});
  const [dtos, setDtos] = useState<Record<string, string>>(edicion?.descuentos ?? {}); // bonificación % por producto
  const [scs, setScs] = useState<Record<string, number>>(edicion?.sinCargo ?? {}); // paquetes/unidades sin cargo por producto
  const [motivos, setMotivos] = useState<Record<string, string>>(edicion?.motivos ?? {});
  const [dtoGen, setDtoGen] = useState(""); // descuento % para todo el pedido (cada producto puede tener el suyo)
  const [abiertoSc, setAbiertoSc] = useState<Record<string, boolean>>(Object.fromEntries(Object.entries(edicion?.sinCargo ?? {}).filter(([, v]) => v > 0).map(([k]) => [k, true])));
  const [conFactura, setConFactura] = useState(edicion ? edicion.conFactura : destino.facturado);
  const [otro, setOtro] = useState(edicion?.otro ?? { nombre: "", cantidad: "1", precio: "", unidad: "paquete", iva: "0" });
  const [masAbierto, setMasAbierto] = useState(!!edicion && !!(edicion.otro || edicion.envio || edicion.nota));
  const [envio, setEnvio] = useState(edicion?.envio ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (estado?.ok) listo(estado.ok); }, [estado, listo]);
  const cant = (id: string) => q[id] ?? 0;
  const mover = (id: string, d: number) => setQ((x) => ({ ...x, [id]: Math.max(0, (x[id] ?? 0) + d) }));
  const dtoTexto = (id: string) => ((dtos[id] ?? "").trim() !== "" ? dtos[id] : dtoGen);
  const pctDe = (id: string) => Math.min(100, Math.max(0, leerMonto(dtoTexto(id) ?? "") ?? 0));
  const bruto = (id: string) => cant(id) * (leerMonto(precios[id] ?? "") ?? 0);
  const importe = (id: string) => bruto(id) * (1 - pctDe(id) / 100);
  const sinCargoDe = (id: string) => scs[id] ?? 0;
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
  const conSc = destino.productos.filter((p) => cant(p.id) > 0 || sinCargoDe(p.id) > 0);
  const totalDescuento = destino.productos.reduce((t, p) => t + bruto(p.id) - importe(p.id), 0);
  const totalSc = destino.productos.reduce((t, p) => t + sinCargoDe(p.id), 0);
  const falloMotivo = destino.productos.find((p) => sinCargoDe(p.id) > 0 && !(motivos[p.id] ?? "").trim());
  const hayAlgo = conSc.length > 0 || (otro.nombre.trim() && otroQ > 0);
  const faltaPrecio = elegidos.some((p) => !(leerMonto(precios[p.id] ?? "") ?? 0)) || (otro.nombre.trim() !== "" && !(leerMonto(otro.precio) ?? 0));
  const antes = (e: React.FormEvent) => {
    if (!hayAlgo) { e.preventDefault(); setError("Sumá la cantidad de al menos un producto con el +."); return; }
    if (faltaPrecio) { e.preventDefault(); setError("Falta escribir el precio de lo que pidió (los renglones marcados en rojo)."); return; }
    if (falloMotivo) { e.preventDefault(); setError(`Elegí el motivo del sin cargo de ${falloMotivo.nombre}.`); return; }
    setError(null);
  };
  const cuantos = conSc.length + (otro.nombre.trim() && otroQ > 0 ? 1 : 0);
  const arriba = useRef<HTMLDivElement>(null);

  return (
    <form action={enviar} onSubmit={antes} className="pb-40">
      <div ref={arriba} />
      <input type="hidden" name="puntoId" value={destino.puntoId} />
      <input type="hidden" name="conFactura" value={conFactura ? "1" : "0"} />
      <input type="hidden" name="m_total" value="1" />
      {destino.productos.map((p) => (
        <span key={p.id}>
          <input type="hidden" name={`bd_${p.id}`} value={pctDe(p.id) ? dtoTexto(p.id) : ""} />
          <input type="hidden" name={`sc_${p.id}`} value={sinCargoDe(p.id) || ""} />
          <input type="hidden" name={`scm_${p.id}`} value={sinCargoDe(p.id) ? motivos[p.id] ?? "" : ""} />
        </span>
      ))}
      <input type="hidden" name="envio" value={envio} />
      <input type="hidden" name="mn_0" value={otro.nombre} /><input type="hidden" name="mc_0" value={otro.cantidad} /><input type="hidden" name="mp_0" value={otro.precio} /><input type="hidden" name="mu_0" value={otro.unidad} /><input type="hidden" name="mi_0" value={otro.iva} />

      <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-stone-300 bg-white px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-[17px] font-bold text-stone-900">{destino.cliente}</p>
          <p className="truncate text-[13px] text-stone-600">{destino.sucursal}</p>
        </div>
        {!edicion && <button type="button" onClick={cambiar} className="shrink-0 rounded-lg border border-stone-400 bg-white px-3 py-2 text-sm font-semibold text-stone-700 active:bg-stone-100">Cambiar</button>}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2" role="group" aria-label="Tipo de comprobante">
        {[{ v: false, t: "Con remito" }, { v: true, t: "Con factura" }].map((o) => (
          <button key={String(o.v)} type="button" aria-pressed={conFactura === o.v} onClick={() => setConFactura(o.v)} className={`h-12 rounded-xl border text-[15px] font-semibold ${conFactura === o.v ? "border-stone-800 bg-stone-800 text-white" : "border-stone-400 bg-white text-stone-700"}`}>{o.t}</button>
        ))}
      </div>

      <div className="mb-4 rounded-xl border border-stone-300 bg-white px-3 py-3">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 text-[15px] font-semibold text-stone-800">Descuento para todo el pedido <span className="block text-[12px] font-normal text-stone-500">se aplica a todos los productos (podés cambiarlo en uno)</span></span>
          <label className="relative w-24 shrink-0">
            <input inputMode="decimal" aria-label="Descuento para todo el pedido en %" placeholder="0" value={dtoGen} onChange={(e) => setDtoGen(e.target.value)} className={`${input} pr-7 text-right text-[17px] font-semibold`} />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" aria-hidden>%</span>
          </label>
        </div>
        <div className="mt-2 flex gap-2">
          {["5", "10", "15"].map((t) => (
            <button key={t} type="button" aria-pressed={dtoGen === t} onClick={() => setDtoGen((x) => (x === t ? "" : t))} className={`${chip} flex-1 ${dtoGen === t ? "border-stone-800 bg-stone-800 text-white" : "border-stone-400 bg-white text-stone-700"}`}>{t} %</button>
          ))}
        </div>
      </div>

      <p className="mb-2 text-sm font-semibold text-stone-700">¿Qué pidió?</p>
      <ul className="space-y-2">
        {destino.productos.map((p) => {
          const n = cant(p.id);
          const precio = leerMonto(precios[p.id] ?? "") ?? 0;
          const sc = sinCargoDe(p.id);
          const pct = pctDe(p.id);
          return (
            <li key={p.id} className={`rounded-xl border bg-white ${n > 0 || sc > 0 ? "border-verde-700" : "border-stone-300"}`}>
              <div className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-semibold leading-tight text-stone-900">{p.nombre}</p>
                  <p className="text-[12.5px] text-stone-500">por {p.unidad}</p>
                </div>
                <button type="button" className={paso} onClick={() => mover(p.id, -1)} aria-label={`Menos ${p.nombre}`}>−</button>
                <input name={`q_${p.id}`} inputMode="numeric" aria-label={`Cantidad de ${p.nombre}`} value={n || ""} placeholder="0" onChange={(e) => setQ((x) => ({ ...x, [p.id]: Number(e.target.value.replace(/\D/g, "") || 0) }))} className="h-14 w-16 shrink-0 rounded-xl border border-stone-400 bg-white text-center text-2xl font-semibold tabular-nums" />
                <button type="button" className={paso} onClick={() => mover(p.id, 1)} aria-label={`Más ${p.nombre}`}>+</button>
              </div>
              {n === 0 && sc === 0 && !abiertoSc[p.id] && (
                <div className="border-t border-stone-200 px-3 py-2">
                  <button type="button" onClick={() => { setAbiertoSc((x) => ({ ...x, [p.id]: true })); setScs((x) => ({ ...x, [p.id]: 1 })); }} className="text-[14px] font-semibold text-stone-600 underline-offset-2 active:underline">+ Solo sin cargo (recambio, muestra…)</button>
                </div>
              )}
              {n > 0 && (
                <div className="space-y-3 border-t border-stone-200 bg-stone-50 px-3 py-3">
                  <div className={`grid gap-2 ${conFactura ? "grid-cols-3" : "grid-cols-2"}`}>
                    <label className="block text-[12px] font-semibold uppercase tracking-wide text-stone-500">Precio $
                      <input name={`pr_${p.id}`} inputMode="decimal" aria-label={`Precio de ${p.nombre}`} placeholder="0" value={precios[p.id] ?? ""} onChange={(e) => setPrecios((x) => ({ ...x, [p.id]: e.target.value }))} className={`${input} mt-1 text-[17px] font-semibold normal-case tracking-normal ${precio ? "" : "border-rojo-600"}`} />
                    </label>
                    <label className="block text-[12px] font-semibold uppercase tracking-wide text-stone-500">Descuento %
                      <input inputMode="decimal" aria-label={`Descuento de ${p.nombre} en %`} placeholder={dtoGen && !(dtos[p.id] ?? "").trim() ? dtoGen : "0"} value={dtos[p.id] ?? ""} onChange={(e) => setDtos((x) => ({ ...x, [p.id]: e.target.value }))} className={`${input} mt-1 text-[17px] font-semibold normal-case tracking-normal`} />
                    </label>
                    {conFactura && (
                      <label className="block text-[12px] font-semibold uppercase tracking-wide text-stone-500">IVA
                        <select name={`iva_${p.id}`} aria-label={`IVA de ${p.nombre}`} value={ivas[p.id] ?? "0"} onChange={(e) => setIvas((x) => ({ ...x, [p.id]: e.target.value }))} className={`${input} mt-1 px-2 text-[17px] font-semibold normal-case tracking-normal`}>
                          {["0", "10,5", "21"].map((t) => <option key={t} value={t}>{t} %</option>)}
                        </select>
                      </label>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[12px] font-semibold uppercase tracking-wide text-stone-500">Rápido</span>
                    {["5", "10", "15"].map((t) => (
                      <button key={t} type="button" aria-pressed={dtoTexto(p.id) === t} onClick={() => setDtos((x) => ({ ...x, [p.id]: (x[p.id] ?? "") === t ? "" : t }))} className={`${chip} ${dtoTexto(p.id) === t ? "border-stone-800 bg-stone-800 text-white" : "border-stone-400 bg-white text-stone-700"}`}>{t} %</button>
                    ))}
                    {(dtos[p.id] ?? "") !== "" && <button type="button" onClick={() => setDtos((x) => ({ ...x, [p.id]: "" }))} className={`${chip} border-stone-300 bg-white text-stone-500`}>Sin descuento</button>}
                  </div>
                  <p className="flex items-baseline justify-between text-[15px]">
                    <span className="text-stone-600">{pct > 0 ? <>Con {String(pct).replace(".", ",")} % de descuento <span className="text-stone-400 line-through tabular-nums">{formatoPesos(bruto(p.id))}</span></> : "Subtotal"}</span>
                    <b className="text-[18px] tabular-nums text-stone-900">{precio ? formatoPesos(importe(p.id)) : <span className="text-xs font-medium text-rojo-700">Falta precio</span>}</b>
                  </p>
                </div>
              )}
              {(n > 0 || sc > 0 || abiertoSc[p.id]) && (
                <div className="space-y-2 border-t border-stone-200 px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 text-[15px] font-semibold text-stone-800">Sin cargo <span className="block text-[12px] font-normal text-stone-500">recambio, muestra… (no suma al total)</span></span>
                    <button type="button" className="h-12 w-12 shrink-0 rounded-xl border border-stone-400 bg-white text-2xl leading-none active:bg-stone-100" onClick={() => setScs((x) => ({ ...x, [p.id]: Math.max(0, (x[p.id] ?? 0) - 1) }))} aria-label={`Menos sin cargo de ${p.nombre}`}>−</button>
                    <span className="w-9 text-center text-xl font-semibold tabular-nums">{sc}</span>
                    <button type="button" className="h-12 w-12 shrink-0 rounded-xl border border-stone-400 bg-white text-2xl leading-none active:bg-stone-100" onClick={() => setScs((x) => ({ ...x, [p.id]: (x[p.id] ?? 0) + 1 }))} aria-label={`Más sin cargo de ${p.nombre}`}>+</button>
                  </div>
                  {sc > 0 && (
                    <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Motivo del sin cargo">
                      {MOTIVOS.map((m) => (
                        <button key={m} type="button" aria-pressed={motivos[p.id] === m} onClick={() => setMotivos((x) => ({ ...x, [p.id]: m }))} className={`h-11 rounded-lg border text-[14px] font-semibold ${motivos[p.id] === m ? "border-stone-800 bg-stone-800 text-white" : "border-stone-400 bg-white text-stone-700"}`}>{m}</button>
                      ))}
                      {!motivos[p.id] && <p className="col-span-2 text-[13px] font-medium text-rojo-700">¿Por qué es sin cargo? Elegí el motivo.</p>}
                    </div>
                  )}
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
          <input name="nota" defaultValue={edicion?.nota ?? ""} placeholder="Ej.: entregar en el vecino" className={`${input} mt-1`} />
        </label>
      </div>

      {(error || estado?.error || estado?.aviso) && (
        <p role="alert" className="mt-3 rounded-xl border border-rojo-600 bg-rojo-50 px-4 py-3 text-[15px] font-medium text-rojo-700">{error ?? estado?.error ?? estado?.aviso}</p>
      )}

      {/* Barra fija abajo: el total y el botón siempre al alcance del pulgar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-300 bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
        <div className="mx-auto max-w-xl">
          {(totalDescuento > 0 || totalSc > 0) && (
            <p className="mb-1 text-[13px] text-stone-600">{[totalDescuento > 0 ? `Descuentos −${formatoPesos(totalDescuento)}` : "", totalSc > 0 ? `Sin cargo: ${totalSc} ${totalSc === 1 ? "unidad" : "unidades"}` : ""].filter(Boolean).join(" · ")}</p>
          )}
          <p className="mb-1 flex items-baseline justify-between text-sm font-semibold text-verde-800">
            <span>Tu comisión en este pedido{comisionPct > 0 ? ` (${String(comisionPct).replace(".", ",")} %)` : ""}</span>
            <span className="tabular-nums">{formatoPesos((neto * comisionPct) / 100)}</span>
          </p>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-sm text-stone-600">{cuantos === 0 ? "Todavía no sumaste nada" : `${cuantos} ${cuantos === 1 ? "producto" : "productos"}${conFactura && iva > 0 ? ` · IVA ${formatoPesos(iva)}` : ""}`}</span>
            <span className="text-2xl font-bold tabular-nums text-stone-900">{formatoPesos(neto + iva)}</span>
          </div>
          <button disabled={cargando} className="h-14 w-full rounded-xl bg-verde-700 text-base font-bold uppercase tracking-wide text-white active:bg-verde-800 disabled:opacity-60">{cargando ? "Guardando…" : edicion ? "Guardar cambios" : "Guardar pedido"}</button>
        </div>
      </div>
    </form>
  );
}
