"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { EstadoPagoWeb } from "@/components/EstadoPagoWeb";
import { formatoPesos } from "@/lib/numeros";
import { enlaceWhatsApp } from "@/lib/telefonos";
import { asignarADia, marcarPagoWeb } from "./actions";
import type { FilaBandeja } from "./filas";

export type DiaBoton = { fecha: string; letra: string; numero: number; nombre: string; hoy: boolean; cerrado: boolean };

const COLUMNAS = "lg:grid-cols-[1fr_1.5fr_1.4fr_1fr_2fr_7rem_5.5rem_4.5rem_16rem]";
const ENCABEZADOS = ["Barrio", "Cliente", "Dirección", "Teléfono", "Pedido", "Monto", "Factura", "", "Asignar"];

function Comprobante({ conFactura }: { conFactura: boolean }) {
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold tracking-wide ${conFactura ? "bg-stone-700 text-white" : "bg-crema-200 text-stone-700"}`}>{conFactura ? "FACTURA" : "REMITO"}</span>;
}

function Telefono({ tel }: { tel: string }) {
  if (!tel) return <span className="text-stone-400">—</span>;
  const wa = enlaceWhatsApp(tel);
  return wa ? <a href={wa} target="_blank" rel="noreferrer" className="hover:text-verde-800 hover:underline">{tel}</a> : <span>{tel}</span>;
}

// PEDIDOS: lo cargado que espera día. Al tocar L M M J V S el pedido se MUEVE a ese día (sale de esta lista, como el cortar y pegar de la planilla).
export function Bandeja({ filas: iniciales, dias }: { filas: FilaBandeja[]; dias: DiaBoton[] }) {
  const router = useRouter();
  const [filas, setFilas] = useState(iniciales);
  const [error, setError] = useState<string | null>(null);
  const [, empezar] = useTransition();
  useEffect(() => setFilas(iniciales), [iniciales]);

  const asignar = (f: FilaBandeja, fecha: string) => {
    const antes = filas;
    setError(null);
    setFilas((x) => x.filter((y) => y.id !== f.id));
    empezar(async () => {
      const r = await asignarADia(f.id, fecha);
      if (!r.ok) {
        setFilas(antes);
        setError(r.error ?? "No se pudo asignar.");
      }
      router.refresh();
    });
  };

  // Confirmar o deshacer el pago de la tienda: siempre pide confirmar, con el nombre y el monto a la vista.
  const cambiarPago = (f: FilaBandeja, pagado: boolean) => {
    const texto = pagado
      ? `¿Confirmás que YA LLEGÓ la transferencia de ${formatoPesos(f.monto)} de ${f.cliente}?\n\nRevisá que esté acreditada en la cuenta. Se puede deshacer mientras el pedido no se entregue.`
      : `¿Volver a "pendiente de pago" el pedido de ${f.cliente}?`;
    if (!window.confirm(texto)) return;
    setError(null);
    empezar(async () => {
      const r = await marcarPagoWeb(f.id, pagado);
      if (!r.ok) setError(r.error ?? "No se pudo cambiar el pago.");
      router.refresh();
    });
  };

  const botones = (f: FilaBandeja, grande?: boolean) => (
    <div className="flex flex-col items-center gap-1.5">
    {f.webOrden && !f.pagoMp && (
      <button type="button" onClick={() => cambiarPago(f, true)} className="rounded-md border border-stone-500 bg-white px-2 py-1 text-xs font-semibold text-stone-800 hover:bg-stone-800 hover:text-white">
        Confirmar pago…
      </button>
    )}
    {f.webOrden && f.pagoMp && f.pagoTexto === "Transferencia" && (
      <button type="button" onClick={() => cambiarPago(f, false)} className="text-xs text-stone-500 underline underline-offset-2 hover:text-rojo-700">Deshacer pago</button>
    )}
    <div className="flex gap-1.5" role="group" aria-label="Asignar a un día">
      {dias.map((d) => (
        <button
          key={d.fecha}
          type="button"
          disabled={d.cerrado}
          onClick={() => asignar(f, d.fecha)}
          title={d.cerrado ? `${d.nombre} ${d.numero}: día cerrado o ya pasó` : `Asignar al ${d.nombre.toLowerCase()} ${d.numero}`}
          aria-label={`Asignar al ${d.nombre.toLowerCase()} ${d.numero}`}
          className={`flex flex-col items-center justify-center gap-[3px] rounded-md border shadow-sm transition hover:border-verde-700 hover:bg-verde-700 hover:text-white disabled:opacity-35 ${grande ? "h-14 w-12" : "h-12 w-10"} border-stone-400 bg-white text-stone-800`}
        >
          <span className={`block font-bold leading-none ${grande ? "text-lg" : "text-[15px]"}`}>{d.letra}</span>
          <span className="block text-[11px] font-medium leading-none opacity-70">{d.numero}</span>
        </button>
      ))}
    </div>
    </div>
  );

  if (filas.length === 0) {
    return <p className="rounded-lg border border-dashed border-stone-400 p-10 text-center text-stone-600">No hay pedidos esperando día. Los pedidos nuevos aparecen acá.</p>;
  }

  return (
    <div className="space-y-2">
      {error && <p className="rounded-lg border border-rojo-600 bg-rojo-50 p-3 text-sm text-rojo-700" role="alert">{error}</p>}
      <div className={`hidden gap-x-4 rounded-t-xl border border-stone-300 bg-crema-200 px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-stone-700 lg:grid ${COLUMNAS}`}>
        {ENCABEZADOS.map((h, i) => <span key={i} className="text-center">{h}</span>)}
      </div>
      {filas.map((f) => (
        <div key={f.id} className="rounded-xl border border-stone-300 bg-white px-5 py-3.5 shadow-sm">
          <div className={`hidden items-center gap-x-4 text-center lg:grid ${COLUMNAS}`}>
            <span className="text-sm font-semibold">{f.barrio}</span>
            <span className="text-sm font-semibold leading-snug">
              {f.cliente}
              <EstadoPagoWeb webOrden={f.webOrden} pagado={f.pagoMp} medio={f.pagoTexto} />
            </span>
            <span className="text-sm leading-snug">
              {f.direccion}
              {f.comentario && <span className="mt-0.5 block text-xs font-medium text-rojo-700">{f.comentario}</span>}
              {f.intento && <span className="mt-0.5 block text-xs font-semibold text-stone-600">↺ {f.intento}</span>}
            </span>
            <span className="text-sm tabular-nums"><Telefono tel={f.telefono} /></span>
            <span className="inline-grid justify-center justify-self-center gap-x-2 gap-y-0.5 text-left text-sm [grid-template-columns:auto_auto]">
              {f.items.map((i, k) => (
                <span key={k} className="contents"><span className="text-right font-semibold tabular-nums">{i.cantidad}</span><span className="leading-snug">{i.nombre}</span></span>
              ))}
            </span>
            <span className="text-sm font-semibold tabular-nums">{formatoPesos(f.monto)}</span>
            <span><Comprobante conFactura={f.conFactura} /></span>
            <Link href={`/pedidos/${f.id}`} className="text-sm font-semibold text-verde-800 underline-offset-4 hover:underline">Abrir ›</Link>
            <div className="flex justify-center">{botones(f)}</div>
          </div>

          <div className="space-y-3 lg:hidden">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{f.barrio}</p>
                <p className="font-semibold">{f.cliente}</p>
                <EstadoPagoWeb webOrden={f.webOrden} pagado={f.pagoMp} medio={f.pagoTexto} />
                <p className="text-sm">{f.direccion}</p>
                {f.comentario && <p className="text-sm font-medium text-rojo-700">{f.comentario}</p>}
                {f.intento && <p className="text-sm font-semibold text-stone-600">↺ {f.intento}</p>}
                {f.telefono && <p className="text-sm tabular-nums"><Telefono tel={f.telefono} /></p>}
              </div>
              <Comprobante conFactura={f.conFactura} />
            </div>
            <ul className="space-y-0.5 rounded-lg bg-crema-50 p-2 text-sm">
              {f.items.map((i, k) => <li key={k} className="flex gap-2"><span className="w-7 shrink-0 text-right font-semibold tabular-nums">{i.cantidad}</span><span>{i.nombre}</span></li>)}
            </ul>
            <p className="flex items-center justify-between"><b className="tabular-nums">{formatoPesos(f.monto)}</b><Link href={`/pedidos/${f.id}`} className="text-sm font-semibold text-verde-800">Abrir ›</Link></p>
            {botones(f, true)}
          </div>
        </div>
      ))}
    </div>
  );
}
