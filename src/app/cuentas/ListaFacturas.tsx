"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatoPesos } from "@/lib/numeros";
import type { FilaFactura, PuntoCliente } from "@/lib/facturas";
import { aplicarNc, deshacerPagoArca, quitarAplicacionNc, registrarPagosArca } from "./arca/actions";
import { SucursalArca } from "./arca/SucursalArca";

const MEDIOS = [
  { valor: "EFECTIVO", texto: "Efectivo" },
  { valor: "TRANSFERENCIA", texto: "Transferencia" },
  { valor: "CHEQUE", texto: "Cheque" },
  { valor: "OTRO", texto: "Otro" },
];
const TEXTO_MEDIO: Record<string, string> = { EFECTIVO: "efectivo", TRANSFERENCIA: "transferencia", CHEQUE: "cheque", MERCADO_PAGO: "Mercado Pago", OTRO: "otro" };
const COLUMNAS = "grid-cols-[22px_128px_52px_minmax(0,1fr)_120px_176px_26px]";
const fechaCorta = (s: string) => `${s.slice(8)}/${s.slice(5, 7)}`;
const pastilla = (clase: string) => `inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${clase}`;

export function ListaFacturas({ filas, puntosPorCuit }: { filas: FilaFactura[]; puntosPorCuit: Record<string, PuntoCliente[]> }) {
  const router = useRouter();
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [medio, setMedio] = useState("");
  const [obs, setObs] = useState("");
  const [abierta, setAbierta] = useState<{ id: string; modo: "editar" | "aplicar" } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, empezar] = useTransition();

  const porId = new Map(filas.map((f) => [f.id, f]));
  const pagables = filas.filter((f) => !f.esNc && !f.pagada && f.saldo > 0.01);
  const suma = [...elegidas].reduce((s, id) => s + (porId.get(id)?.saldo ?? 0), 0);
  const alternar = (id: string) => setElegidas((a) => { const n = new Set(a); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const correr = (fn: () => Promise<{ ok: boolean; error?: string }>, despues?: () => void) => { setError(null); empezar(async () => { const r = await fn(); if (!r.ok) setError(r.error ?? "No se pudo."); else despues?.(); router.refresh(); }); };

  const registrar = () => {
    if (!medio) return setError("Elegí cómo pagó.");
    const n = elegidas.size;
    if (!window.confirm(`¿Confirmás que se ${n === 1 ? "pagó 1 factura" : `pagaron ${n} facturas`} por ${formatoPesos(suma)} con ${TEXTO_MEDIO[medio]}?\n\nQuedan marcadas como pagadas.`)) return;
    correr(() => registrarPagosArca([...elegidas], medio, obs), () => { setElegidas(new Set()); setMedio(""); setObs(""); });
  };

  if (filas.length === 0) return <p className="rounded-lg border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">No hay comprobantes con ese filtro.</p>;

  return (
    <div className="overflow-hidden rounded-lg border border-stone-300 bg-white">
      <div className={`hidden items-center gap-x-3 border-b border-stone-300 bg-crema-100 px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-stone-500 lg:grid ${COLUMNAS}`}>
        <span /><span>Comprobante</span><span>Fecha</span><span>Cliente</span><span className="text-right">Importe</span><span>Estado</span><span />
      </div>
      <ul className="divide-y divide-stone-200">
        {filas.map((f) => {
          const cubierta = !f.esNc && f.aplicado > 0 && f.saldo <= 0.01;
          const nombre = f.cliente ?? f.razonSocial ?? "—";
          return (
            <li key={f.id}>
              <div className={`grid items-center gap-x-3 px-3 py-1.5 text-[13px] ${COLUMNAS} ${elegidas.has(f.id) ? "bg-crema-100" : ""} ${cubierta ? "text-stone-400" : "text-stone-800"}`}>
                <input type="checkbox" aria-label={`Elegir ${f.numero}`} disabled={f.esNc || f.pagada || cubierta} checked={elegidas.has(f.id)} onChange={() => alternar(f.id)} className="h-3.5 w-3.5 accent-[#026433] disabled:opacity-25" />
                <span className="whitespace-nowrap font-bold tabular-nums text-stone-900">
                  {f.esNc ? <><span className="mr-1 rounded bg-stone-200 px-1.5 py-px text-[10.5px] font-bold text-stone-700">NC</span>{f.numero}</> : <>FACTURA {f.numero}</>}
                </span>
                <span className="tabular-nums text-stone-500">{fechaCorta(f.fecha)}</span>
                <span className="min-w-0 truncate" title={f.problemas.join(" · ") || undefined}>
                  {f.cliente ? <span className="font-medium">{nombre}</span> : <span className="italic text-rojo-700" title="El CUIT no está en ningún cliente">{nombre}</span>}
                  {f.sucursal && <span className="text-stone-400"> · {f.sucursal}</span>}
                  {!f.esNc && !f.pedidoId && <span className="ml-1.5 text-[11px] text-rojo-700">sin pedido</span>}
                  {f.observacion && <span className="ml-1.5 text-[11.5px] text-stone-400">“{f.observacion}”</span>}
                </span>
                <span className={`whitespace-nowrap text-right font-bold tabular-nums ${f.esNc ? "text-stone-500" : ""}`}>{f.esNc ? "−" : ""}{formatoPesos(f.total)}</span>
                <span className="flex items-center gap-1.5">
                  {f.esNc ? (
                    f.saldo > 0.01
                      ? <button type="button" onClick={() => setAbierta(abierta?.id === f.id && abierta.modo === "aplicar" ? null : { id: f.id, modo: "aplicar" })} className={pastilla("border border-rojo-600 bg-rojo-50 text-rojo-700 hover:bg-rojo-100")}>Aplicar a factura…</button>
                      : <span className="text-[11.5px] text-stone-500">aplicada</span>
                  ) : cubierta ? (
                    <span className={pastilla("bg-stone-200 text-stone-600")}>Anulada · NC {f.creditos.map((c) => c.ncNumero).join(", ")}</span>
                  ) : f.pagada ? (
                    <>
                      <span className={pastilla("bg-verde-100 text-verde-800")}>Pagada{f.medio ? ` · ${TEXTO_MEDIO[f.medio] ?? ""}` : ""}</span>
                      <button type="button" onClick={() => window.confirm("¿Deshacer este pago? La factura vuelve a figurar pendiente.") && correr(() => deshacerPagoArca(f.id))} className="text-[11px] text-stone-400 underline hover:text-rojo-700">deshacer</button>
                    </>
                  ) : (
                    <span className={pastilla("bg-crema-200 text-stone-700")}>Pendiente{f.aplicado > 0 ? ` · NC −${formatoPesos(f.aplicado)}` : ""}</span>
                  )}
                </span>
                <button type="button" onClick={() => setAbierta(abierta?.id === f.id && abierta.modo === "editar" ? null : { id: f.id, modo: "editar" })} aria-label="Sucursal y observación" title="Sucursal y observación" className="text-stone-400 hover:text-stone-800">✎</button>
              </div>

              {f.problemas.length > 0 && <p className="px-3 pb-1.5 pl-[170px] text-[11.5px] text-rojo-700">{f.problemas.join(" · ")}</p>}
              {f.esNc && f.aplicaciones.length > 0 && (
                <p className="px-3 pb-1.5 pl-[170px] text-[11.5px] text-stone-500">
                  {f.aplicaciones.map((a) => (
                    <span key={a.id} className="mr-3">→ FACTURA {a.facturaNumero} ({formatoPesos(a.monto)}) <button type="button" onClick={() => window.confirm("¿Quitar esta aplicación?") && correr(() => quitarAplicacionNc(a.id))} className="text-stone-400 underline hover:text-rojo-700">quitar</button></span>
                  ))}
                </p>
              )}

              {abierta?.id === f.id && abierta.modo === "editar" && (
                <div className="border-t border-stone-200 bg-crema-50 px-3 py-2 pl-[170px]"><div className="max-w-md"><SucursalArca id={f.id} puntos={f.cuit ? puntosPorCuit[f.cuit] ?? [] : []} puntoId={f.puntoId} observacion={f.observacion} /></div></div>
              )}
              {abierta?.id === f.id && abierta.modo === "aplicar" && (
                <div className="border-t border-stone-200 bg-crema-50 px-3 py-2 pl-[170px] text-[12.5px]">
                  <p className="mb-1 font-semibold text-stone-700">¿A qué factura corresponde la NC {f.numero}? (mismo CUIT; primero las del mismo importe)</p>
                  {(() => {
                    const candidatas = filas.filter((x) => !x.esNc && x.cuit === f.cuit && x.saldo > 0.01).sort((a, b) => Number(Math.abs(b.saldo - f.saldo) < 0.01) - Number(Math.abs(a.saldo - f.saldo) < 0.01) || b.numero - a.numero);
                    if (candidatas.length === 0) return <p className="text-stone-500">No hay facturas de este CUIT con saldo.</p>;
                    return (
                      <ul className="space-y-0.5">
                        {candidatas.slice(0, 12).map((c) => (
                          <li key={c.id} className="flex items-center gap-3">
                            <span className="w-36 whitespace-nowrap font-bold tabular-nums">FACTURA {c.numero}</span>
                            <span className="w-12 text-stone-500">{fechaCorta(c.fecha)}</span>
                            <span className="w-28 text-right tabular-nums">{formatoPesos(c.saldo)}</span>
                            {Math.abs(c.saldo - f.saldo) < 0.01 && <span className="text-[11px] font-semibold text-verde-700">mismo importe</span>}
                            <button type="button" disabled={trabajando} onClick={() => window.confirm(`¿Aplicar la NC ${f.numero} a la FACTURA ${c.numero} por ${formatoPesos(Math.min(f.saldo, c.saldo))}?`) && correr(() => aplicarNc(f.id, c.id), () => setAbierta(null))} className="ml-auto rounded border border-stone-500 bg-white px-2 py-0.5 text-[11.5px] font-semibold hover:bg-stone-800 hover:text-white">Aplicar</button>
                          </li>
                        ))}
                      </ul>
                    );
                  })()}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-stone-300 bg-crema-100 px-3 py-2 text-[13px]">
        <p className="text-stone-600">{elegidas.size > 0 ? <><b className="text-stone-900">{elegidas.size}</b> {elegidas.size === 1 ? "elegida" : "elegidas"} · <b className="tabular-nums text-stone-900">{formatoPesos(suma)}</b></> : "Tildá las facturas que se pagaron."}</p>
        <div className="flex items-center gap-2">
          <select aria-label="Medio de pago" value={medio} onChange={(e) => setMedio(e.target.value)} disabled={elegidas.size === 0} className="h-8 rounded-md border border-stone-400 bg-white px-2 text-[12.5px] disabled:opacity-40">
            <option value="" disabled hidden>Pagó con…</option>
            {MEDIOS.map((m) => <option key={m.valor} value={m.valor}>{m.texto}</option>)}
          </select>
          <input value={obs} onChange={(e) => setObs(e.target.value)} disabled={elegidas.size === 0} placeholder="N° de cheque, comprobante…" aria-label="Observación del pago" maxLength={150} className="h-8 w-52 rounded-md border border-stone-400 bg-white px-2 text-[12.5px] disabled:opacity-40" />
          <button type="button" onClick={registrar} disabled={elegidas.size === 0 || trabajando} className="h-8 rounded-md bg-verde-700 px-3 text-[12.5px] font-semibold text-white hover:bg-verde-800 disabled:opacity-40">{trabajando ? "…" : "Registrar pago"}</button>
        </div>
      </div>
      {error && <p className="border-t border-rojo-600 bg-rojo-50 px-3 py-1.5 text-[12.5px] text-rojo-700" role="alert">{error}</p>}
    </div>
  );
}
