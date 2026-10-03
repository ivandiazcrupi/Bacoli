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
  aplicaciones?: { id: string; facturaNumero: number; monto: number }[];
};

const MEDIOS = [
  { valor: "EFECTIVO", texto: "Efectivo" },
  { valor: "TRANSFERENCIA", texto: "Transferencia" },
  { valor: "CHEQUE", texto: "Cheque" },
  { valor: "OTRO", texto: "Otro" },
];
const TEXTO_MEDIO: Record<string, string> = { EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia", CHEQUE: "Cheque", MERCADO_PAGO: "Mercado Pago", OTRO: "Otro" };
const COLUMNAS = "grid-cols-[28px_132px_minmax(150px,1.6fr)_76px_76px_116px_76px_150px_140px_minmax(170px,1.2fr)]";
const fechaCorta = (s: string) => `${s.slice(8)}/${s.slice(5, 7)}/${s.slice(2, 4)}`;

const pastilla = (clase: string) => `inline-block whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-semibold ${clase}`;

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

  if (filas.length === 0) return <p className="p-8 text-center text-stone-600">No hay comprobantes con ese filtro.</p>;

  return (
    <div>
      <div className={`hidden items-center gap-x-3 border-b border-stone-300 bg-crema-200 px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-stone-700 lg:grid ${COLUMNAS}`}>
        <input type="checkbox" aria-label="Elegir todos los de esta página" checked={pagables.length > 0 && elegidas.size === pagables.length} onChange={() => setElegidas(elegidas.size === pagables.length ? new Set() : new Set(pagables.map((f) => f.id)))} className="h-4 w-4 accent-[#ede6c8]" />
        <span>{filas[0].tipo === "FACTURA" ? "FACTURA" : "REMITO"}</span><span className="text-left">Cliente</span><span>Cargado</span><span>Entrega</span><span>Monto</span><span>Vence</span><span>Estado</span><span>{filas[0].tipo === "FACTURA" ? "Nota de crédito" : "Pedido"}</span><span>Observación</span>
      </div>
      <ul className="divide-y divide-stone-300">
        {filas.map((f) => f.hueco ? (
          <li key={f.id} className={`items-center gap-x-3 px-4 py-1.5 text-center text-sm text-stone-400 lg:grid ${COLUMNAS}`}>
            <span />
            <span className="font-semibold tabular-nums">{f.numero}</span>
            <span className="text-left italic">Número sin usar</span>
          </li>
        ) : (
          <Fragment key={f.id}>
          <li className={`items-center gap-x-3 gap-y-1 px-4 py-3.5 text-center text-[13px] text-stone-800 lg:grid ${COLUMNAS} ${f.anulado ? "bg-stone-100 text-stone-500" : elegidas.has(f.id) ? "bg-crema-100" : ""}`}>
            <input type="checkbox" aria-label={`Elegir ${f.numero ?? "comprobante"}`} checked={elegidas.has(f.id)} disabled={!f.entregado || f.pagada || f.cubierta || !!f.anulado || f.esNc} onChange={() => alternar(f.id)} className="h-4 w-4 accent-[#026433] disabled:opacity-30" />
            <span className="whitespace-nowrap text-[13.5px] font-bold tabular-nums text-stone-900">{f.esNc && <span className="mr-1.5 rounded bg-stone-700 px-1.5 py-0.5 text-[11px] font-bold text-white">NC</span>}{f.numero ?? <span className="text-[13px] font-semibold text-rojo-700">sin número</span>}</span>
            <span className="min-w-0 text-left">
              {f.clienteId ? <Link href={`/cuentas/${f.clienteId}`} className="text-[13px] font-semibold leading-snug text-stone-900 [overflow-wrap:anywhere] hover:underline">{f.cliente}</Link> : <span className="text-[13px] font-semibold italic text-rojo-700" title="El CUIT no está cargado en ningún cliente">{f.cliente}</span>}
              {f.sucursal && <span className="text-[12px] text-stone-500"> · {f.sucursal}</span>}
              {f.aviso && <span className="block text-[11.5px] leading-snug text-rojo-700">{f.aviso}</span>}
            </span>
            <span className="tabular-nums">{fechaCorta(f.cargado)}</span>
            <span className="tabular-nums">{f.entregado && !f.arca ? fechaCorta(f.fecha) : <span className="text-stone-400">—</span>}</span>
            <span className={`text-[13px] font-bold tabular-nums ${f.cubierta || f.anulado ? "text-stone-400 line-through" : f.esNc ? "text-stone-500" : "text-stone-900"}`}>{f.esNc ? "−" : ""}{formatoPesos(f.cubierta || f.anulado || f.esNc ? f.bruto : f.monto)}</span>
            <span className="tabular-nums">{f.entregado && !f.pagada && f.vence ? fechaCorta(f.vence) : <span className="text-stone-400">—</span>}</span>
            <span className="flex flex-col items-center gap-0.5">
              {f.esNc ? (
                (f.saldo ?? 0) > 0.01
                  ? <button type="button" onClick={() => setPicker(picker === f.id ? null : f.id)} className={pastilla("border border-rojo-600 bg-rojo-50 text-rojo-700 hover:bg-rojo-100")}>Aplicar a factura…</button>
                  : <span className={pastilla("bg-stone-200 text-stone-700")}>Aplicada</span>
              ) : f.anulado ? (
                <span className={pastilla("bg-stone-200 text-stone-700")}>{f.anulado}</span>
              ) : f.pagada ? (
                <>
                  <span className={pastilla("bg-verde-100 text-verde-800")}>Pagada · {TEXTO_MEDIO[f.medio ?? ""] ?? ""}</span>
                  <button type="button" onClick={() => deshacer(f.id)} className="text-xs text-stone-500 underline hover:text-rojo-700">deshacer</button>
                </>
              ) : f.cubierta ? (
                <span className={pastilla("bg-stone-200 text-stone-700")}>Anulada por NC</span>
              ) : !f.entregado ? (
                <span className={pastilla("border border-stone-300 bg-white text-stone-600")}>Por entregar</span>
              ) : f.atraso > 0 ? (
                <span className={pastilla("bg-rojo-50 text-rojo-700 border border-rojo-600")}>Vencida {f.atraso} {f.atraso === 1 ? "día" : "días"}</span>
              ) : (
                <span className={pastilla("bg-crema-200 text-stone-800")}>Sin pagar</span>
              )}
            </span>
            <span>
              {f.arca ? (
                f.esNc
                  ? <span className="text-[12px] text-stone-600">{(f.aplicaciones ?? []).map((a) => <span key={a.id} className="mr-2 whitespace-nowrap">→ FACTURA {a.facturaNumero} <button type="button" onClick={() => window.confirm("¿Quitar esta aplicación?") && empezar(async () => { const r = await quitarAplicacionNc(a.id); if (!r.ok) setError(r.error ?? "No se pudo."); router.refresh(); })} className="text-stone-400 underline hover:text-rojo-700">quitar</button></span>)}{(f.aplicaciones ?? []).length === 0 && <span className="text-stone-300">—</span>}</span>
                  : f.ncTexto ? <span className="rounded bg-stone-200 px-2 py-1 text-xs font-semibold text-stone-700">{f.ncTexto}{!f.cubierta && f.nc > 0 ? ` (−${formatoPesos(f.nc)})` : ""}</span> : <span className="text-stone-300">—</span>
              ) : f.tipo === "FACTURA" ? (
                !f.pagada && !f.cubierta && !f.anulado
                  ? <Link href={`/cuentas/${f.clienteId}/nc?factura=${f.id}`} className="inline-block rounded-md border border-stone-500 bg-white px-3 py-1.5 text-[12px] font-semibold text-stone-800 hover:bg-stone-800 hover:text-white">+ Nota de crédito</Link>
                  : <span className="text-stone-300">—</span>
              ) : (
                <Link href={`/pedidos/${f.id}`} className="text-[12px] font-semibold text-verde-800 underline-offset-4 hover:underline">Abrir pedido ›</Link>
              )}
            </span>
            <span className="flex min-w-0 flex-col items-stretch gap-1">
              {!f.arca && f.ncTexto && <span className="truncate rounded bg-stone-200 px-2 py-1 text-xs font-semibold text-stone-700" title="Se completa solo al aplicar la nota de crédito">{f.ncTexto}{!f.cubierta && f.nc > 0 ? ` (−${formatoPesos(f.nc)})` : ""}</span>}
              <ObsInput id={f.id} inicial={f.obs} arca={f.arca ? { puntoId: f.puntoId ?? null, puntos: f.puntos ?? [] } : undefined} />
            </span>
          </li>
          {picker === f.id && f.esNc && (
            <li className="bg-crema-100 px-4 py-3 text-left text-[13px]">
              <p className="mb-1 font-semibold text-stone-700">¿A qué factura corresponde la NC {f.numero?.replace("NC ", "")}? <span className="font-normal text-stone-500">(mismo CUIT; primero las del mismo importe)</span></p>
              {(() => {
                const candidatas = filas.filter((x) => x.arca && !x.esNc && x.cuit === f.cuit && (x.saldo ?? 0) > 0.01).sort((a, b) => Number(Math.abs((b.saldo ?? 0) - (f.saldo ?? 0)) < 0.01) - Number(Math.abs((a.saldo ?? 0) - (f.saldo ?? 0)) < 0.01) || (b.numero ?? "").localeCompare(a.numero ?? ""));
                if (candidatas.length === 0) return <p className="text-stone-500">No hay facturas de este CUIT con saldo.</p>;
                return (
                  <ul className="max-w-xl">
                    {candidatas.slice(0, 12).map((c) => (
                      <li key={c.id} className="flex items-center gap-3 border-b border-stone-200 py-1">
                        <span className="w-36 whitespace-nowrap font-bold tabular-nums">{c.numero}</span>
                        <span className="w-16 text-stone-500">{fechaCorta(c.fecha)}</span>
                        <span className="w-28 text-right tabular-nums">{formatoPesos(c.saldo ?? 0)}</span>
                        {Math.abs((c.saldo ?? 0) - (f.saldo ?? 0)) < 0.01 && <span className="text-[11px] font-semibold text-verde-700">mismo importe</span>}
                        <button type="button" disabled={trabajando} onClick={() => window.confirm(`¿Aplicar la ${f.numero} a la ${c.numero} por ${formatoPesos(Math.min(f.saldo ?? 0, c.saldo ?? 0))}?`) && empezar(async () => { const r = await aplicarNc(f.id, c.id); if (!r.ok) setError(r.error ?? "No se pudo."); else setPicker(null); router.refresh(); })} className="ml-auto rounded-md border border-stone-500 bg-white px-3 py-1 text-[12px] font-semibold hover:bg-stone-800 hover:text-white">Aplicar</button>
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

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-stone-300 bg-crema-100 px-4 py-3 text-sm">
        <p>{elegidas.size > 0 ? <><span className="font-semibold">{elegidas.size}</span> {elegidas.size === 1 ? "comprobante elegido" : "comprobantes elegidos"} · <span className="font-bold tabular-nums">{formatoPesos(suma)}</span></> : <span className="text-stone-600">Tildá los comprobantes entregados que pagaron.</span>}</p>
        <div className="flex items-center gap-2">
          <select aria-label="Medio de pago" value={medio} onChange={(e) => setMedio(e.target.value)} disabled={elegidas.size === 0} className="h-9 rounded-md border border-stone-400 bg-white px-2 text-sm shadow-sm disabled:opacity-50">
            <option value="" disabled hidden>Pagó con…</option>
            {MEDIOS.map((m) => <option key={m.valor} value={m.valor}>{m.texto}</option>)}
          </select>
          <button type="button" onClick={registrar} disabled={elegidas.size === 0 || trabajando} className="h-9 rounded-md bg-verde-700 px-4 text-sm font-semibold text-white hover:bg-verde-800 disabled:opacity-50">{trabajando ? "Guardando…" : "Registrar pago"}</button>
        </div>
      </div>
      {error && <p className="border-t border-rojo-600 bg-rojo-50 px-4 py-2 text-sm text-rojo-700" role="alert">{error}</p>}
    </div>
  );
}
