"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { DndContext, MouseSensor, TouchSensor, closestCenter, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type CollisionDetection, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatoPesos } from "@/lib/numeros";
import { enlaceWhatsApp } from "@/lib/telefonos";
import { BotonRemito } from "../../BotonRemito";
import { asignarADia } from "../../actions";
import { agregarSalida, asignarAVehiculo, devolverAPedidos, ordenarSalida, quitarSalida } from "../../ruta/actions";
import { emitirRemitosDia } from "../../remito/actions";
import { dejarEnCuentaCorriente, deshacerCobro, guardarNumeroFactura, marcarEntrega, reabrirDia, registrarCobro, type Resultado } from "../actions";

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
  salidaId: string | null;
  bultos: number;
};

export type SalidaInfo = { id: string; nombre: string; patente: string; capacidad: number | null; repartidorId: string };
export type Opcion = { id: string; nombre: string };

// Todo entra a lo ancho (sin deslizar): columnas justas y todo centrado.
const COLUMNAS = "34px 80px minmax(120px,1.2fr) minmax(110px,1fr) 96px minmax(130px,1.4fr) 92px 96px 52px 112px 104px 84px";
const ENCABEZADOS = ["N°", "Barrio", "Cliente", "Dirección", "Teléfono", "Pedido", "Monto", "Comprobante", "Entrega", "Cobro", "Ubicación", "Editar pedido"];
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
  mover: (f: Fila, destino: string) => void; // "sin" = sin vehículo, "pedidos" = vuelve a Pedidos, "dia:AAAA-MM-DD" = otro día, otro = id de la salida
  dias: { fecha: string; texto: string }[];
};

const estiloSelect = (clase: string) => `${clase} rounded-md border border-stone-400 bg-white px-1.5 text-sm font-medium shadow-sm disabled:opacity-40`;

