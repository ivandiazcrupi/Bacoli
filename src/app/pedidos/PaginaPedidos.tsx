"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { DndContext, DragOverlay, MouseSensor, TouchSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { formatoPesos } from "@/lib/numeros";
import { HojaDia, type Fila } from "./dia/[fecha]/HojaDia";
import { asignarADia } from "./actions";
import type { FilaBandeja } from "./filas";

export type Dia = { fecha: string; titulo: string; subtitulo: string; corta: string; hoy: boolean; cerrado: boolean; filas: Fila[]; monto: number };

const COLUMNAS = "32px 140px 220px 190px 120px minmax(240px,1fr) 110px 100px minmax(330px,auto)";
const ENCABEZADOS = ["", "Barrio", "Cliente", "Dirección", "Teléfono", "Pedido", "Monto", "Comprobante", "Asignar a un día"];

function Comprobante({ conFactura }: { conFactura: boolean }) {
  return <span className={`rounded px-2 py-0.5 text-xs font-semibold ${conFactura ? "bg-stone-800 text-white" : "bg-stone-200 text-stone-700"}`}>{conFactura ? "FACTURA" : "REMITO"}</span>;
}

function BotonesDia({ dias, alAsignar, grande }: { dias: Dia[]; alAsignar: (fecha: string) => void; grande?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Asignar a un día">
      {dias.map((d) => (
        <button
          key={d.fecha}
          type="button"
          disabled={d.cerrado}
          onClick={() => alAsignar(d.fecha)}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={`Asignar al ${d.titulo}`}
          title={d.cerrado ? "Ese día está cerrado" : `Asignar al ${d.titulo} ${d.subtitulo}`}
          className={`rounded-md border px-2.5 font-medium disabled:opacity-40 ${grande ? "h-11 min-w-12 text-base" : "h-9 text-sm"} ${d.hoy ? "border-stone-800 bg-white" : "border-stone-300 bg-white"} hover:bg-crema-200`}
        >
          {d.corta}
        </button>
      ))}
    </div>
  );
}

function FilaSinAsignar({ f, dias, alAsignar }: { f: FilaBandeja; dias: Dia[]; alAsignar: (id: string, fecha: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: f.id });
  return (
    <div ref={setNodeRef} role="row" style={{ gridTemplateColumns: COLUMNAS, opacity: isDragging ? 0.35 : 1 }} className="grid items-start gap-x-3 rounded-lg border border-verde-600 bg-white px-2 py-2 text-sm">
      <div role="cell">
        <button type="button" aria-label={`Arrastrar el pedido de ${f.cliente}`} className="flex h-8 w-7 cursor-grab items-center justify-center rounded text-lg leading-none text-stone-400 hover:bg-crema-100 hover:text-stone-700" {...attributes} {...listeners}>⋮⋮</button>
      </div>
      <div role="cell" className="pt-1.5 font-medium">{f.barrio}</div>
      <div role="cell" className="pt-1.5 font-semibold leading-snug">{f.cliente}</div>
      <div role="cell" className="pt-1.5 leading-snug">{f.direccion}{f.comentario && <p className="text-xs font-medium text-rojo-700">{f.comentario}</p>}</div>
      <div role="cell" className="pt-1.5 tabular-nums">{f.telefono || <span className="text-stone-400">—</span>}</div>
      <div role="cell" className="space-y-0.5 pt-1.5">
        {f.items.map((i, k) => (
          <p key={k} className="flex gap-2 leading-snug"><span className="min-w-6 shrink-0 text-right font-semibold tabular-nums">{i.cantidad}</span><span>{i.nombre}</span></p>
        ))}
      </div>
      <div role="cell" className="pt-1.5 text-right font-semibold tabular-nums">{formatoPesos(f.monto)}</div>
      <div role="cell" className="pt-1.5"><Comprobante conFactura={f.conFactura} /></div>
      <div role="cell" className="flex flex-wrap items-center gap-2">
        <BotonesDia dias={dias} alAsignar={(fecha) => alAsignar(f.id, fecha)} />
        <Link href={`/pedidos/${f.id}`} className="text-xs text-stone-500 underline">Abrir</Link>
      </div>
    </div>
  );
}

function TarjetaSinAsignar({ f, dias, alAsignar }: { f: FilaBandeja; dias: Dia[]; alAsignar: (id: string, fecha: string) => void }) {
  return (
    <article className="space-y-2 rounded-xl border border-verde-600 bg-white p-3">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-bold leading-snug">{f.cliente}</h3>
          <p className="text-sm text-stone-600">{f.barrio} · {f.direccion}</p>
          {f.comentario && <p className="text-sm font-medium text-rojo-700">{f.comentario}</p>}
        </div>
        <Comprobante conFactura={f.conFactura} />
      </header>
      <ul className="text-base">
        {f.items.map((i, k) => <li key={k} className="flex gap-3"><span className="w-8 shrink-0 text-right font-bold tabular-nums">{i.cantidad}</span><span>{i.nombre}</span></li>)}
      </ul>
      <p className="text-right text-lg font-bold tabular-nums">{formatoPesos(f.monto)}</p>
      <BotonesDia dias={dias} alAsignar={(fecha) => alAsignar(f.id, fecha)} grande />
      <Link href={`/pedidos/${f.id}`} className="block text-sm text-stone-600 underline">Abrir pedido</Link>
    </article>
  );
}

