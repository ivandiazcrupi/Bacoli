"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatoPesos } from "@/lib/numeros";
import { enlaceWhatsApp } from "@/lib/telefonos";
import { BotonRemito } from "../../BotonRemito";
import { moverPedido } from "../../actions";
import { emitirRemitosDia } from "../../remito/actions";
import { cerrarDia, dejarEnCuentaCorriente, deshacerCobro, guardarNumeroFactura, marcarEntrega, reabrirDia, registrarCobro, type Resultado } from "../actions";

export type Fila = {
  id: string;
  clienteId: string;
  barrio: string;
  cliente: string;
  direccion: string;
  comentario: string;
  telefono: string;
  items: { nombre: string; cantidad: number }[];
  monto: number;
  conFactura: boolean;
  numeroFactura: string;
  estado: "PENDIENTE" | "ENTREGADO" | "NO_ENTREGADO";
  cobro: "COBRADO" | "CUENTA_CORRIENTE" | null;
  medioCobro: string | null;
  tieneDeuda: boolean;
  remito: string | null;
};

const COLUMNAS = "44px 140px 210px 190px 120px minmax(240px,1fr) 110px 100px 120px 120px 230px 110px 140px";
const ENCABEZADOS = ["N°", "Barrio", "Cliente", "Dirección", "Teléfono", "Pedido", "Monto", "Comprobante", "N° factura", "Entrega", "Cobro", "Remito", "Cuenta corriente"];
const MEDIOS: { valor: string; texto: string }[] = [
  { valor: "EFECTIVO", texto: "Efectivo" },
  { valor: "TRANSFERENCIA", texto: "Transferencia" },
  { valor: "CHEQUE", texto: "Cheque" },
  { valor: "MERCADO_PAGO", texto: "Mercado Pago" },
  { valor: "OTRO", texto: "Otro" },
];
const textoMedio = (m: string | null) => MEDIOS.find((x) => x.valor === m)?.texto ?? "";

type Acciones = {
  entrega: (f: Fila, valor: Fila["estado"]) => void;
  cobrar: (f: Fila, medio: string) => void;
  cuentaCorriente: (f: Fila) => void;
  deshacer: (f: Fila) => void;
  factura: (f: Fila, numero: string) => void;
};