function SelectorUbicar({ f, salidas, bloqueada, acc, clase }: { f: Fila; salidas: SalidaInfo[]; bloqueada: boolean; acc: Acciones; clase: string }) {
  return (
    <select aria-label="Ubicar en un vehículo" disabled={bloqueada || f.estado === "ENTREGADO"} value="" onChange={(e) => e.target.value && acc.mover(f, e.target.value)} className={estiloSelect(clase)}>
      <option value="" disabled hidden>Ubicar en…</option>
      {f.salidaId !== null && <option value="sin">Sin ubicar</option>}
      {salidas.filter((x) => x.id !== f.salidaId).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
    </select>
  );
}

function SelectorDia({ f, bloqueada, acc, clase }: { f: Fila; bloqueada: boolean; acc: Acciones; clase: string }) {
  return (
    <select aria-label="Pasar a otro día" disabled={bloqueada || f.estado === "ENTREGADO"} value="" onChange={(e) => e.target.value && acc.mover(f, e.target.value)} className={estiloSelect(clase)}>
      <option value="" disabled hidden>Pasar al día…</option>
      {acc.dias.map((d) => <option key={d.fecha} value={`dia:${d.fecha}`}>{d.texto}</option>)}
      <option value="pedidos">Volver a Pedidos</option>
    </select>
  );
}

// Los dos desplegables juntos (tarjetas del celular).
function Selectores({ f, salidas, bloqueada, acc, clase }: { f: Fila; salidas: SalidaInfo[]; bloqueada: boolean; acc: Acciones; clase: string }) {
  return (
    <>
      <SelectorUbicar f={f} salidas={salidas} bloqueada={bloqueada} acc={acc} clase={clase} />
      <SelectorDia f={f} bloqueada={bloqueada} acc={acc} clase={clase} />
    </>
  );
}

function FilaHoja({ f, n, bloqueada, acc, salidas }: { f: Fila; n: number; bloqueada: boolean; acc: Acciones; salidas: SalidaInfo[] }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: f.id, disabled: bloqueada });
  const entregado = f.estado === "ENTREGADO";
  const noEntregado = f.estado === "NO_ENTREGADO";
  const falta = entregado && (f.conFactura ? !f.numeroFactura : !f.remito); // ya entregado y sin su número de comprobante
  const marca = "flex h-6 w-9 items-center justify-center rounded border text-sm font-bold disabled:opacity-40";

  return (
    <div
      ref={setNodeRef}
      role="row"
      style={{ gridTemplateColumns: COLUMNAS, transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="grid items-center gap-x-2 rounded-lg border border-stone-300 bg-white px-2 py-2 text-center text-sm"
    >
      <div role="cell" className="flex justify-center">
        <button type="button" disabled={bloqueada} aria-label={`Mover el pedido ${n}`} className="flex h-7 w-7 cursor-grab items-center justify-center rounded-full bg-stone-800 text-xs font-semibold text-white disabled:cursor-default" {...attributes} {...listeners}>{n}</button>
      </div>
      <div role="cell" className="font-semibold">{f.barrio}</div>
      <div role="cell" className="leading-snug">
        <p className="font-semibold">{f.cliente}</p>
      </div>
      <div role="cell" className="leading-snug">
        <a href={mapa(f)} target="_blank" rel="noreferrer" className="hover:underline">{f.direccion}</a>
        {f.comentario && <p className="text-xs font-medium text-rojo-700">{f.comentario}</p>}
      </div>
      <div role="cell" className="tabular-nums">
        {f.telefono ? (enlaceWhatsApp(f.telefono) ? <a href={enlaceWhatsApp(f.telefono)!} target="_blank" rel="noreferrer" className="hover:text-verde-800 hover:underline">{f.telefono}</a> : f.telefono) : <span className="text-stone-400">—</span>}
      </div>
      <div role="cell" className="inline-grid justify-center justify-self-center gap-x-2 gap-y-0.5 text-left [grid-template-columns:auto_auto]">
        {f.items.map((i, k) => (
          <span key={k} className="contents"><span className="text-right font-semibold tabular-nums">{i.cantidad}</span><span className="leading-snug">{i.nombre}</span></span>
        ))}
      </div>
      <div role="cell" className="font-semibold tabular-nums">{formatoPesos(f.monto)}</div>

      {/* Comprobante: el N° de factura (chico) o el remito */}
      <div role="cell">
        {f.conFactura ? (
          <>
            <span className="block text-[10px] uppercase leading-none text-stone-500">Factura</span>
            <input
              aria-label={`Número de factura de ${f.cliente}`}
              placeholder="N°"
              defaultValue={f.numeroFactura}
              disabled={bloqueada}
              onBlur={(e) => e.target.value.trim() !== f.numeroFactura && acc.factura(f, e.target.value)}
              className={`mt-0.5 h-6 w-full rounded border bg-white px-1 text-center text-xs tabular-nums disabled:bg-crema-100 ${falta ? "border-rojo-600" : "border-stone-300"}`}
            />
          </>
        ) : (
          <BotonRemito pedidoId={f.id} numero={f.remito} clase={`h-7 w-full rounded border bg-white px-1 text-xs font-medium ${falta ? "border-rojo-600 text-rojo-800" : "border-stone-400 text-stone-800"}`} />
        )}
      </div>

      {/* Entrega: tilde arriba, cruz abajo */}
      <div role="cell" className="flex flex-col items-center gap-1">
        <button type="button" disabled={bloqueada} aria-pressed={entregado} aria-label="Entregado" onClick={() => acc.entrega(f, entregado ? "PENDIENTE" : "ENTREGADO")} className={`${marca} ${entregado ? "border-verde-700 bg-verde-700 text-white" : "border-stone-300 bg-white text-stone-500 hover:border-verde-700"}`}>✓</button>
        <button type="button" disabled={bloqueada} aria-pressed={noEntregado} aria-label="No entregado" onClick={() => acc.entrega(f, noEntregado ? "PENDIENTE" : "NO_ENTREGADO")} className={`${marca} ${noEntregado ? "border-rojo-700 bg-rojo-700 text-white" : "border-stone-300 bg-white text-stone-500 hover:border-rojo-700"}`}>✗</button>
        {!noEntregado && <Link href={`/pedidos/${f.id}`} className="text-[10px] leading-none text-stone-500 underline">parcial</Link>}
      </div>

      {/* Cobro: un solo desplegable (cobrado en qué medio, o cuenta corriente) */}
      <div role="cell">
        {!entregado ? (
          <span className="text-stone-400">—</span>
        ) : f.cobro ? (
          <span className="inline-flex items-center justify-center gap-1.5 text-xs font-medium">
            {f.cobro === "COBRADO" ? `Cobrado · ${textoMedio(f.medioCobro)}` : "Cuenta corriente"}
            {!bloqueada && <button type="button" onClick={() => acc.deshacer(f)} aria-label="Deshacer el cobro" className="text-stone-500 underline">✕</button>}
          </span>
        ) : (
          <select
            aria-label="Cobro"
            disabled={bloqueada}
            value=""
            onChange={(e) => {
              const v = e.target.value;
              if (v === "CUENTA_CORRIENTE") acc.cuentaCorriente(f);
              else if (v) acc.cobrar(f, v);
            }}
            className={estiloSelect("h-8 w-full text-xs")}
          >
            <option value="" disabled hidden>Cobro…</option>
            <optgroup label="Cobrado en">
              {MEDIOS.map((m) => <option key={m.valor} value={m.valor}>{m.texto}</option>)}
            </optgroup>
            <option value="CUENTA_CORRIENTE">Cuenta corriente</option>
          </select>
        )}
      </div>

      {/* Ubicación: sacarlo de la ruta (vuelve a "Sin ubicar") o pasarlo de día */}
      <div role="cell" className="flex flex-col gap-1">
        <button type="button" disabled={bloqueada || entregado} onClick={() => acc.mover(f, "sin")} className="h-7 rounded border border-stone-400 bg-white px-1 text-xs font-medium hover:bg-crema-100 disabled:opacity-40">↑ Sin ubicar</button>
        <SelectorDia f={f} bloqueada={bloqueada} acc={acc} clase="h-7 w-full text-xs" />
      </div>

      <div role="cell">
        <Link href={`/pedidos/${f.id}`} className="text-sm font-semibold text-verde-800 underline-offset-4 hover:underline">Abrir ›</Link>
      </div>
    </div>
  );
}

// Cuadro que recibe pedidos arrastrados (un vehículo, o "sin" = sin ubicar).
function Zona({ id, bloqueada, clase, children }: { id: string; bloqueada: boolean; clase: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `c:${id}`, disabled: bloqueada });
  return <section ref={setNodeRef} className={`${clase} ${isOver ? "ring-2 ring-verde-700" : ""}`}>{children}</section>;
}

