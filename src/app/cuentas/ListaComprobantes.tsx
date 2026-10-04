"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useState, useTransition } from "react";
import { formatoPesos } from "@/lib/numeros";
import { deshacerPago, guardarObservacion, registrarPagos } from "./actions";
import { aplicarNc, deshacerPagoArca, guardarDatosArca, quitarAplicacionNc, registrarPagosArca } from "./arca/actions";

export type FilaComprobante = {
  id: string;
  clienteId: string;
  cliente: string;
  tipo: "FACTURA" | "REMITO";
  numero: string | null;
  cargado: string;
  fecha: string;
  entregado: boolean;
  bruto: number;
  nc: number;
  cubierta: boolean;
  anulado?: string | null; // "Anulado" o "No entregado": tiene número pero ya no se debe
  ncTexto: string; // "NC 0001-00000045" (vacío si no tiene)
  monto: number;
  vence: string;
  atraso: number;
  pagada: boolean;
  medio: string | null;
  obs: string;
  hueco?: boolean; // número que no aparece en ningún pedido: se ve para que la numeración esté completa
  // Facturas y notas de crédito que vienen de ARCA (misma lista, mismas columnas):
  arca?: boolean;
  esNc?: boolean;
  cuit?: string | null;
  saldo?: number;
  sucursal?: string | null;
  puntoId?: string | null;
  puntos?: { id: string; barrio: string; direccion: string }[];
  aviso?: string;
  sinPedido?: boolean;
  aplicaciones?: { id: string; facturaNumero: number; monto: number }[];
};

