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
import { normalizarFactura, soloNumeroFactura } from "@/lib/remito";
import { asignarADia, marcarPagoWeb } from "../../actions";
import { agregarSalida, asignarAVehiculo, devolverAPedidos, ordenarSalida, quitarSalida } from "../../ruta/actions";
import { emitirRemitosDia } from "../../remito/actions";
import { cerrarDia, dejarEnCuentaCorriente, dejarListo, reabrirHoja, deshacerCobro, guardarNumeroFactura, marcarEntrega, reabrirDia, registrarCobro, registrarNoEntrega, type Resultado } from "../actions";
import { EstadoPagoWeb } from "@/components/EstadoPagoWeb";
import { ModalMotivo } from "@/components/ModalMotivo";

export type Fila = {
  id: string;
  clienteId: string | null;
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
  webOrden: string | null; // pedido de la tienda online: sin cuenta corriente ni remito
  pagoMp: boolean; // pedido de la tienda ya pagado (Mercado Pago o transferencia confirmada)
  pagoTexto: string | null;
};

/** Un pedido que salió ese día y no se entregó: queda su "silueta" en la hoja (con el motivo) aunque se reprograme. */
export type Silueta = {
  id: string;
  pedidoId: string;
  salidaId: string | null;
  vehiculo: string;
  orden: number;
  motivo: string;
  barrio: string;
  cliente: string;
  direccion: string;
  items: { nombre: string; cantidad: number }[];
  destino: string; // qué pasó después: "Se entregó el 9/10", "Reprogramado: Jue 9/10", "En Pedidos, esperando día"…
};

export type SalidaInfo = { id: string; nombre: string; patente: string; capacidad: number | null; repartidorId: string };
export type Opcion = { id: string; nombre: string };

// Todo entra a lo ancho (sin deslizar): columnas justas y todo centrado.
const COLUMNAS = "34px 76px minmax(110px,1.2fr) minmax(110px,1.1fr) 118px minmax(160px,1.5fr) 88px 88px 112px 110px 92px 56px";
const ENCABEZADOS = ["N°", "Barrio", "Cliente", "Dirección", "Teléfono", "Pedido", "Monto", "Comprobante", "Entrega", "Cobro", "Mover", "Abrir"];
const MEDIOS: { valor: string; texto: string }[] = [
  { valor: "EFECTIVO", texto: "Efectivo" },
  { valor: "TRANSFERENCIA", texto: "Transferencia" },
  { valor: "CHEQUE", texto: "Cheque" },
  { valor: "MERCADO_PAGO", texto: "Mercado Pago" },
  { valor: "OTRO", texto: "Otro" },
];
// Al cobrar solo se ofrecen estos dos; lo demás va a cuenta corriente.
const MEDIOS_COBRO = MEDIOS.filter((m) => m.valor === "EFECTIVO" || m.valor === "TRANSFERENCIA");
const textoMedio = (m: string | null) => MEDIOS.find((x) => x.valor === m)?.texto ?? "";