const COLUMNAS_UBICAR = "lg:grid-cols-[1.5rem_1fr_1.5fr_1.4fr_1fr_2fr_6.5rem_5rem_4rem_9rem_9rem]";

// Un pedido sin ubicar: la misma información que en la hoja PEDIDOS, en una sola línea, y se arrastra hasta un vehículo.
function FilaUbicar({ f, salidas, bloqueada, acc }: { f: Fila; salidas: SalidaInfo[]; bloqueada: boolean; acc: Acciones }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: f.id, disabled: bloqueada });
  const wa = f.telefono ? enlaceWhatsApp(f.telefono) : null;
  return (
    <div
      ref={setNodeRef}
      style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 20 : undefined, position: "relative" }}
      className="rounded-xl border border-stone-300 bg-white px-5 py-3.5 shadow-sm"
    >
      <div className={`grid items-center gap-x-4 gap-y-2 text-center ${COLUMNAS_UBICAR}`}>
        <button type="button" disabled={bloqueada} aria-label="Arrastrar el pedido a un vehículo" className="hidden cursor-grab text-lg leading-none text-stone-500 disabled:cursor-default disabled:opacity-30 lg:block" {...attributes} {...listeners}>⋮⋮</button>
        <span className="text-sm font-semibold">{f.barrio}</span>
        <span className="text-sm font-semibold leading-snug">{f.cliente}</span>
        <span className="text-sm leading-snug">
          {f.direccion}
          {f.comentario && <span className="mt-0.5 block text-xs font-medium text-rojo-700">{f.comentario}</span>}
        </span>
        <span className="text-sm tabular-nums">{f.telefono ? (wa ? <a href={wa} target="_blank" rel="noreferrer" className="hover:text-verde-800 hover:underline">{f.telefono}</a> : f.telefono) : <span className="text-stone-400">—</span>}</span>
        <span className="inline-grid justify-center justify-self-center gap-x-2 gap-y-0.5 text-left text-sm [grid-template-columns:auto_auto]">
          {f.items.map((i, k) => <span key={k} className="contents"><span className="text-right font-semibold tabular-nums">{i.cantidad}</span><span className="leading-snug">{i.nombre}</span></span>)}
        </span>
        <span className="text-sm font-semibold tabular-nums">{formatoPesos(f.monto)}</span>
        <span><span className={`inline-block rounded px-2 py-0.5 text-xs font-bold tracking-wide ${f.conFactura ? "bg-verde-800 text-white" : "bg-crema-200 text-verde-900"}`}>{f.conFactura ? "FACTURA" : "REMITO"}</span></span>
        <Link href={`/pedidos/${f.id}`} className="text-sm font-semibold text-verde-800 underline-offset-4 hover:underline">Abrir ›</Link>
        {salidas.length === 1 ? (
          <button type="button" disabled={bloqueada} onClick={() => acc.mover(f, salidas[0].id)} className="h-9 rounded-md border border-stone-400 bg-white px-1 text-sm font-medium shadow-sm hover:bg-crema-100 disabled:opacity-40">↓ {salidas[0].nombre}</button>
        ) : (
          <SelectorUbicar f={f} salidas={salidas} bloqueada={bloqueada} acc={acc} clase="h-9 w-full" />
        )}
        <SelectorDia f={f} bloqueada={bloqueada} acc={acc} clase="h-9 w-full" />
      </div>
    </div>
  );
}