const MEDIOS = [
  { valor: "EFECTIVO", texto: "Efectivo" },
  { valor: "TRANSFERENCIA", texto: "Transferencia" },
  { valor: "CHEQUE", texto: "Cheque" },
  { valor: "OTRO", texto: "Otro" },
];
const TEXTO_MEDIO: Record<string, string> = { EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia", CHEQUE: "Cheque", MERCADO_PAGO: "Mercado Pago", OTRO: "Otro" };
const COLUMNAS = "grid-cols-[32px_150px_minmax(220px,1fr)_150px_130px_170px_190px_40px]";
const fechaCorta = (s: string) => `${s.slice(8)}/${s.slice(5, 7)}/${s.slice(2, 4)}`;

// Estado en una palabra, con un puntito de color (sin cajas ni pastillas).
function Punto({ color, children }: { color: string; children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-2 whitespace-nowrap text-[13px] text-stone-700"><span className={`h-2 w-2 rounded-full ${color}`} />{children}</span>;
}

// Observación (N° de cheque, comprobante…): siempre editable. Se guarda al salir del campo o con Enter, y avisa "Guardado".
function ObsInput({ id, inicial, arca }: { id: string; inicial: string; arca?: { puntoId: string | null; puntos: { id: string; barrio: string; direccion: string }[] } }) {
  const [punto, setPunto] = useState(arca?.puntoId ?? "");
  const [valor, setValor] = useState(inicial);
  const [guardado, setGuardado] = useState(inicial);
  const [estado, setEstado] = useState<"" | "guardando" | "ok" | "error">("");
  const guardar = async () => {
    if (valor.trim() === guardado.trim()) return;
    setEstado("guardando");
    const r = arca ? await guardarDatosArca(id, punto, valor) : await guardarObservacion(id, valor);
    if (r.ok) { setGuardado(valor); setEstado("ok"); setTimeout(() => setEstado(""), 1800); } else setEstado("error");
  };
  const cambiarPunto = async (p: string) => { setPunto(p); await guardarDatosArca(id, p, valor); setEstado("ok"); setTimeout(() => setEstado(""), 1800); };
  return (
    <span className="relative flex min-w-0 flex-1 gap-1">
      {arca && arca.puntos.length > 0 && (
        <select aria-label="Sucursal" value={punto} onChange={(e) => cambiarPunto(e.target.value)} className="h-9 w-28 shrink-0 rounded-md border border-stone-400 bg-white px-1 text-[12px]">
          <option value="">Sucursal…</option>
          {arca.puntos.map((p) => <option key={p.id} value={p.id}>{p.barrio}</option>)}
        </select>
      )}
      <input
        aria-label="Observación"
        placeholder="N° de cheque, comprobante…"
        value={valor}
        maxLength={200}
        onChange={(e) => setValor(e.target.value)}
        onBlur={guardar}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        className="h-9 min-w-0 flex-1 rounded-md border border-stone-400 bg-white px-2 text-left text-[12px] placeholder:text-stone-400 focus:border-verde-700 focus:outline-none"
      />
      {estado && <span className={`absolute -bottom-3.5 right-1 text-[11px] font-semibold ${estado === "error" ? "text-rojo-700" : "text-verde-700"}`}>{estado === "guardando" ? "Guardando…" : estado === "ok" ? "Guardado ✓" : "No se guardó"}</span>}
    </span>
  );
}

// Listado de comprobantes (facturas o remitos) en orden de número: se tildan los pagados, se elige el medio y se registra el pago.
export function ListaComprobantes({ filas }: { filas: FilaComprobante[] }) {
  const router = useRouter();
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [medio, setMedio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [trabajando, empezar] = useTransition();
  const [picker, setPicker] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const esArca = filas.some((f) => f.arca);

  const pagables = filas.filter((f) => !f.hueco && !f.esNc).filter((f) => f.entregado && !f.pagada && !f.cubierta && !f.anulado);
  const alternar = (id: string) => setElegidas((a) => {
    const n = new Set(a);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const suma = filas.filter((f) => elegidas.has(f.id) && !f.hueco).reduce((s, f) => s + f.monto, 0);

  const registrar = () => {
    setError(null);
    if (!medio) return setError("Elegí cómo pagó.");
    const cant = elegidas.size;
    if (!window.confirm(`¿Confirmás que se pagaron ${cant} ${cant === 1 ? "comprobante" : "comprobantes"} por ${formatoPesos(suma)} con ${MEDIOS.find((m) => m.valor === medio)?.texto.toLowerCase()}?\n\nQuedan marcados como pagados.`)) return;
    empezar(async () => {
      const r = esArca ? await registrarPagosArca([...elegidas], medio, "") : await registrarPagos([...elegidas], medio);
      if (!r.ok) setError(r.error ?? "No se pudo registrar.");
      else { setElegidas(new Set()); setMedio(""); }
      router.refresh();
    });
  };
  const deshacer = (id: string) => {
    if (!window.confirm("¿Deshacer este pago? El comprobante vuelve a figurar sin pagar.")) return;
    empezar(async () => {
      const r = esArca ? await deshacerPagoArca(id) : await deshacerPago(id);
      if (!r.ok) window.alert(r.error);
      router.refresh();
    });
  };

  if (filas.length === 0) return <p className="p-10 text-center text-sm text-stone-500">No hay comprobantes con ese filtro.</p>;

  return (
    <div>
      <div className={`hidden items-center gap-x-4 border-b border-stone-200 px-6 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-stone-400 lg:grid ${COLUMNAS}`}>
        <input type="checkbox" aria-label="Elegir todos los de esta página" checked={pagables.length > 0 && elegidas.size === pagables.length} onChange={() => setElegidas(elegidas.size === pagables.length ? new Set() : new Set(pagables.map((f) => f.id)))} className="h-4 w-4 accent-[#026433]" />
        <span>{filas[0].tipo === "FACTURA" ? "Factura" : "Remito"}</span><span>Cliente</span><span>Fecha</span><span className="text-right">Monto</span><span className="pl-4">Estado</span><span>{filas[0].tipo === "FACTURA" ? "Nota de crédito" : "Pedido"}</span><span />
      </div>
      <ul>
        {filas.map((f) => f.hueco ? (
          <li key={f.id} className={`items-center gap-x-4 px-6 py-2 text-sm text-stone-300 lg:grid ${COLUMNAS}`}>
            <span />
            <span className="tabular-nums">{f.numero}</span>
            <span className="italic">Número sin usar</span>
          </li>
        ) : (
          <Fragment key={f.id}>
            <li className={`items-center gap-x-4 gap-y-1 border-b border-stone-100 px-6 py-4 text-[13px] text-stone-800 transition-colors hover:bg-crema-50 lg:grid ${COLUMNAS} ${f.anulado ? "text-stone-400" : elegidas.has(f.id) ? "bg-crema-100" : ""}`}>
              <input type="checkbox" aria-label={`Elegir ${f.numero ?? "comprobante"}`} checked={elegidas.has(f.id)} disabled={!f.entregado || f.pagada || f.cubierta || !!f.anulado || f.esNc} onChange={() => alternar(f.id)} className="h-4 w-4 accent-[#026433] disabled:opacity-25" />
              <span className={`whitespace-nowrap text-[15px] font-semibold tabular-nums ${f.esNc ? "text-stone-500" : "text-stone-900"}`}>
                {f.numero ?? <span className="text-[13px] font-medium text-rojo-700">sin número</span>}
              </span>
              <span className="min-w-0">
                {f.clienteId ? <Link href={`/cuentas/${f.clienteId}`} className="text-[14px] font-medium text-stone-900 [overflow-wrap:anywhere] hover:underline">{f.cliente}</Link> : <span className="text-[14px] font-medium italic text-rojo-700" title="El CUIT no está cargado en ningún cliente">{f.cliente}</span>}
                {(f.sucursal || f.obs || f.aviso || f.sinPedido) && (
                  <span className="mt-0.5 block text-[12px] leading-snug text-stone-400">
                    {[f.sucursal, f.obs, f.sinPedido ? "sin pedido" : ""].filter(Boolean).join(" · ")}
                    {f.aviso && <span className="block text-rojo-700">{f.aviso}</span>}
                  </span>
                )}
              </span>
              <span className="tabular-nums text-stone-600">
                {fechaCorta(f.cargado)}
                {!f.arca && f.entregado && <span className="block text-[12px] text-stone-400">entrega {fechaCorta(f.fecha)}{!f.pagada && f.vence ? ` · vence ${fechaCorta(f.vence)}` : ""}</span>}
              </span>
              <span className={`text-right text-[15px] font-semibold tabular-nums ${f.cubierta || f.anulado ? "text-stone-300 line-through" : f.esNc ? "text-stone-500" : "text-stone-900"}`}>{f.esNc ? "−" : ""}{formatoPesos(f.cubierta || f.anulado || f.esNc ? f.bruto : f.monto)}</span>
              <span className="pl-4">
                {f.esNc ? (
                  (f.saldo ?? 0) > 0.01
                    ? <button type="button" onClick={() => setPicker(picker === f.id ? null : f.id)} className="text-[13px] font-medium text-rojo-700 underline decoration-rojo-600/40 underline-offset-4 hover:decoration-rojo-700">Aplicar a factura…</button>
                    : <Punto color="bg-stone-300">Aplicada</Punto>
                ) : f.anulado ? (
                  <Punto color="bg-stone-300">{f.anulado}</Punto>
                ) : f.pagada ? (
                  <span className="inline-flex flex-col items-start leading-tight">
                    <Punto color="bg-verde-600">Pagada{f.medio ? ` · ${TEXTO_MEDIO[f.medio] ?? ""}` : ""}</Punto>
                    <button type="button" onClick={() => deshacer(f.id)} className="ml-4 text-[11px] text-stone-400 underline-offset-2 hover:text-rojo-700 hover:underline">deshacer</button>
                  </span>
                ) : f.cubierta ? (
                  <Punto color="bg-stone-300">Anulada por NC</Punto>
                ) : !f.entregado ? (
                  <Punto color="bg-stone-200 ring-1 ring-stone-400">Por entregar</Punto>
                ) : f.atraso > 0 ? (
                  <Punto color="bg-rojo-600">Vencida {f.atraso} {f.atraso === 1 ? "día" : "días"}</Punto>
                ) : (
                  <Punto color="bg-crema-400">Sin pagar</Punto>
                )}
              </span>
              <span className="text-[12.5px] text-stone-500">
                {f.arca ? (
                  f.esNc
                    ? <>{(f.aplicaciones ?? []).map((a) => <span key={a.id} className="mr-2 whitespace-nowrap">→ FACTURA {a.facturaNumero} <button type="button" onClick={() => window.confirm("¿Quitar esta aplicación?") && empezar(async () => { const r = await quitarAplicacionNc(a.id); if (!r.ok) setError(r.error ?? "No se pudo."); router.refresh(); })} className="text-stone-300 underline hover:text-rojo-700">quitar</button></span>)}{(f.aplicaciones ?? []).length === 0 && <span className="text-stone-300">—</span>}</>
                    : f.ncTexto ? <span>{f.ncTexto}{!f.cubierta && f.nc > 0 ? ` (−${formatoPesos(f.nc)})` : ""}</span> : <span className="text-stone-300">—</span>
                ) : f.tipo === "FACTURA" ? (
                  !f.pagada && !f.cubierta && !f.anulado
                    ? <Link href={`/cuentas/${f.clienteId}/nc?factura=${f.id}`} className="text-[12.5px] font-medium text-stone-600 underline decoration-stone-300 underline-offset-4 hover:text-stone-900">+ Nota de crédito</Link>
                    : <span className="text-stone-300">—</span>
                ) : (
                  <Link href={`/pedidos/${f.id}`} className="text-[12.5px] font-medium text-verde-800 underline-offset-4 hover:underline">Abrir pedido ›</Link>
                )}
                {!f.arca && f.ncTexto && <span className="block text-[11.5px] text-stone-400">{f.ncTexto}{!f.cubierta && f.nc > 0 ? ` (−${formatoPesos(f.nc)})` : ""}</span>}
              </span>
              <button type="button" onClick={() => setEditando(editando === f.id ? null : f.id)} aria-label="Observación" title="Observación" className="justify-self-end text-stone-300 hover:text-stone-700">✎</button>
            </li>
            {editando === f.id && (
              <li className="border-b border-stone-100 bg-crema-50 px-6 py-3 lg:pl-[238px]">
                <div className="max-w-xl"><ObsInput id={f.id} inicial={f.obs} arca={f.arca ? { puntoId: f.puntoId ?? null, puntos: f.puntos ?? [] } : undefined} /></div>
              </li>
            )}
            {picker === f.id && f.esNc && (
              <li className="border-b border-stone-100 bg-crema-50 px-6 py-4 text-left text-[13px] lg:pl-[238px]">
                <p className="mb-2 font-medium text-stone-700">¿A qué factura corresponde la {f.numero}? <span className="font-normal text-stone-400">mismo CUIT; primero las del mismo importe</span></p>
                {(() => {
                  const candidatas = filas.filter((x) => x.arca && !x.esNc && x.cuit === f.cuit && (x.saldo ?? 0) > 0.01).sort((a, b) => Number(Math.abs((b.saldo ?? 0) - (f.saldo ?? 0)) < 0.01) - Number(Math.abs((a.saldo ?? 0) - (f.saldo ?? 0)) < 0.01) || (b.numero ?? "").localeCompare(a.numero ?? ""));
                  if (candidatas.length === 0) return <p className="text-stone-500">No hay facturas de este CUIT con saldo.</p>;
                  return (
                    <ul className="max-w-xl">
                      {candidatas.slice(0, 12).map((c) => (
                        <li key={c.id} className="flex items-center gap-4 border-b border-stone-100 py-1.5">
                          <span className="w-36 whitespace-nowrap font-semibold tabular-nums">{c.numero}</span>
                          <span className="w-16 text-stone-400">{fechaCorta(c.fecha)}</span>
                          <span className="w-28 text-right tabular-nums">{formatoPesos(c.saldo ?? 0)}</span>
                          {Math.abs((c.saldo ?? 0) - (f.saldo ?? 0)) < 0.01 && <span className="text-[11.5px] font-medium text-verde-700">mismo importe</span>}
                          <button type="button" disabled={trabajando} onClick={() => window.confirm(`¿Aplicar la ${f.numero} a la ${c.numero} por ${formatoPesos(Math.min(f.saldo ?? 0, c.saldo ?? 0))}?`) && empezar(async () => { const r = await aplicarNc(f.id, c.id); if (!r.ok) setError(r.error ?? "No se pudo."); else setPicker(null); router.refresh(); })} className="ml-auto rounded-md border border-stone-300 bg-white px-3 py-1 text-[12px] font-medium hover:border-stone-700 hover:bg-stone-800 hover:text-white">Aplicar</button>
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </li>
            )}
          </Fragment>
        ))}
      </ul>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 bg-white/95 px-6 py-3 text-sm backdrop-blur">
        <p>{elegidas.size > 0 ? <><span className="font-semibold">{elegidas.size}</span> {elegidas.size === 1 ? "elegido" : "elegidos"} · <span className="font-semibold tabular-nums">{formatoPesos(suma)}</span></> : <span className="text-stone-400">Tildá lo que se pagó.</span>}</p>
        <div className="flex items-center gap-2">
          <select aria-label="Medio de pago" value={medio} onChange={(e) => setMedio(e.target.value)} disabled={elegidas.size === 0} className="h-9 rounded-md border border-stone-300 bg-white px-2 text-sm disabled:opacity-40">
            <option value="" disabled hidden>Pagó con…</option>
            {MEDIOS.map((m) => <option key={m.valor} value={m.valor}>{m.texto}</option>)}
          </select>
          <button type="button" onClick={registrar} disabled={elegidas.size === 0 || trabajando} className="h-9 rounded-md bg-verde-700 px-5 text-sm font-semibold text-white hover:bg-verde-800 disabled:opacity-40">{trabajando ? "Guardando…" : "Registrar pago"}</button>
        </div>
      </div>
      {error && <p className="border-t border-rojo-600 bg-rojo-50 px-6 py-2 text-sm text-rojo-700" role="alert">{error}</p>}
    </div>
  );
}