type Acciones = {
  entrega: (f: Fila, valor: "PENDIENTE") => void; // deshace la entrega
  entregarYCobrar: (f: Fila, cobro: string | undefined) => void; // cobro: EFECTIVO, TRANSFERENCIA o CC (Mercado Pago de la tienda va solo)
  noEntregado: (f: Fila, motivo: string) => Promise<string | null>; // devuelve el error, si hubo
  cobrar: (f: Fila, medio: string) => void;
  cuentaCorriente: (f: Fila) => void;
  deshacer: (f: Fila) => void;
  pagoWeb: (f: Fila, pagado: boolean) => void; // tienda: confirmar la transferencia o volver a pendiente
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

// Entrega: dos botones parejos, uno arriba del otro. ✓ pide enseguida cómo se cobra; ✗ pide el motivo.
function SelectorEntrega({ f, bloqueada, acc, grande, eligiendoCobro, onEntregar, onNoEntregar }: { f: Fila; bloqueada: boolean; acc: Acciones; grande?: boolean; eligiendoCobro: boolean; onEntregar: () => void; onNoEntregar: () => void }) {
  const base = `${grande ? "h-12 text-base" : "h-7 text-xs"} w-full rounded-md border font-semibold transition disabled:opacity-40`;
  const si = f.estado === "ENTREGADO";
  const noLegado = f.estado === "NO_ENTREGADO";
  return (
    <div role="group" aria-label="Entrega" className={`flex w-full ${grande ? "flex-row gap-2" : "flex-col gap-1"}`}>
      <button type="button" disabled={bloqueada} aria-pressed={si} onClick={() => (si ? acc.entrega(f, "PENDIENTE") : onEntregar())} className={`${base} ${si ? "border-verde-700 bg-verde-700 text-white" : eligiendoCobro ? "border-verde-700 bg-verde-50 text-verde-800 ring-2 ring-verde-700/30" : "border-stone-300 bg-white text-stone-600 hover:border-verde-700 hover:text-verde-800"}`}>✓ Entregado</button>
      <button type="button" disabled={bloqueada} aria-pressed={noLegado} onClick={() => (noLegado ? acc.entrega(f, "PENDIENTE") : onNoEntregar())} className={`${base} ${noLegado ? "border-rojo-700 bg-rojo-700 text-white" : "border-stone-300 bg-white text-stone-600 hover:border-rojo-700 hover:text-rojo-800"}`}>✗ No entregado</button>
    </div>
  );
}

// Borde de la fila: verde si se entregó, rojo si no (un relieve fino, la fila sigue blanca).
const BORDE_FILA = {
  PENDIENTE: "border-stone-300",
  ENTREGADO: "border-verde-700 shadow-[0_0_0_1px_#026433]",
  NO_ENTREGADO: "border-rojo-700 shadow-[0_0_0_1px_#aa0e1d]",
} as const;

// El camino de entregar y el de no entregar de un pedido (se comparte entre la fila de la PC y la tarjeta del celular).
function useFlujoEntrega(f: Fila, acc: Acciones) {
  const [eligiendoCobro, setEligiendoCobro] = useState(false);
  const [motivoAbierto, setMotivoAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  return {
    eligiendoCobro,
    motivoAbierto,
    error,
    enviando,
    // ✓ Entregado: la tienda ya pagada con Mercado Pago se entrega directo; el resto pide primero cómo se cobra.
    entregar: () => (f.pagoMp || f.webOrden ? acc.entregarYCobrar(f, undefined) : setEligiendoCobro((v) => !v)),
    elegirCobro: (cobro: string) => {
      setEligiendoCobro(false);
      if (f.estado === "ENTREGADO") acc.entregarYCobrar(f, cobro); // completa un cobro que faltaba
      else acc.entregarYCobrar(f, cobro);
    },
    cancelar: () => setEligiendoCobro(false),
    abrirMotivo: () => { setEligiendoCobro(false); setError(null); setMotivoAbierto(true); },
    cerrarMotivo: () => setMotivoAbierto(false),
    guardarMotivo: async (motivo: string) => {
      setEnviando(true);
      const e = await acc.noEntregado(f, motivo);
      setEnviando(false);
      if (e) setError(e); else setMotivoAbierto(false);
    },
  };
}

const CELESTE = "border-[#1c8fd1] bg-[#1fa2e0] text-white";

// Cobro ya marcado: casillero lleno y llamativo (verde fuerte = pago, celeste = cuenta corriente).
function CobroMarcado({ tipo, detalle, onDeshacer }: { tipo: "PAGO" | "CC"; detalle: string; onDeshacer?: () => void }) {
  return (
    <div className={`relative flex h-[60px] w-full flex-col items-center justify-center rounded-md border px-2 leading-tight ${tipo === "PAGO" ? "border-verde-800 bg-verde-700 text-white" : CELESTE}`}>
      <span className="text-xs font-bold uppercase tracking-wide">{tipo === "PAGO" ? "✓ Pago" : "Cuenta corriente"}</span>
      {detalle && <span className="text-[11px] font-medium opacity-90">{detalle}</span>}
      {onDeshacer && <button type="button" onClick={onDeshacer} aria-label="Deshacer el cobro" className="absolute right-1 top-0 text-xs text-white/80 hover:text-white">✕</button>}
    </div>
  );
}

// Cobro: dos opciones, PAGO o CUENTA CORRIENTE. Al elegir PAGO se despliega cómo se pagó.
// Mientras se está entregando (✓ tocado y sin cobro elegido) se muestra la elección; el pedido no queda entregado hasta elegir.
function CeldaCobro({ f, bloqueada, acc, eligiendoCobro, onElegir, onCancelar }: { f: Fila; bloqueada: boolean; acc: Acciones; eligiendoCobro: boolean; onElegir: (cobro: string) => void; onCancelar: () => void }) {
  const [medio, setMedio] = useState(false);
  if (f.pagoMp) return <CobroMarcado tipo="PAGO" detalle={f.pagoTexto ?? "Pagado"} onDeshacer={!bloqueada && f.estado !== "ENTREGADO" && f.pagoTexto === "Transferencia" ? () => { if (window.confirm(`¿Volver a "pendiente de pago" el pedido de ${f.cliente}?`)) acc.pagoWeb(f, false); } : undefined} />;
  if (f.webOrden) return <button type="button" disabled={bloqueada} onClick={() => { if (window.confirm(`¿Confirmás que YA LLEGÓ la transferencia de ${formatoPesos(f.monto)} de ${f.cliente}?\n\nRevisá que esté acreditada en la cuenta.`)) acc.pagoWeb(f, true); }} className="h-[44px] w-full rounded-md border border-rojo-600 bg-white px-1 text-xs font-semibold leading-tight text-rojo-700 hover:bg-rojo-50 disabled:opacity-40">Pendiente de pago<br />Confirmar…</button>;
  const pidiendo = eligiendoCobro || (f.estado === "ENTREGADO" && !f.cobro); // entregado sin cobro (datos viejos): también se completa acá
  if (!pidiendo) {
    if (f.estado !== "ENTREGADO") return <span className="text-stone-400">—</span>;
    if (f.cobro === "COBRADO") return <CobroMarcado tipo="PAGO" detalle={textoMedio(f.medioCobro)} onDeshacer={bloqueada ? undefined : () => acc.deshacer(f)} />;
    return <CobroMarcado tipo="CC" detalle="" onDeshacer={bloqueada ? undefined : () => acc.deshacer(f)} />;
  }
  const base = "h-7 w-full rounded-md border text-xs font-semibold transition disabled:opacity-40";
  if (medio) {
    return (
      <div role="group" aria-label="¿Cómo pagó?" className="relative flex w-full flex-col gap-1">
        <button type="button" onClick={() => setMedio(false)} aria-label="Volver" className="absolute -right-1.5 -top-2 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-stone-300 text-[10px] leading-none text-stone-700 hover:bg-stone-400">✕</button>
        {MEDIOS_COBRO.map((m) => <button key={m.valor} type="button" disabled={bloqueada} onClick={() => { setMedio(false); onElegir(m.valor); }} className={`${base} border-verde-700 bg-white text-verde-800 hover:bg-verde-700 hover:text-white`}>{m.texto}</button>)}
      </div>
    );
  }
  return (
    <div role="group" aria-label="Cobro" className="relative flex w-full flex-col gap-1">
      {eligiendoCobro && <button type="button" onClick={onCancelar} aria-label="Cancelar la entrega" className="absolute -right-1.5 -top-2 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-stone-300 text-[10px] leading-none text-stone-700 hover:bg-stone-400">✕</button>}
      <button type="button" disabled={bloqueada} onClick={() => setMedio(true)} className={`${base} border-verde-700 bg-white text-verde-800 hover:bg-verde-700 hover:text-white`}>Pago</button>
      {!f.webOrden && <button type="button" disabled={bloqueada} onClick={() => onElegir("CC")} className={`${base} border-[#1c8fd1] bg-white text-[#1475ac] hover:bg-[#1fa2e0] hover:text-white`}>Cuenta corriente</button>}
    </div>
  );
}

// Comprobante: misma caja para los dos. Remito = R-0003 (se imprime al tocarlo); factura = F- y el número que se escribe.
function CajaComprobante({ f, falta, bloqueada, acc }: { f: Fila; falta: boolean; bloqueada: boolean; acc: Acciones }) {
  const borde = falta ? "border-rojo-600" : "border-stone-400";
  if (f.webOrden) return <span className="text-stone-400">—</span>;
  if (f.conFactura) {
    return (
      <label className={`flex h-8 w-full items-center overflow-hidden rounded-md border bg-white ${borde} focus-within:border-verde-700`}>
        <span className="flex h-full items-center bg-crema-200 px-1.5 text-xs font-bold text-stone-800">F-</span>
        <input
          aria-label={`Número de factura de ${f.cliente}`}
          placeholder="0000"
          inputMode="numeric"
          onChange={(e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4); }}
          defaultValue={soloNumeroFactura(f.numeroFactura)}
          disabled={bloqueada}
          onBlur={(e) => e.target.value.trim() !== soloNumeroFactura(f.numeroFactura) && acc.factura(f, e.target.value)}
          className="h-full w-full min-w-0 bg-white px-1 text-center text-sm font-semibold tabular-nums outline-none disabled:bg-crema-100"
        />
      </label>
    );
  }
  return <BotonRemito pedidoId={f.id} numero={f.remito} textoSinNumero="R-····" clase={`h-8 w-full rounded-md border bg-white px-1 text-sm font-semibold tabular-nums hover:bg-crema-100 ${falta ? "border-rojo-600 text-rojo-700" : "border-stone-400 text-stone-800"}`} />;
}

// Mover: un solo desplegable (sin ubicar, otra camioneta, otro día o de vuelta a Pedidos).
function SelectorMover({ f, salidas, bloqueada, acc }: { f: Fila; salidas: SalidaInfo[]; bloqueada: boolean; acc: Acciones }) {
  return (
    <select aria-label="Mover el pedido" disabled={bloqueada || f.estado === "ENTREGADO"} value="" onChange={(e) => e.target.value && acc.mover(f, e.target.value)} className="h-8 w-full rounded-md border border-stone-400 bg-white px-1 text-xs font-medium shadow-sm disabled:opacity-40">
      <option value="" disabled hidden>Mover…</option>
      {f.salidaId !== null && <option value="sin">↑ Sin ubicar</option>}
      {salidas.filter((x) => x.id !== f.salidaId).length > 0 && (
        <optgroup label="Otra camioneta">{salidas.filter((x) => x.id !== f.salidaId).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}</optgroup>
      )}
      <optgroup label="Pasar al día">
        {acc.dias.map((d) => <option key={d.fecha} value={`dia:${d.fecha}`}>{d.texto}</option>)}
        <option value="pedidos">Volver a Pedidos</option>
      </optgroup>
    </select>
  );
}

function FilaHoja({ f, n, bloqueada, fija, acc, salidas }: { f: Fila; n: number; bloqueada: boolean; fija: boolean; acc: Acciones; salidas: SalidaInfo[] }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: f.id, disabled: fija });
  const entregado = f.estado === "ENTREGADO";
  const falta = entregado && !f.webOrden && (f.conFactura ? !f.numeroFactura : !f.remito); // ya entregado y sin su número de comprobante
  const flujo = useFlujoEntrega(f, acc);

  return (
    <div
      ref={setNodeRef}
      role="row"
      style={{ gridTemplateColumns: COLUMNAS, transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={`grid items-center gap-x-2 rounded-lg border bg-white px-2 py-2 text-center text-[14px] text-stone-900 ${BORDE_FILA[f.estado]}`}
    >
      <div role="cell" className="flex justify-center">
        <button type="button" disabled={fija} aria-label={`Mover el pedido ${n}`} className="flex h-7 w-7 cursor-grab items-center justify-center rounded-full bg-stone-800 text-xs font-semibold text-white disabled:cursor-default" {...attributes} {...listeners}>{n}</button>
      </div>
      <div role="cell" className="text-[12px] font-bold uppercase leading-tight tracking-wide text-stone-800">{f.barrio}</div>
      <div role="cell" className="leading-snug">
        <p className="font-bold">{f.cliente}</p>
        <EstadoPagoWeb webOrden={f.webOrden} pagado={f.pagoMp} medio={f.pagoTexto} />
      </div>
      <div role="cell" className="min-w-0 break-words leading-snug">
        <a href={mapa(f)} target="_blank" rel="noreferrer" className="hover:underline">{f.direccion}</a>
        {f.comentario && <p className="text-[13px] font-semibold text-rojo-700">{f.comentario}</p>}
      </div>
      <div role="cell" className="whitespace-nowrap tabular-nums">
        {f.telefono ? (enlaceWhatsApp(f.telefono) ? <a href={enlaceWhatsApp(f.telefono)!} target="_blank" rel="noreferrer" className="hover:text-verde-800 hover:underline">{f.telefono}</a> : f.telefono) : <span className="text-stone-400">—</span>}
      </div>
      <div role="cell" className="inline-grid justify-center justify-self-center gap-x-2 gap-y-0.5 text-left [grid-template-columns:auto_auto]">
        {f.items.map((i, k) => (
          <span key={k} className="contents"><span className="text-right font-bold tabular-nums">{i.cantidad}</span><span className="leading-snug">{i.nombre}</span></span>
        ))}
      </div>
      <div role="cell" className="font-bold tabular-nums">{formatoPesos(f.monto)}</div>

      <div role="cell"><CajaComprobante f={f} falta={falta} bloqueada={bloqueada} acc={acc} /></div>
      <div role="cell"><SelectorEntrega f={f} bloqueada={bloqueada} acc={acc} eligiendoCobro={flujo.eligiendoCobro} onEntregar={flujo.entregar} onNoEntregar={flujo.abrirMotivo} /></div>
      <div role="cell"><CeldaCobro f={f} bloqueada={bloqueada} acc={acc} eligiendoCobro={flujo.eligiendoCobro} onElegir={flujo.elegirCobro} onCancelar={flujo.cancelar} /></div>
      <div role="cell"><SelectorMover f={f} salidas={salidas} bloqueada={fija} acc={acc} /></div>
      <div role="cell">
        <Link href={`/pedidos/${f.id}`} className="text-sm font-semibold text-verde-800 underline-offset-4 hover:underline">Abrir ›</Link>
      </div>
      <ModalMotivo abierto={flujo.motivoAbierto} titulo="¿Por qué no se entregó?" ayuda={`${f.cliente}: el pedido vuelve a Pedidos para reprogramarlo y en esta hoja queda anotado que salió y no se entregó.`} textoBoton="No se entregó" enviando={flujo.enviando} error={flujo.error} onCancelar={flujo.cerrarMotivo} onGuardar={flujo.guardarMotivo} />
    </div>
  );
}

// La silueta de un pedido que salió y no se entregó: gris, punteada, con el motivo y qué pasó después.
function FilaSilueta({ x }: { x: Silueta }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-dashed border-stone-400 bg-stone-100/80 px-3 py-2 text-sm text-stone-500">
      <span className="text-xs font-bold uppercase tracking-wide">{x.barrio}</span>
      <span className="font-semibold text-stone-600">{x.cliente}</span>
      <span>{x.direccion}</span>
      <span className="text-xs">{x.items.map((i) => `${i.cantidad} ${i.nombre}`).join(" · ")}</span>
      <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold text-rojo-700/80">No se entregó · {x.motivo}</span>
        <span className="text-xs">{x.destino}</span>
        <Link href={`/pedidos/${x.pedidoId}`} className="text-xs font-semibold text-verde-800 underline">Abrir ›</Link>
      </span>
    </div>
  );
}