const digitos = (t: string) => t.replace(/[^\d+]/g, "");
const mapa = (f: Fila) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${f.direccion}, ${f.barrio}`)}`;

// El mismo pedido, en el celular: una tarjeta con botones grandes (dirección a Google Maps, teléfono que llama).
function FilaTarjeta({ f, n, bloqueada, acc, salidas }: { f: Fila; n: number; bloqueada: boolean; acc: Acciones; salidas: SalidaInfo[] }) {
  const [eligiendo, setEligiendo] = useState(false);
  const fondo = "border-stone-300 bg-white";
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
        {f.comentario && <p className="text-sm font-medium text-rojo-700">{f.comentario}</p>}
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
        <Link href={`/pedidos/${f.id}`} className="flex h-12 items-center justify-center rounded-lg border border-stone-300 bg-white px-3 text-base font-semibold">Abrir pedido</Link>
      </div>
      <div className="grid grid-cols-2 gap-2"><Selectores f={f} salidas={salidas} bloqueada={bloqueada} acc={acc} clase="h-12 w-full" /></div>
    </article>
  );
}

const urlRuta = (filas: Fila[]) => `https://www.google.com/maps/dir/${filas.map((f) => encodeURIComponent(`${f.direccion}, ${f.barrio}`)).join("/")}`;