function EncabezadoDia({ d, abierto, alternar }: { d: Dia; abierto: boolean; alternar: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `dia-${d.fecha}`, disabled: d.cerrado });
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={alternar}
      aria-expanded={abierto}
      className={`flex w-full items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left ${d.hoy ? "border-stone-800" : "border-stone-300"} ${abierto ? "bg-white" : "bg-crema-100"} ${isOver ? "ring-2 ring-verde-600" : ""}`}
    >
      <span className="flex items-baseline gap-3">
        <span className="text-stone-500" aria-hidden="true">{abierto ? "▾" : "▸"}</span>
        <span className="text-lg font-bold">{d.titulo}</span>
        <span className="text-sm text-stone-500">{d.subtitulo}{d.hoy ? " · hoy" : ""}</span>
        {d.cerrado && <span className="rounded bg-stone-800 px-2 py-0.5 text-xs font-semibold text-white">Cerrado</span>}
      </span>
      <span className="text-sm text-stone-600">
        <b className="tabular-nums text-stone-900">{d.filas.length}</b> {d.filas.length === 1 ? "pedido" : "pedidos"}
        {d.filas.length > 0 && <> · <span className="tabular-nums">{formatoPesos(d.monto)}</span></>}
      </span>
    </button>
  );
}

export function PaginaPedidos({ bandeja: bandejaInicial, dias, esDueno, abiertosIniciales }: { bandeja: FilaBandeja[]; dias: Dia[]; esDueno: boolean; abiertosIniciales: string[] }) {
  const router = useRouter();
  const [bandeja, setBandeja] = useState(bandejaInicial);
  const [abiertos, setAbiertos] = useState<string[]>(abiertosIniciales);
  const [error, setError] = useState<string | null>(null);
  const [activo, setActivo] = useState<string | null>(null);
  const [, empezar] = useTransition();
  useEffect(() => setBandeja(bandejaInicial), [bandejaInicial]);

  const sensores = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }));
  const alternar = (fecha: string) => setAbiertos((a) => (a.includes(fecha) ? a.filter((x) => x !== fecha) : [...a, fecha]));

  const asignar = (id: string, fecha: string) => {
    const antes = bandeja;
    setError(null);
    setBandeja((b) => b.filter((x) => x.id !== id));
    empezar(async () => {
      const r = await asignarADia(id, fecha);
      if (!r.ok) {
        setBandeja(antes);
        setError(r.error ?? "No se pudo asignar el pedido.");
      }
      router.refresh();
    });
  };

  const alSoltar = (e: DragEndEvent) => {
    setActivo(null);
    const destino = e.over ? String(e.over.id) : "";
    if (destino.startsWith("dia-")) asignar(String(e.active.id), destino.slice(4));
  };
  const enArrastre = bandeja.find((f) => f.id === activo);

  return (
    <div className="space-y-8">
      {error && <p className="rounded-lg border border-rojo-600 bg-rojo-50 p-3 text-sm text-rojo-700" role="alert">{error}</p>}

      <DndContext sensors={sensores} collisionDetection={pointerWithin} onDragStart={(e: DragStartEvent) => setActivo(String(e.active.id))} onDragEnd={alSoltar} onDragCancel={() => setActivo(null)}>
        <section className="space-y-3" aria-label="Sin asignar">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="text-xl font-bold">Sin asignar</h2>
            <span className="rounded-full bg-crema-200 px-2.5 py-0.5 text-sm font-semibold tabular-nums">{bandeja.length}</span>
            <p className="text-sm text-stone-600">Los pedidos cargados que todavía no tienen día. Asignalos con el botón del día, o arrastralos hasta el día de abajo.</p>
          </div>
          {bandeja.length === 0 ? (
            <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-stone-600">No hay pedidos sin asignar.</p>
          ) : (
            <>
              <div className="space-y-3 lg:hidden">
                {bandeja.map((f) => <TarjetaSinAsignar key={f.id} f={f} dias={dias} alAsignar={asignar} />)}
              </div>
              <div className="hidden overflow-x-auto pb-2 lg:block">
                <div role="table" className="min-w-[1500px] space-y-2">
                  <div role="row" style={{ gridTemplateColumns: COLUMNAS }} className="grid gap-x-3 px-2 text-xs font-semibold text-stone-500">
                    {ENCABEZADOS.map((h, n) => <div key={n} role="columnheader" className={h === "Monto" ? "text-right" : ""}>{h}</div>)}
                  </div>
                  {bandeja.map((f) => <FilaSinAsignar key={f.id} f={f} dias={dias} alAsignar={asignar} />)}
                </div>
              </div>
            </>
          )}
        </section>

        <section className="space-y-3" aria-label="Días de la semana">
          <h2 className="text-xl font-bold">Días de la semana</h2>
          <div className="space-y-3">
            {dias.map((d) => {
              const abierto = abiertos.includes(d.fecha);
              return (
                <div key={d.fecha} className="space-y-3">
                  <EncabezadoDia d={d} abierto={abierto} alternar={() => alternar(d.fecha)} />
                  {abierto && (
                    <div className="space-y-2 pl-0 lg:pl-2">
                      <HojaDia fecha={d.fecha} filasIniciales={d.filas} cerrado={d.cerrado} esDueno={esDueno} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <DragOverlay>
          {enArrastre ? (
            <div className="rounded-lg border border-verde-600 bg-white p-3 text-sm shadow-lg">
              <p className="font-semibold">{enArrastre.cliente}</p>
              <p className="text-stone-600">{enArrastre.items.map((i) => `${i.cantidad} ${i.nombre}`).join(" · ")}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