// Lugares del recorrido: la silueta de un pedido no entregado queda clavada en su número (gris) y los pedidos vivos ocupan los demás.
type Lugar = { n: number; f?: Fila; x?: Silueta };
function lugaresDelRecorrido(grupo: Fila[], siluetas: Silueta[]): Lugar[] {
  const total = grupo.length + siluetas.length;
  const lugares: (Lugar | null)[] = Array.from({ length: total }, () => null);
  for (const x of [...siluetas].sort((p, q) => p.orden - q.orden)) {
    let i = Math.min(Math.max(x.orden, 0), total - 1);
    while (lugares[i]) i = (i + 1) % total;
    lugares[i] = { n: i + 1, x };
  }
  let k = 0;
  return lugares.map((l, i) => l ?? { n: i + 1, f: grupo[k++] });
}

// Silueta dentro de la tabla del vehículo: misma fila que un pedido, pero en gris, con su número y sin moverse.
function FilaSiluetaTabla({ x, n }: { x: Silueta; n: number }) {
  return (
    <div role="row" style={{ gridTemplateColumns: COLUMNAS }} className="grid items-center gap-x-2 rounded-lg border border-dashed border-stone-400 bg-stone-100 px-2 py-2.5 text-center text-sm text-stone-500">
      <div role="cell"><span className="inline-flex h-7 min-w-7 items-center justify-center rounded bg-stone-400 px-1 text-sm font-bold text-white">{n}</span></div>
      <div role="cell" className="text-xs font-bold uppercase leading-tight">{x.barrio}</div>
      <div role="cell" className="font-bold uppercase leading-snug text-stone-600">{x.cliente}</div>
      <div role="cell" className="leading-snug">{x.direccion}<span className="block text-xs font-semibold text-rojo-700/80">No se entregó · {x.motivo}</span></div>
      <div role="cell">—</div>
      <div role="cell" className="inline-grid justify-center justify-self-center gap-x-2 text-left [grid-template-columns:auto_auto]">
        {x.items.map((i, k) => <span key={k} className="contents"><span className="text-right font-semibold tabular-nums">{i.cantidad}</span><span className="leading-snug">{i.nombre}</span></span>)}
      </div>
      <div role="cell">—</div>
      <div role="cell">—</div>
      <div role="cell" className="col-span-3 text-xs leading-tight">{x.destino}</div>
      <div role="cell"><Link href={`/pedidos/${x.pedidoId}`} className="text-sm font-semibold text-verde-800 underline-offset-4 hover:underline">Abrir ›</Link></div>
    </div>
  );
}