// Resumen de la vuelta de un vehículo (al final de su cuadro): pedidos, paquetes contra la capacidad y facturación.
function ResumenVuelta({ grupo, capacidad }: { grupo: Fila[]; capacidad: number | null }) {
  const paquetes = grupo.reduce((t, f) => t + f.bultos, 0);
  const total = grupo.reduce((t, f) => t + f.monto, 0);
  const conFactura = grupo.filter((f) => f.conFactura).reduce((t, f) => t + f.monto, 0);
  const conRemito = total - conFactura;
  const estado =
    capacidad === null ? { texto: "Sin tope", aviso: false }
    : paquetes > capacidad ? { texto: `Te pasaste ${paquetes - capacidad}`, aviso: true }
    : paquetes === capacidad ? { texto: "Completa", aviso: false }
    : { texto: `Quedan ${capacidad - paquetes}`, aviso: false };
  const dato = (titulo: string, valor: React.ReactNode, fuerte?: boolean) => (
    <div className="text-center">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-600">{titulo}</p>
      <p className={`tabular-nums ${fuerte ? "text-base font-bold" : "text-sm font-semibold"}`}>{valor}</p>
    </div>
  );
  return (
    <footer aria-label="Resumen de la vuelta" className="grid grid-cols-2 items-center gap-x-4 gap-y-3 border-t border-stone-400 bg-crema-100 px-5 py-3 text-stone-900 sm:grid-cols-3 xl:grid-cols-6">
      {dato("Pedidos", grupo.length)}
      {dato("Paquetes", capacidad !== null ? `${paquetes} de ${capacidad}` : paquetes)}
      {dato("Capacidad", <span className={estado.aviso ? "text-rojo-700" : undefined}>{estado.texto}</span>)}
      {dato("Con factura", formatoPesos(conFactura))}
      {dato("Con remito", formatoPesos(conRemito))}
      {dato("Total de la vuelta", formatoPesos(total), true)}
    </footer>
  );
}

type Props = {
  fecha: string;
  filasIniciales: Fila[];
  salidas: SalidaInfo[];
  vehiculosLibres: Opcion[];
  repartidores: Opcion[];
  diasSemana: { fecha: string; corta: string }[]; // corta = "Lun 28/9"
  cerrado: boolean;
  esDueno: boolean;
};