function FilaHoja({ f, n, bloqueada, acc }: { f: Fila; n: number; bloqueada: boolean; acc: Acciones }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: f.id, disabled: bloqueada });
  const [eligiendo, setEligiendo] = useState(false);
  const fondo = f.estado === "ENTREGADO" ? "border-verde-600 bg-verde-50" : f.estado === "NO_ENTREGADO" ? "border-rojo-600 bg-rojo-50" : "border-stone-200 bg-white";
  const boton = "h-9 rounded-md border px-2 text-sm font-medium disabled:opacity-40";

  return (
    <div
      ref={setNodeRef}
      role="row"
      style={{ gridTemplateColumns: COLUMNAS, transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={`grid items-start gap-x-3 rounded-lg border px-2 py-2 text-sm ${fondo}`}
    >
      <div role="cell">
        <button type="button" disabled={bloqueada} aria-label={`Mover el pedido ${n}`} className="flex h-8 w-8 cursor-grab items-center justify-center rounded-full bg-stone-800 text-xs font-semibold text-white disabled:cursor-default" {...attributes} {...listeners}>{n}</button>
      </div>
      <div role="cell" className="pt-1.5 font-medium">{f.barrio}</div>
      <div role="cell" className="pt-1.5 font-semibold leading-snug">{f.cliente}</div>
      <div role="cell" className="pt-1.5 leading-snug"><a href={mapa(f)} target="_blank" rel="noreferrer" className="hover:underline">{f.direccion}</a>
        {f.comentario && <p className="text-center text-sm font-medium text-rojo-700">{f.comentario}</p>}{f.comentario && <p className="text-center text-xs font-medium text-rojo-700">{f.comentario}</p>}</div>
      <div role="cell" className="pt-1.5 tabular-nums">
        {f.telefono ? (
          <>
            <span className="block">{f.telefono}</span>
            {enlaceWhatsApp(f.telefono) && <a href={enlaceWhatsApp(f.telefono)!} target="_blank" rel="noreferrer" className="text-xs font-medium text-verde-800 underline">WhatsApp</a>}
          </>
        ) : (
          <span className="text-stone-400">—</span>
        )}
      </div>
      <div role="cell" className="space-y-0.5 pt-1.5">
        {f.items.map((i, k) => (
          <p key={k} className="flex gap-2 leading-snug"><span className="min-w-6 shrink-0 text-right font-semibold tabular-nums">{i.cantidad}</span><span>{i.nombre}</span></p>
        ))}
      </div>
      <div role="cell" className="pt-1.5 text-right font-semibold tabular-nums">{formatoPesos(f.monto)}</div>
      <div role="cell" className="pt-1.5"><span className={`rounded px-2 py-0.5 text-xs font-semibold ${f.conFactura ? "bg-stone-800 text-white" : "bg-stone-200 text-stone-700"}`}>{f.conFactura ? "FACTURA" : "REMITO"}</span></div>
      <div role="cell">
        {f.conFactura ? (
          <input
            aria-label={`Número de factura de ${f.cliente}`}
            defaultValue={f.numeroFactura}
            disabled={bloqueada}
            onBlur={(e) => e.target.value.trim() !== f.numeroFactura && acc.factura(f, e.target.value)}
            className={`h-9 w-full rounded-md border bg-white px-2 tabular-nums disabled:bg-crema-100 ${f.estado === "ENTREGADO" && !f.numeroFactura ? "border-rojo-600 ring-1 ring-rojo-600" : "border-stone-300"}`}
          />
        ) : (
          <span className="block pt-1.5 text-stone-400">—</span>
        )}
      </div>
      <div role="cell" className="space-y-1">
        <div className="flex gap-1">
          <button type="button" disabled={bloqueada} aria-pressed={f.estado === "ENTREGADO"} aria-label="Entregado" onClick={() => acc.entrega(f, f.estado === "ENTREGADO" ? "PENDIENTE" : "ENTREGADO")} className={`${boton} w-14 text-lg ${f.estado === "ENTREGADO" ? "border-verde-700 bg-verde-700 text-white" : "border-stone-300 bg-white text-verde-700"}`}>✓</button>
          <button type="button" disabled={bloqueada} aria-pressed={f.estado === "NO_ENTREGADO"} aria-label="No entregado" onClick={() => acc.entrega(f, f.estado === "NO_ENTREGADO" ? "PENDIENTE" : "NO_ENTREGADO")} className={`${boton} w-14 text-lg ${f.estado === "NO_ENTREGADO" ? "border-rojo-700 bg-rojo-700 text-white" : "border-stone-300 bg-white text-rojo-700"}`}>✗</button>
        </div>
        {f.estado !== "NO_ENTREGADO" && <Link href={`/pedidos/${f.id}`} className="block text-xs text-stone-500 underline">Entrega parcial</Link>}
      </div>
      <div role="cell">
        {f.estado !== "ENTREGADO" ? (
          <span className="block pt-1.5 text-stone-400">—</span>
        ) : f.cobro === "COBRADO" ? (
          <div className="flex items-center justify-between gap-2 rounded-md bg-verde-100 px-2 py-1.5 font-medium text-verde-800">
            <span>Cobrado · {textoMedio(f.medioCobro)}</span>
            {!bloqueada && <button type="button" onClick={() => acc.deshacer(f)} aria-label="Deshacer el cobro" className="text-verde-800 underline">✕</button>}
          </div>
        ) : f.cobro === "CUENTA_CORRIENTE" ? (
          <div className="flex items-center justify-between gap-2 rounded-md bg-crema-200 px-2 py-1.5 font-medium text-verde-900">
            <span>Cuenta corriente</span>
            {!bloqueada && <button type="button" onClick={() => acc.deshacer(f)} aria-label="Deshacer" className="text-verde-900 underline">✕</button>}
          </div>
        ) : eligiendo ? (
          <div className="flex flex-wrap gap-1">
            {MEDIOS.map((m) => (
              <button key={m.valor} type="button" onClick={() => { setEligiendo(false); acc.cobrar(f, m.valor); }} className="h-8 rounded-md border border-verde-700 bg-white px-2 text-xs font-medium text-verde-800">{m.texto}</button>
            ))}
            <button type="button" onClick={() => setEligiendo(false)} aria-label="Cancelar" className="h-8 px-1 text-stone-500">✕</button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1">
            <button type="button" disabled={bloqueada} onClick={() => setEligiendo(true)} className={`${boton} border-verde-700 bg-white text-verde-800`}>Cobrado</button>
            <button type="button" disabled={bloqueada} onClick={() => acc.cuentaCorriente(f)} className={`${boton} border-verde-700 bg-white text-verde-900`}>Cuenta corriente</button>
          </div>
        )}
      </div>
      <div role="cell">
        <BotonRemito pedidoId={f.id} numero={f.remito} clase={`h-9 rounded-md border px-2 text-sm font-medium ${f.remito ? "border-stone-800 bg-white text-stone-900" : f.estado === "ENTREGADO" && !f.conFactura ? "border-rojo-600 bg-rojo-50 text-rojo-800 ring-1 ring-rojo-600" : "border-stone-300 bg-white text-stone-700"}`} />
      </div>
      <div role="cell">
        <Link href={`/clientes/${f.clienteId}/cuenta`} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-stone-300 bg-white px-2 text-sm font-medium hover:bg-crema-100">
          Abrir{f.tieneDeuda && <span className="h-2 w-2 rounded-full bg-rojo-600" title="Este cliente tiene deuda" aria-label="Tiene deuda" />}
        </Link>
      </div>
    </div>
  );
}


const digitos = (t: string) => t.replace(/[^\d+]/g, "");
const mapa = (f: Fila) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${f.direccion}, ${f.barrio}`)}`;

// El mismo pedido, en el celular: una tarjeta con botones grandes (dirección a Google Maps, teléfono que llama).
function FilaTarjeta({ f, n, bloqueada, acc }: { f: Fila; n: number; bloqueada: boolean; acc: Acciones }) {
  const [eligiendo, setEligiendo] = useState(false);
  const fondo = f.estado === "ENTREGADO" ? "border-verde-600 bg-verde-50" : f.estado === "NO_ENTREGADO" ? "border-rojo-600 bg-rojo-50" : "border-stone-200 bg-white";
  const grande = "h-12 rounded-lg border px-3 text-base font-semibold disabled:opacity-40";
  return (
    <article className={`space-y-3 rounded-xl border p-3 ${fondo}`}>
      <header className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-800 text-sm font-semibold text-white">{n}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold leading-snug">{f.cliente}</h3>
          <p className="text-sm text-stone-600">{f.barrio}</p>
        </div>
        <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${f.conFactura ? "bg-stone-800 text-white" : "bg-stone-200 text-stone-700"}`}>{f.conFactura ? "FACTURA" : "REMITO"}</span>
      </header>

      <div className="space-y-1">
        <a href={mapa(f)} target="_blank" rel="noreferrer" className="block text-base font-medium underline">{f.direccion}</a>
        {f.telefono && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <a href={`tel:${digitos(f.telefono)}`} className="inline-flex h-11 items-center rounded-lg border border-stone-300 bg-white px-3 text-base font-medium">Llamar · {f.telefono}</a>
            {enlaceWhatsApp(f.telefono) && <a href={enlaceWhatsApp(f.telefono)!} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center rounded-lg border border-verde-700 bg-white px-3 text-base font-medium text-verde-800">WhatsApp</a>}
          </div>
        )}
      </div>

      <ul className="space-y-0.5 rounded-lg bg-white/70 p-2 text-base">
        {f.items.map((i, k) => (
          <li key={k} className="flex gap-3"><span className="w-8 shrink-0 text-right font-bold tabular-nums">{i.cantidad}</span><span>{i.nombre}</span></li>
        ))}
      </ul>
      <p className="flex items-baseline justify-between text-lg font-bold"><span className="text-sm font-medium text-stone-600">Monto</span><span className="tabular-nums">{formatoPesos(f.monto)}</span></p>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={bloqueada} aria-pressed={f.estado === "ENTREGADO"} onClick={() => acc.entrega(f, f.estado === "ENTREGADO" ? "PENDIENTE" : "ENTREGADO")} className={`${grande} ${f.estado === "ENTREGADO" ? "border-verde-700 bg-verde-700 text-white" : "border-verde-700 bg-white text-verde-800"}`}>✓ Entregado</button>
        <button type="button" disabled={bloqueada} aria-pressed={f.estado === "NO_ENTREGADO"} onClick={() => acc.entrega(f, f.estado === "NO_ENTREGADO" ? "PENDIENTE" : "NO_ENTREGADO")} className={`${grande} ${f.estado === "NO_ENTREGADO" ? "border-rojo-700 bg-rojo-700 text-white" : "border-rojo-700 bg-white text-rojo-800"}`}>✗ No entregado</button>
      </div>
      {f.estado !== "NO_ENTREGADO" && <Link href={`/pedidos/${f.id}`} className="block text-sm text-stone-600 underline">Entrega parcial</Link>}

      {f.estado === "ENTREGADO" && (
        <div className="space-y-2">
          {f.cobro === "COBRADO" ? (
            <div className="flex items-center justify-between rounded-lg bg-verde-100 px-3 py-3 font-semibold text-verde-800"><span>Cobrado · {textoMedio(f.medioCobro)}</span>{!bloqueada && <button type="button" onClick={() => acc.deshacer(f)} aria-label="Deshacer el cobro" className="px-2 text-xl">✕</button>}</div>
          ) : f.cobro === "CUENTA_CORRIENTE" ? (
            <div className="flex items-center justify-between rounded-lg bg-crema-200 px-3 py-3 font-semibold text-verde-900"><span>Cuenta corriente</span>{!bloqueada && <button type="button" onClick={() => acc.deshacer(f)} aria-label="Deshacer" className="px-2 text-xl">✕</button>}</div>
          ) : eligiendo ? (
            <div className="grid grid-cols-2 gap-2">
              {MEDIOS.map((m) => <button key={m.valor} type="button" onClick={() => { setEligiendo(false); acc.cobrar(f, m.valor); }} className="h-12 rounded-lg border border-verde-700 bg-white font-semibold text-verde-800">{m.texto}</button>)}
              <button type="button" onClick={() => setEligiendo(false)} className="h-12 rounded-lg border border-stone-300 bg-white text-stone-600">Cancelar</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={bloqueada} onClick={() => setEligiendo(true)} className={`${grande} border-verde-700 bg-white text-verde-800`}>Cobrado</button>
              <button type="button" disabled={bloqueada} onClick={() => acc.cuentaCorriente(f)} className={`${grande} border-verde-700 bg-white text-verde-900`}>Cuenta corriente</button>
            </div>
          )}
        </div>
      )}

      {f.conFactura && (
        <label className="block text-sm font-medium">
          N° de factura
          <input
            defaultValue={f.numeroFactura}
            disabled={bloqueada}
            inputMode="numeric"
            onBlur={(e) => e.target.value.trim() !== f.numeroFactura && acc.factura(f, e.target.value)}
            className={`mt-1 h-12 w-full rounded-lg border bg-white px-3 text-base tabular-nums ${f.estado === "ENTREGADO" && !f.numeroFactura ? "border-rojo-600 ring-1 ring-rojo-600" : "border-stone-300"}`}
          />
        </label>
      )}

      <div className="grid grid-cols-2 gap-2">
        <BotonRemito pedidoId={f.id} numero={f.remito} clase={`h-12 w-full rounded-lg border px-3 text-base font-semibold ${f.remito ? "border-stone-800 bg-white text-stone-900" : f.estado === "ENTREGADO" && !f.conFactura ? "border-rojo-600 bg-rojo-50 text-rojo-800 ring-1 ring-rojo-600" : "border-stone-300 bg-white text-stone-700"}`} />
        <Link href={`/clientes/${f.clienteId}/cuenta`} className="flex h-12 items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-3 text-base font-semibold">
          Cuenta corriente{f.tieneDeuda && <span className="h-2.5 w-2.5 rounded-full bg-rojo-600" aria-label="Tiene deuda" />}
        </Link>
      </div>
    </article>
  );
}

export function HojaDia({ fecha, filasIniciales, cerrado, esDueno }: { fecha: string; filasIniciales: Fila[]; cerrado: boolean; esDueno: boolean }) {
  const router = useRouter();
  const [filas, setFilas] = useState(filasIniciales);
  const [error, setError] = useState<string | null>(null);
  const [, empezar] = useTransition();
  useEffect(() => setFilas(filasIniciales), [filasIniciales]);

  const sensores = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }));

  // Aplica el cambio en pantalla al instante y lo guarda; si el servidor lo rechaza, vuelve atrás y avisa.
  const ejecutar = (id: string, cambio: (f: Fila) => Fila, guardar: () => Promise<Resultado>) => {
    const antes = filas;
    setError(null);
    setFilas((fs) => fs.map((f) => (f.id === id ? cambio(f) : f)));
    empezar(async () => {
      const r = await guardar();
      if (!r.ok) {
        setFilas(antes);
        setError(r.error ?? "No se pudo guardar.");
      }
      router.refresh();
    });
  };

  const acc: Acciones = {
    entrega: (f, valor) => ejecutar(f.id, (x) => ({ ...x, estado: valor, ...(valor !== "ENTREGADO" ? { cobro: null, medioCobro: null } : {}) }), () => marcarEntrega(f.id, valor)),
    cobrar: (f, medio) => ejecutar(f.id, (x) => ({ ...x, cobro: "COBRADO", medioCobro: medio }), () => registrarCobro(f.id, medio)),
    cuentaCorriente: (f) => ejecutar(f.id, (x) => ({ ...x, cobro: "CUENTA_CORRIENTE" }), () => dejarEnCuentaCorriente(f.id)),
    deshacer: (f) => ejecutar(f.id, (x) => ({ ...x, cobro: null, medioCobro: null }), () => deshacerCobro(f.id)),
    factura: (f, numero) => ejecutar(f.id, (x) => ({ ...x, numeroFactura: numero.trim() }), () => guardarNumeroFactura(f.id, numero)),
  };

  const alSoltar = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const antes = filas;
    const viejo = filas.findIndex((f) => f.id === e.active.id);
    const nuevo = filas.findIndex((f) => f.id === e.over!.id);
    const orden = arrayMove(filas, viejo, nuevo);
    setFilas(orden);
    setError(null);
    empezar(async () => {
      const r = await moverPedido(String(e.active.id), fecha, orden.map((f) => f.id));
      if (!r.ok) {
        setFilas(antes);
        setError(r.error ?? "No se pudo reordenar.");
      }
    });
  };

  const sinEntrega = filas.filter((f) => f.estado === "PENDIENTE").length;
  const sinCobro = filas.filter((f) => f.estado === "ENTREGADO" && f.cobro === null).length;
  const sinNumero = filas.filter((f) => f.estado === "ENTREGADO" && (f.conFactura ? !f.numeroFactura : !f.remito)).length;
  const completo = filas.length > 0 && sinEntrega === 0 && sinCobro === 0 && sinNumero === 0;
  const verdes = filas.filter((f) => f.estado === "ENTREGADO").length;
  const rojos = filas.filter((f) => f.estado === "NO_ENTREGADO").length;

  const cerrar = () => {
    if (!window.confirm("Al cerrar el día, los pedidos en rojo (no entregados) vuelven a “Sin asignar” y el día queda de solo lectura. ¿Cerrar el día?")) return;
    empezar(async () => {
      const r = await cerrarDia(fecha);
      if (!r.ok) setError(r.error ?? "No se pudo cerrar el día.");
      router.refresh();
    });
  };
  const imprimirTodos = async () => {
    const ventana = window.open("", "_blank");
    const r = await emitirRemitosDia(fecha);
    if (!r.ok) {
      ventana?.close();
      setError(r.error ?? "No se pudieron emitir los remitos.");
      return;
    }
    if (ventana) ventana.location.href = `/pedidos/dia/${fecha}/remitos`;
    router.refresh();
  };
  const reabrir = () => {
    empezar(async () => {
      const r = await reabrirDia(fecha);
      if (!r.ok) setError(r.error ?? "No se pudo reabrir.");
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-3 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-stone-700">
          {filas.length} {filas.length === 1 ? "pedido" : "pedidos"} · <span className="font-semibold text-verde-700">{verdes} {verdes === 1 ? "entregado" : "entregados"}</span> · <span className="font-semibold text-rojo-700">{rojos} {rojos === 1 ? "no entregado" : "no entregados"}</span>
          {!cerrado && !completo && filas.length > 0 && (
            <span className="text-stone-600"> · falta marcar {[
              sinEntrega > 0 && `${sinEntrega} ${sinEntrega === 1 ? "entrega" : "entregas"}`,
              sinCobro > 0 && `${sinCobro} ${sinCobro === 1 ? "cobro" : "cobros"}`,
              sinNumero > 0 && `${sinNumero} ${sinNumero === 1 ? "número" : "números"} de factura o remito`,
            ].filter(Boolean).join(", ")}</span>
          )}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        {filas.length > 0 && <button type="button" onClick={imprimirTodos} className="rounded-lg border border-stone-300 bg-white px-3 py-3 font-medium sm:py-2">Imprimir todos los remitos</button>}
        {cerrado ? (
          <div className="flex items-center gap-3">
            <span className="rounded-md bg-stone-800 px-3 py-1.5 font-semibold text-white">Día cerrado</span>
            {esDueno && <button type="button" onClick={reabrir} className="rounded-lg border border-stone-300 bg-white px-3 py-2 font-medium">Reabrir día</button>}
          </div>
        ) : (
          <button type="button" onClick={cerrar} disabled={!completo} className="rounded-lg bg-stone-800 px-4 py-3 font-semibold text-white disabled:opacity-40 sm:py-2">Cerrar día</button>
        )}
        </div>
      </div>
      {error && <p className="rounded-lg border border-rojo-600 bg-rojo-50 p-3 text-sm text-rojo-700" role="alert">{error}</p>}

      {filas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-stone-600">Todavía no hay pedidos en este día. Asignalos desde la semana.</p>
      ) : (
        <>
        <div className="space-y-3 lg:hidden">
          {filas.map((f, n) => <FilaTarjeta key={f.id} f={f} n={n + 1} bloqueada={cerrado} acc={acc} />)}
        </div>
        <div className="hidden overflow-x-auto pb-4 lg:block">
          <div role="table" className="min-w-[1870px] space-y-2">
            <div role="row" style={{ gridTemplateColumns: COLUMNAS }} className="grid gap-x-3 px-2 text-xs font-semibold text-stone-500">
              {ENCABEZADOS.map((h) => <div key={h} role="columnheader" className={h === "Monto" ? "text-right" : ""}>{h}</div>)}
            </div>
            <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={alSoltar}>
              <SortableContext items={filas.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                {filas.map((f, n) => <FilaHoja key={f.id} f={f} n={n + 1} bloqueada={cerrado} acc={acc} />)}
              </SortableContext>
            </DndContext>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