function FilaSiluetaTarjeta({ x, n }: { x: Silueta; n: number }) {
  return (
    <div className="rounded-xl border border-dashed border-stone-400 bg-stone-100 p-3 text-sm text-stone-500">
      <p className="flex items-center gap-2 font-bold uppercase"><span className="inline-flex h-6 min-w-6 items-center justify-center rounded bg-stone-400 px-1 text-white">{n}</span>{x.barrio} · {x.cliente}</p>
      <p>{x.direccion}</p>
      <p className="text-xs">{x.items.map((i) => `${i.cantidad} ${i.nombre}`).join(" · ")}</p>
      <p className="font-semibold text-rojo-700/80">No se entregó · {x.motivo}</p>
      <p className="flex justify-between text-xs"><span>{x.destino}</span><Link href={`/pedidos/${x.pedidoId}`} className="font-semibold text-verde-800 underline">Abrir ›</Link></p>
    </div>
  );
}

function BloqueSiluetas({ lista }: { lista: Silueta[] }) {
  if (lista.length === 0) return null;
  return (
    <div className="space-y-1.5 border-t border-stone-300 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">No se entregaron ({lista.length})</p>
      {lista.map((x) => <FilaSilueta key={x.id} x={x} />)}
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
        <span className="text-[14px] font-semibold">{f.barrio}</span>
        <span className="text-[14px] font-semibold leading-snug">{f.cliente}<EstadoPagoWeb webOrden={f.webOrden} pagado={f.pagoMp} medio={f.pagoTexto} /></span>
        <span className="text-[14px] leading-snug">
          {f.direccion}
          {f.comentario && <span className="mt-0.5 block text-[13px] font-medium text-rojo-700">{f.comentario}</span>}
        </span>
        <span className="text-[14px] tabular-nums">{f.telefono ? (wa ? <a href={wa} target="_blank" rel="noreferrer" className="hover:text-verde-800 hover:underline">{f.telefono}</a> : f.telefono) : <span className="text-stone-400">—</span>}</span>
        <span className="inline-grid justify-center justify-self-center gap-x-2 gap-y-0.5 text-left text-[14px] [grid-template-columns:auto_auto]">
          {f.items.map((i, k) => <span key={k} className="contents"><span className="text-right font-semibold tabular-nums">{i.cantidad}</span><span className="leading-snug">{i.nombre}</span></span>)}
        </span>
        <span className="text-[14px] font-semibold tabular-nums">{formatoPesos(f.monto)}</span>
        <span><span className={`inline-block rounded px-2 py-0.5 text-xs font-bold tracking-wide ${f.conFactura ? "bg-stone-700 text-white" : "bg-crema-200 text-stone-700"}`}>{f.conFactura ? "FACTURA" : "REMITO"}</span></span>
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
function FilaTarjeta({ f, n, bloqueada, fija, acc, salidas }: { f: Fila; n: number; bloqueada: boolean; fija: boolean; acc: Acciones; salidas: SalidaInfo[] }) {
  const [eligiendo, setEligiendo] = useState(false);
  const flujo = useFlujoEntrega(f, acc);
  const fondo = `bg-white ${BORDE_FILA[f.estado]}`;
  const grande = "h-12 rounded-lg border px-3 text-base font-semibold disabled:opacity-40";
  return (
    <article className={`space-y-3 rounded-xl border p-3 ${fondo}`}>
      <header className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-800 text-sm font-semibold text-white">{n}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold leading-snug">{f.cliente}</h3>
          <EstadoPagoWeb webOrden={f.webOrden} pagado={f.pagoMp} medio={f.pagoTexto} />
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

      <SelectorEntrega f={f} bloqueada={bloqueada} acc={acc} grande eligiendoCobro={flujo.eligiendoCobro} onEntregar={flujo.entregar} onNoEntregar={flujo.abrirMotivo} />

      {f.pagoMp && <div className="flex items-center justify-between rounded-lg border border-verde-700 bg-verde-50 px-3 py-3 font-semibold text-verde-800"><span>✓ Pago · {f.pagoTexto}</span>{!bloqueada && f.estado !== "ENTREGADO" && f.pagoTexto === "Transferencia" && <button type="button" onClick={() => { if (window.confirm(`¿Volver a "pendiente de pago" el pedido de ${f.cliente}?`)) acc.pagoWeb(f, false); }} aria-label="Volver a pago pendiente" className="px-2 text-xl">✕</button>}</div>}
      {f.webOrden && !f.pagoMp && !bloqueada && <button type="button" onClick={() => { if (window.confirm(`¿Confirmás que YA LLEGÓ la transferencia de ${formatoPesos(f.monto)} de ${f.cliente}?\n\nRevisá que esté acreditada en la cuenta.`)) acc.pagoWeb(f, true); }} className="h-12 w-full rounded-lg border border-rojo-600 bg-white font-semibold text-rojo-700">Pendiente de pago · Confirmar…</button>}
      {(f.estado === "ENTREGADO" || flujo.eligiendoCobro) && !f.pagoMp && !f.webOrden && (
        <div className="space-y-2">
          {f.cobro === "COBRADO" && !flujo.eligiendoCobro ? (
            <div className="flex items-center justify-between rounded-lg bg-verde-700 px-3 py-3 font-semibold text-white"><span>✓ PAGO · {textoMedio(f.medioCobro)}</span>{!bloqueada && <button type="button" onClick={() => acc.deshacer(f)} aria-label="Deshacer el cobro" className="px-2 text-xl">✕</button>}</div>
          ) : f.cobro === "CUENTA_CORRIENTE" && !flujo.eligiendoCobro ? (
            <div className={`flex items-center justify-between rounded-lg border px-3 py-3 font-semibold ${CELESTE}`}><span>CUENTA CORRIENTE</span>{!bloqueada && <button type="button" onClick={() => acc.deshacer(f)} aria-label="Deshacer" className="px-2 text-xl">✕</button>}</div>
          ) : eligiendo ? (
            <div className="grid grid-cols-2 gap-2">
              {MEDIOS_COBRO.map((m) => <button key={m.valor} type="button" onClick={() => { setEligiendo(false); flujo.elegirCobro(m.valor); }} className="h-12 rounded-lg border border-verde-700 bg-white font-semibold text-verde-800">{m.texto}</button>)}
              <button type="button" onClick={() => setEligiendo(false)} className="col-span-2 h-10 rounded-lg border border-stone-300 bg-white text-stone-600">Volver</button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-center text-sm font-semibold text-stone-700">¿Cómo se cobra?</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={bloqueada} onClick={() => setEligiendo(true)} className={`${grande} border-verde-700 bg-white text-verde-800`}>Pago</button>
                {!f.webOrden && <button type="button" disabled={bloqueada} onClick={() => flujo.elegirCobro("CC")} className={`${grande} border-[#1c8fd1] bg-white text-[#1475ac]`}>Cuenta corriente</button>}
              </div>
              {flujo.eligiendoCobro && <button type="button" onClick={flujo.cancelar} className="w-full text-sm text-stone-500 underline">Cancelar la entrega</button>}
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
        {f.webOrden ? <span /> : <BotonRemito pedidoId={f.id} numero={f.remito} clase={`h-12 w-full rounded-lg border px-3 text-base font-semibold ${f.remito ? "border-stone-800 bg-white text-stone-900" : f.estado === "ENTREGADO" && !f.conFactura ? "border-rojo-600 bg-rojo-50 text-rojo-800 ring-1 ring-rojo-600" : "border-stone-300 bg-white text-stone-700"}`} />}
        <Link href={`/pedidos/${f.id}`} className="flex h-12 items-center justify-center rounded-lg border border-stone-300 bg-white px-3 text-base font-semibold">Abrir pedido</Link>
      </div>
      <div className="grid grid-cols-2 gap-2"><Selectores f={f} salidas={salidas} bloqueada={fija} acc={acc} clase="h-12 w-full" /></div>
      <ModalMotivo abierto={flujo.motivoAbierto} titulo="¿Por qué no se entregó?" ayuda={`${f.cliente}: el pedido vuelve a Pedidos para reprogramarlo.`} textoBoton="No se entregó" enviando={flujo.enviando} error={flujo.error} onCancelar={flujo.cerrarMotivo} onGuardar={flujo.guardarMotivo} />
    </article>
  );
}

const urlRuta = (filas: Fila[]) => `https://www.google.com/maps/dir/${filas.map((f) => encodeURIComponent(`${f.direccion}, ${f.barrio}`)).join("/")}`;

// Resumen de la vuelta de un vehículo (al final de su cuadro): a la izquierda la barra de paquetes contra la capacidad; a la derecha la facturación.
function ResumenVuelta({ grupo, capacidad }: { grupo: Fila[]; capacidad: number | null }) {
  const paquetes = grupo.reduce((t, f) => t + f.bultos, 0);
  const total = grupo.reduce((t, f) => t + f.monto, 0);
  const pasado = capacidad !== null && paquetes > capacidad;
  const pct = capacidad ? Math.min(100, Math.round((paquetes / capacidad) * 100)) : 0;
  const estado = capacidad === null ? "" : pasado ? `Te pasaste ${paquetes - capacidad}` : paquetes === capacidad ? "Completa" : `Quedan ${capacidad - paquetes}`;
  return (
    <footer aria-label="Resumen de la vuelta" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-stone-400 bg-crema-100 px-5 py-3 text-stone-900">
      <div className="w-64" title={pasado ? "Se pasó de la capacidad (solo avisa, no frena)" : undefined}>
        <p className="flex items-baseline justify-between gap-2 text-sm font-semibold">
          <span className="tabular-nums">{capacidad !== null ? `${paquetes} de ${capacidad} paquetes` : `${paquetes} paquetes`}</span>
          {estado && <span className={`text-xs ${pasado ? "font-bold text-rojo-700" : "font-medium text-stone-600"}`}>{estado}</span>}
        </p>
        {capacidad !== null && (
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-300">
            <div className={`h-full ${pasado ? "bg-rojo-600" : "bg-stone-700"}`} style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
      <p className="text-sm font-semibold uppercase tracking-wide text-stone-600">
        Facturación <span className="ml-1 text-base font-bold tabular-nums normal-case tracking-normal text-stone-900">{formatoPesos(total)}</span>
      </p>
    </footer>
  );
}

type Props = {
  estadoDia: { estado: "ARMANDO" | "LISTA" | "CERRADA"; por: string; cuando: string };
  hoy: string;
  siluetas: Silueta[];
  titulo: string;
  fecha: string;
  filasIniciales: Fila[];
  salidas: SalidaInfo[];
  vehiculosLibres: Opcion[];
  repartidores: Opcion[];
  diasSemana: { fecha: string; corta: string }[]; // corta = "Lun 28/9"
  cerrado: boolean;
  esDueno: boolean;
};

// Los tres estados de un día, siempre a la vista: ① Armando → ② Lista → ③ Cerrada, con lo que se puede hacer en cada uno.
function BarraEstado({ estado, esDueno, hayPedidos, resumen, onDejarLista, onVolverArmar, onCerrar, onReabrirDia }: {
  estado: Props["estadoDia"];
  esDueno: boolean;
  hayPedidos: boolean;
  resumen: { entregados: number; sinMarcar: number; noEntregados: number };
  onDejarLista: () => void;
  onVolverArmar: () => void;
  onCerrar: () => void;
  onReabrirDia: () => void;
}) {
  const orden = { ARMANDO: 0, LISTA: 1, CERRADA: 2 } as const;
  const actual = orden[estado.estado];
  const pasos = ["Armando", "Lista", "Cerrada"];
  const boton = "h-10 rounded-md px-5 text-sm font-semibold shadow-sm";
  return (
    <section className="mx-auto grid w-full max-w-3xl grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-xl border border-stone-300 bg-white px-5 py-3 shadow-sm" aria-label="Estado de la hoja de ruta">
      <div className="justify-self-start">
        {estado.estado === "LISTA" && <button type="button" onClick={onVolverArmar} className={`${boton} border border-stone-400 bg-white text-stone-800 hover:bg-crema-100`}>← Volver a armar</button>}
        {estado.estado === "CERRADA" && esDueno && <button type="button" onClick={onReabrirDia} className={`${boton} border border-stone-400 bg-white text-stone-800 hover:bg-crema-100`}>← Reabrir día</button>}
      </div>
      <ol className="flex items-center justify-center gap-1 text-sm">
        {pasos.map((p, i) => {
          const hecho = i < actual;
          const ahora = i === actual;
          return (
            <li key={p} className="flex items-center gap-1">
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${hecho ? "bg-verde-700 text-white" : ahora ? "bg-stone-800 text-white ring-4 ring-stone-800/15" : "border border-stone-300 bg-white text-stone-400"}`}>{hecho ? "✓" : i + 1}</span>
              <span className={`mr-1 font-semibold ${ahora ? "text-stone-900" : hecho ? "text-verde-800" : "text-stone-400"}`}>{p}</span>
              {i < pasos.length - 1 && <span className={`mx-1 h-0.5 w-8 rounded ${i < actual ? "bg-verde-700" : "bg-stone-300"}`} />}
            </li>
          );
        })}
      </ol>
      <div className="justify-self-end">
        {estado.estado === "ARMANDO" && hayPedidos && <button type="button" onClick={onDejarLista} className={`${boton} bg-verde-700 text-white hover:bg-verde-800`}>Dejar lista →</button>}
        {estado.estado === "LISTA" && <button type="button" onClick={onCerrar} className={`${boton} bg-stone-800 text-white hover:bg-stone-700`}>Cerrar día →</button>}
      </div>
    </section>
  );
}

export function HojaDia({ estadoDia, hoy, siluetas, titulo, fecha, filasIniciales, salidas, vehiculosLibres, repartidores, diasSemana, cerrado, esDueno }: Props) {
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
    dias: diasSemana.filter((d) => d.fecha !== fecha && d.fecha >= hoy).map((d) => ({ fecha: d.fecha, texto: d.corta })),
    entrega: (f, valor) => ejecutar(f.id, (x) => ({ ...x, estado: valor, cobro: null, medioCobro: null }), () => marcarEntrega(f.id, valor)),
    entregarYCobrar: (f, cobro) =>
      ejecutar(
        f.id,
        (x) => ({ ...x, estado: "ENTREGADO", ...(cobro === "CC" ? { cobro: "CUENTA_CORRIENTE" as const, medioCobro: null } : cobro ? { cobro: "COBRADO" as const, medioCobro: cobro } : {}) }),
        () => marcarEntrega(f.id, "ENTREGADO", cobro),
      ),
    // No entregado: el pedido sale de esta hoja (vuelve a Pedidos) y, al refrescar, aparece su silueta.
    noEntregado: async (f, motivo) => {
      const r = await registrarNoEntrega(f.id, motivo);
      if (!r.ok) return r.error ?? "No se pudo guardar.";
      setFilas((fs) => fs.filter((x) => x.id !== f.id));
      router.refresh();
      return null;
    },
    cobrar: (f, medio) => ejecutar(f.id, (x) => ({ ...x, cobro: "COBRADO", medioCobro: medio }), () => registrarCobro(f.id, medio)),
    cuentaCorriente: (f) => ejecutar(f.id, (x) => ({ ...x, cobro: "CUENTA_CORRIENTE" }), () => dejarEnCuentaCorriente(f.id)),
    pagoWeb: (f, pagado) => ejecutar(f.id, (x) => ({ ...x, pagoMp: pagado, pagoTexto: pagado ? "Transferencia" : null }), () => marcarPagoWeb(f.id, pagado)),
    deshacer: (f) => ejecutar(f.id, (x) => ({ ...x, cobro: null, medioCobro: null }), () => deshacerCobro(f.id)),
    factura: (f, numero) => ejecutar(f.id, (x) => ({ ...x, numeroFactura: normalizarFactura(numero) ?? "" }), () => guardarNumeroFactura(f.id, numero)),
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
    if (!e.over || fija) return;
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
  const cerrar = () => {
    if (window.confirm("¿Cerrar el día? Después no se puede mover ni cambiar nada de este día, y solo un dueño lo puede reabrir.")) llamar(() => cerrarDia(fecha));
  };
  const pasado = fecha < hoy;
  const fija = estadoDia.estado !== "ARMANDO"; // lista o cerrada: la estructura no se mueve
  const dejarLista = () => llamar(() => dejarListo(fecha));
  const volverArmar = () => {
    if (window.confirm("¿Volver a armar la hoja? Se vuelve a poder mover todo. Si ya imprimieron remitos, revisá que sigan siendo los mismos.")) llamar(() => reabrirHoja(fecha));
  };
  const sumarVehiculo = (vehiculoId: string) => {
    if (vehiculoId) llamar(() => agregarSalida(fecha, vehiculoId, null));
  };

  const siluetasDe = (id: string) => siluetas.filter((x) => x.salidaId === id);
  const tabla = (grupo: Fila[], salida: SalidaInfo, sil: Silueta[]) => {
    const lugares = lugaresDelRecorrido(grupo, sil);
    return (
    <>
      <div className="space-y-3 p-3 xl:hidden">
        {lugares.map((l) => l.f ? <FilaTarjeta key={l.f.id} f={l.f} n={l.n} bloqueada={cerrado} fija={fija} acc={acc} salidas={salidas} /> : <FilaSiluetaTarjeta key={l.x!.id} x={l.x!} n={l.n} />)}
      </div>
      <div className="hidden p-3 xl:block">
        <div role="table" className="space-y-1.5">
          <div role="row" style={{ gridTemplateColumns: COLUMNAS }} className="grid items-center gap-x-2 border-b border-stone-400 px-2 pb-1.5 text-center text-xs font-bold uppercase tracking-wide text-stone-800">
            {ENCABEZADOS.map((h) => <div key={h} role="columnheader">{h}</div>)}
          </div>
          <SortableContext items={grupo.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            {lugares.map((l) => l.f ? <FilaHoja key={l.f.id} f={l.f} n={l.n} bloqueada={cerrado} fija={fija} acc={acc} salidas={salidas} /> : <FilaSiluetaTabla key={l.x!.id} x={l.x!} n={l.n} />)}
          </SortableContext>
        </div>
      </div>
    </>
    );
  };

  return (
    <DndContext id="hoja-de-ruta" sensors={sensores} collisionDetection={colision} onDragStart={() => setArrastrando(true)} onDragCancel={() => setArrastrando(false)} onDragEnd={alSoltar}>
    <div className="space-y-4">
      {/* Título del día y total de paquetes (todo el día: ubicados o no), para saber si nos pasamos de producción */}
      <div className="flex flex-col items-center gap-2 pt-3">
        <h2 className="text-base font-bold uppercase tracking-wide">{titulo}</h2>
        <div className="inline-flex items-baseline gap-2 rounded-md border border-stone-400 bg-white px-5 py-2">
          <span className="text-xs font-medium uppercase tracking-wide text-stone-600">Paquetes del día</span>
          <span className="text-base font-bold tabular-nums">{filas.reduce((t, f) => t + f.bultos, 0)}</span>
        </div>
      </div>
      <BarraEstado
        estado={estadoDia}
        esDueno={esDueno}
        hayPedidos={filas.length > 0 || siluetas.length > 0}
        resumen={{ entregados: filas.filter((f) => f.estado === "ENTREGADO").length, sinMarcar: filas.filter((f) => f.estado !== "ENTREGADO").length, noEntregados: siluetas.length }}
        onDejarLista={dejarLista}
        onVolverArmar={volverArmar}
        onCerrar={cerrar}
        onReabrirDia={reabrir}
      />
      <div className="grid items-center gap-3 text-sm sm:grid-cols-[1fr_auto_1fr]">
        {/* Sumar un vehículo a la salida de este día: chico, un solo desplegable; al elegirlo se abre su cuadro */}
        {!fija ? (
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
          <span />
        )}
        <h2 className="text-center text-sm font-bold uppercase tracking-wide text-stone-800">
          {sinVehiculo.length > 0 && <>Sin ubicar <span className="font-medium normal-case tracking-normal text-stone-600">· {sinVehiculo.length} {sinVehiculo.length === 1 ? "pedido" : "pedidos"}</span></>}
        </h2>
        <div className="flex flex-wrap items-center gap-2 sm:justify-self-end">
          {filas.length > 0 && <button type="button" onClick={imprimirTodos} className="rounded-md border border-stone-400 bg-white px-3 py-2 font-medium shadow-sm">Imprimir todos los remitos</button>}
        </div>
      </div>
      {pasado && !cerrado && <p className="rounded-lg border border-stone-400 bg-crema-100 p-3 text-center text-sm font-semibold text-stone-800">Este día ya pasó y falta cerrarlo. No se le pueden sumar pedidos.</p>}
      {error && <p className="whitespace-pre-line rounded-lg border border-rojo-600 bg-rojo-50 p-3 text-sm text-rojo-700" role="alert">{error}</p>}

      {/* Pedidos del día que todavía no están en ningún vehículo: la misma información que en la hoja PEDIDOS */}
      {(sinVehiculo.length > 0 || arrastrando) && (
        <Zona id="sin" bloqueada={fija} clase="space-y-2 rounded-xl p-1">
          {sinVehiculo.length > 0 ? (
            <>
              <div className={`hidden gap-x-4 px-5 text-center text-xs font-semibold uppercase tracking-wide text-stone-600 lg:grid ${COLUMNAS_UBICAR}`}>
                {["", "Barrio", "Cliente", "Dirección", "Teléfono", "Pedido", "Monto", "Factura", "", "Ubicar en", "Día"].map((h, i) => <span key={i}>{h}</span>)}
              </div>
              {sinVehiculo.map((f) => <FilaUbicar key={f.id} f={f} salidas={salidas} bloqueada={fija} acc={acc} />)}
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
          <Zona key={sa.id} id={sa.id} bloqueada={fija} clase="overflow-hidden rounded-xl border border-stone-400 bg-white shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-400 bg-crema-100 px-5 py-3 text-stone-900">
              <div>
                <h2 className="text-lg font-bold leading-tight">{sa.nombre}</h2>
                {sa.patente && <p className="text-xs text-stone-600">{sa.patente}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {grupo.length > 0 && <a href={urlRuta(grupo)} target="_blank" rel="noreferrer" className="rounded-md border border-stone-400 bg-white px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-crema-50">Ver ruta en Google Maps</a>}
                {!fija && <button type="button" onClick={() => { if (window.confirm(`¿Sacar ${sa.nombre} del día? Sus pedidos quedan “sin ubicar”.`)) llamar(() => quitarSalida(sa.id)); }} className="rounded-md border border-stone-400 bg-white px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-crema-50">Sacar del día</button>}
              </div>
            </header>
            {grupo.length === 0 && siluetasDe(sa.id).length === 0 ? (
              <p className="p-6 text-center text-sm text-stone-600">Todavía no tiene pedidos. Arrastralos desde “Sin ubicar”.</p>
            ) : tabla(grupo, sa, siluetasDe(sa.id))}
            <ResumenVuelta grupo={grupo} capacidad={sa.capacidad} />
          </Zona>
        );
      })}

      {/* Siluetas de pedidos cuya camioneta ya no está en el día */}
      {siluetas.some((x) => !salidas.some((sa) => sa.id === x.salidaId)) && (
        <section className="overflow-hidden rounded-xl border border-stone-300 bg-white">
          <BloqueSiluetas lista={siluetas.filter((x) => !salidas.some((sa) => sa.id === x.salidaId))} />
        </section>
      )}

      {filas.length === 0 && siluetas.length === 0 && <p className="rounded-lg border border-dashed border-stone-400 p-8 text-center text-stone-600">Todavía no hay pedidos en este día. Asignalos desde Pedidos.</p>}
    </div>
    </DndContext>
  );
}