export function HojaDia({ fecha, filasIniciales, salidas, vehiculosLibres, repartidores, diasSemana, cerrado, esDueno }: Props) {
  const router = useRouter();
  const [filas, setFilas] = useState(filasIniciales);
  const [error, setError] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [, empezar] = useTransition();
  useEffect(() => setFilas(filasIniciales), [filasIniciales]);

  const sensores = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }));

  // Aplica el cambio en pantalla al instante y lo guarda; si el servidor lo rechaza, vuelve atrás y avisa.
  const guardar = (nuevas: Fila[], accion: () => Promise<Resultado>) => {
    const antes = filas;
    setError(null);
    setFilas(nuevas);
    empezar(async () => {
      const r = await accion();
      if (!r.ok) {
        setFilas(antes);
        setError(r.error ?? "No se pudo guardar.");
      }
      router.refresh();
    });
  };
  const ejecutar = (id: string, cambio: (f: Fila) => Fila, accion: () => Promise<Resultado>) => guardar(filas.map((f) => (f.id === id ? cambio(f) : f)), accion);

  const llamar = (accion: () => Promise<Resultado>) => {
    setError(null);
    empezar(async () => {
      const r = await accion();
      if (!r.ok) setError(r.error ?? "No se pudo guardar.");
      router.refresh();
    });
  };

  const acc: Acciones = {
    dias: diasSemana.filter((d) => d.fecha !== fecha).map((d) => ({ fecha: d.fecha, texto: d.corta })),
    entrega: (f, valor) => ejecutar(f.id, (x) => ({ ...x, estado: valor, ...(valor !== "ENTREGADO" ? { cobro: null, medioCobro: null } : {}) }), () => marcarEntrega(f.id, valor)),
    cobrar: (f, medio) => ejecutar(f.id, (x) => ({ ...x, cobro: "COBRADO", medioCobro: medio }), () => registrarCobro(f.id, medio)),
    cuentaCorriente: (f) => ejecutar(f.id, (x) => ({ ...x, cobro: "CUENTA_CORRIENTE" }), () => dejarEnCuentaCorriente(f.id)),
    deshacer: (f) => ejecutar(f.id, (x) => ({ ...x, cobro: null, medioCobro: null }), () => deshacerCobro(f.id)),
    factura: (f, numero) => ejecutar(f.id, (x) => ({ ...x, numeroFactura: numero.trim() }), () => guardarNumeroFactura(f.id, numero)),
    mover: (f, destino) => {
      if (destino === "pedidos") return guardar(filas.filter((x) => x.id !== f.id), () => devolverAPedidos(f.id));
      if (destino.startsWith("dia:")) return guardar(filas.filter((x) => x.id !== f.id), () => asignarADia(f.id, destino.slice(4)));
      const salidaId = destino === "sin" ? null : destino;
      guardar([...filas.filter((x) => x.id !== f.id), { ...f, salidaId }], () => asignarAVehiculo(f.id, salidaId)); // queda al final del recorrido
    },
  };

  // Un solo arrastre para todo: de "sin ubicar" a un vehículo, de un vehículo a otro, de vuelta a "sin ubicar", o reordenar el recorrido.
  const colision: CollisionDetection = (args) => {
    const dentro = pointerWithin(args);
    const pedidos = dentro.filter((c) => !String(c.id).startsWith("c:"));
    if (pedidos.length) return pedidos;
    return dentro.length ? dentro : closestCenter(args);
  };
  const alSoltar = (e: DragEndEvent) => {
    setArrastrando(false);
    if (!e.over || cerrado) return;
    const id = String(e.active.id);
    const f = filas.find((x) => x.id === id);
    if (!f) return;
    const sobre = String(e.over.id);
    let destino: string | null;
    if (sobre.startsWith("c:")) {
      const c = sobre.slice(2);
      destino = c === "sin" ? null : c;
    } else {
      const o = filas.find((x) => x.id === sobre);
      if (!o) return;
      destino = o.salidaId;
    }
    if (destino !== f.salidaId) return acc.mover(f, destino === null ? "sin" : destino);
    if (destino === null || sobre.startsWith("c:") || sobre === id) return;
    const delVehiculo = filas.filter((x) => x.salidaId === destino);
    const orden = arrayMove(delVehiculo, delVehiculo.findIndex((x) => x.id === id), delVehiculo.findIndex((x) => x.id === sobre));
    guardar([...filas.filter((x) => x.salidaId !== destino), ...orden], () => ordenarSalida(destino, orden.map((x) => x.id)));
  };

  const sinVehiculo = filas.filter((f) => f.salidaId === null);

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
  const reabrir = () => llamar(() => reabrirDia(fecha));
  const sumarVehiculo = (vehiculoId: string) => {
    if (vehiculoId) llamar(() => agregarSalida(fecha, vehiculoId, null));
  };

  const tabla = (grupo: Fila[], salida: SalidaInfo) => (
    <>
      <div className="space-y-3 p-3 xl:hidden">
        {grupo.map((f, n) => <FilaTarjeta key={f.id} f={f} n={n + 1} bloqueada={cerrado} acc={acc} salidas={salidas} />)}
      </div>
      <div className="hidden p-3 xl:block">
        <div role="table" className="space-y-1.5">
          <div role="row" style={{ gridTemplateColumns: COLUMNAS }} className="grid items-center gap-x-2 border-b border-stone-400 px-2 pb-1.5 text-center text-xs font-semibold uppercase tracking-wide text-stone-600">
            {ENCABEZADOS.map((h) => <div key={h} role="columnheader">{h}</div>)}
          </div>
          <SortableContext items={grupo.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            {grupo.map((f, n) => <FilaHoja key={f.id} f={f} n={n + 1} bloqueada={cerrado} acc={acc} salidas={salidas} />)}
          </SortableContext>
        </div>
      </div>
    </>
  );

  return (
    <DndContext id="hoja-de-ruta" sensors={sensores} collisionDetection={colision} onDragStart={() => setArrastrando(true)} onDragCancel={() => setArrastrando(false)} onDragEnd={alSoltar}>
    <div className="space-y-4">
      <div className="grid items-center gap-3 text-sm sm:grid-cols-[1fr_auto_1fr]">
        {/* Sumar un vehículo a la salida de este día: chico, un solo desplegable; al elegirlo se abre su cuadro */}
        {!cerrado ? (
          <select
            aria-label="Sumar un vehículo al día"
            value=""
            disabled={vehiculosLibres.length === 0}
            onChange={(e) => sumarVehiculo(e.target.value)}
            className="h-9 w-52 rounded-md border border-stone-400 bg-white px-2 text-sm font-semibold shadow-sm disabled:text-stone-500"
          >
            <option value="">{vehiculosLibres.length ? "+ Sumar vehículo" : "No quedan vehículos libres"}</option>
            {vehiculosLibres.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
          </select>
        ) : (
          <div className="flex items-center gap-3">
            <span className="rounded-md bg-stone-800 px-3 py-1.5 font-semibold text-white">Día cerrado</span>
            {esDueno && <button type="button" onClick={reabrir} className="rounded-md border border-stone-400 bg-white px-3 py-2 font-medium shadow-sm">Reabrir día</button>}
          </div>
        )}
        <h2 className="text-center text-sm font-bold uppercase tracking-wide text-stone-800">
          {sinVehiculo.length > 0 && <>Sin ubicar <span className="font-medium normal-case tracking-normal text-stone-600">· {sinVehiculo.length} {sinVehiculo.length === 1 ? "pedido" : "pedidos"}</span></>}
        </h2>
        <div className="sm:justify-self-end">
          {filas.length > 0 && <button type="button" onClick={imprimirTodos} className="rounded-md border border-stone-400 bg-white px-3 py-2 font-medium shadow-sm">Imprimir todos los remitos</button>}
        </div>
      </div>
      {error && <p className="rounded-lg border border-rojo-600 bg-rojo-50 p-3 text-sm text-rojo-700" role="alert">{error}</p>}

      {/* Pedidos del día que todavía no están en ningún vehículo: la misma información que en la hoja PEDIDOS */}
      {(sinVehiculo.length > 0 || arrastrando) && (
        <Zona id="sin" bloqueada={cerrado} clase="space-y-2 rounded-xl p-1">
          {sinVehiculo.length > 0 ? (
            <>
              <div className={`hidden gap-x-4 px-5 text-center text-xs font-semibold uppercase tracking-wide text-stone-600 lg:grid ${COLUMNAS_UBICAR}`}>
                {["", "Barrio", "Cliente", "Dirección", "Teléfono", "Pedido", "Monto", "Factura", "", "Ubicar en", "Día"].map((h, i) => <span key={i}>{h}</span>)}
              </div>
              {sinVehiculo.map((f) => <FilaUbicar key={f.id} f={f} salidas={salidas} bloqueada={cerrado} acc={acc} />)}
            </>
          ) : (
            <p className="rounded-xl border border-dashed border-stone-400 p-4 text-center text-sm text-stone-600">Soltá acá el pedido para dejarlo sin ubicar.</p>
          )}
        </Zona>
      )}

      {/* Un cuadro por vehículo: su carga y su recorrido */}
      {salidas.map((sa) => {
        const grupo = filas.filter((f) => f.salidaId === sa.id);
        return (
          <Zona key={sa.id} id={sa.id} bloqueada={cerrado} clase="overflow-hidden rounded-xl border border-stone-400 bg-white shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-400 bg-crema-100 px-5 py-3 text-stone-900">
              <div>
                <h2 className="text-lg font-bold leading-tight">{sa.nombre}</h2>
                {sa.patente && <p className="text-xs text-stone-600">{sa.patente}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {grupo.length > 0 && <a href={urlRuta(grupo)} target="_blank" rel="noreferrer" className="rounded-md border border-stone-400 bg-white px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-crema-50">Ver ruta en Google Maps</a>}
                {!cerrado && <button type="button" onClick={() => { if (window.confirm(`¿Sacar ${sa.nombre} del día? Sus pedidos quedan “sin ubicar”.`)) llamar(() => quitarSalida(sa.id)); }} className="rounded-md border border-stone-400 bg-white px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-crema-50">Sacar del día</button>}
              </div>
            </header>
            {grupo.length === 0 ? (
              <p className="p-6 text-center text-sm text-stone-600">Todavía no tiene pedidos. Arrastralos desde “Sin ubicar”.</p>
            ) : tabla(grupo, sa)}
            <ResumenVuelta grupo={grupo} capacidad={sa.capacidad} />
          </Zona>
        );
      })}

      {filas.length === 0 && <p className="rounded-lg border border-dashed border-stone-400 p-8 text-center text-stone-600">Todavía no hay pedidos en este día. Asignalos desde Pedidos.</p>}
    </div>
    </DndContext>
  );
}
