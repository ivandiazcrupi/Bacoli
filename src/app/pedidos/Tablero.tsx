"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, closestCorners, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatoPesos } from "@/lib/numeros";
import { moverPedido } from "./actions";

export type Tarjeta = {
  id: string;
  cliente: string;
  sucursal: string;
  zona: string;
  estado: "PENDIENTE" | "ENTREGADO" | "NO_ENTREGADO";
  items: { nombre: string; cantidad: number; unidad: string }[];
  total: number;
  conFactura: boolean;
};
export type Columna = { clave: string; titulo: string; subtitulo?: string; hoy?: boolean; corta?: string; cerrado?: boolean };

const BANDEJA = "bandeja";

function ContenidoTarjeta({ t, numero, columnas, alAsignar }: { t: Tarjeta; numero?: number; columnas?: Columna[]; alAsignar?: (clave: string) => void }) {
  const mostrar = t.items.slice(0, 4);
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        {numero !== undefined && <span className="mt-0.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-stone-800 px-1.5 text-xs font-semibold text-white">{numero}</span>}
        <div className="min-w-0 flex-1">
          <Link href={`/pedidos/${t.id}`} draggable={false} className="block break-words font-semibold leading-snug hover:underline">{t.cliente}</Link>
          <p className="truncate text-xs text-stone-500">{t.sucursal} · {t.zona}</p>
        </div>
      </div>
      <ul className="space-y-0.5 text-sm">
        {mostrar.map((i, n) => (
          <li key={n} className="flex justify-between gap-2"><span className="truncate">{i.nombre}</span><span className="shrink-0 tabular-nums">{i.cantidad}</span></li>
        ))}
        {t.items.length > mostrar.length && <li className="text-xs text-stone-500">+{t.items.length - mostrar.length} más</li>}
      </ul>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="tabular-nums text-stone-600">{formatoPesos(t.total)}{t.conFactura ? " · factura" : ""}</span>
        {t.estado === "ENTREGADO" && <span className="font-semibold text-green-700">Entregado</span>}
        {t.estado === "NO_ENTREGADO" && <span className="font-semibold text-red-700">No entregado</span>}
      </div>
      {columnas && alAsignar && (
        <div className="flex flex-wrap gap-1 pt-1" aria-label="Asignar a un día">
          {columnas.map((c) => (
            <button
              key={c.clave}
              type="button"
              onClick={() => alAsignar(c.clave)}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label={`Asignar al ${c.titulo}`}
              className="h-8 min-w-9 rounded-md border border-stone-300 bg-white px-2 text-xs font-medium text-stone-700 active:bg-amber-100"
            >
              {c.corta}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TarjetaArrastable({ t, numero, columnas, alAsignar }: { t: Tarjeta; numero?: number; columnas?: Columna[]; alAsignar?: (clave: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: t.id, disabled: t.estado === "ENTREGADO" });
  const borde = t.estado === "ENTREGADO" ? "border-green-600 bg-green-50" : t.estado === "NO_ENTREGADO" ? "border-red-600 bg-red-50" : "border-stone-200 bg-white";
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1, touchAction: "manipulation" }}
      className={`cursor-grab rounded-lg border p-3 shadow-sm ${borde}`}
      {...attributes}
      {...listeners}
    >
      <ContenidoTarjeta t={t} numero={numero} columnas={columnas} alAsignar={alAsignar} />
    </div>
  );
}

function ColumnaVisual({ c, ids, tarjetas, columnas, alAsignar }: { c: Columna; ids: string[]; tarjetas: Record<string, Tarjeta>; columnas: Columna[]; alAsignar: (id: string, clave: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: c.clave });
  const esBandeja = c.clave === BANDEJA;
  return (
    <section
      id={`col-${c.clave}`}
      aria-label={c.titulo}
      className={`flex w-[82vw] max-w-[300px] shrink-0 snap-start flex-col rounded-xl border p-2 sm:w-auto sm:min-w-[210px] sm:max-w-none sm:flex-1 ${esBandeja ? "border-amber-600 bg-amber-50" : c.hoy ? "border-stone-800 bg-white" : "border-stone-200 bg-stone-100"} ${isOver ? "ring-2 ring-amber-600" : ""}`}
    >
      <header className="flex items-baseline justify-between px-1 pb-2">
        <div>
          <h2 className="text-base font-bold">
            {esBandeja ? c.titulo : <Link href={`/pedidos/dia/${c.clave}`} className="hover:underline" title="Abrir la hoja de este día">{c.titulo} →</Link>}
          </h2>
          {c.subtitulo && <p className="text-xs text-stone-500">{c.subtitulo}{c.hoy ? " · hoy" : ""}{c.cerrado ? " · cerrado" : ""}</p>}
        </div>
        <span className="rounded-full bg-white px-2 py-0.5 text-sm font-semibold tabular-nums">{ids.length}</span>
      </header>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-2">
          {ids.map((id, n) => (
            <TarjetaArrastable key={id} t={tarjetas[id]} numero={esBandeja ? undefined : n + 1} columnas={esBandeja ? columnas : undefined} alAsignar={esBandeja ? (clave) => alAsignar(id, clave) : undefined} />
          ))}
          {ids.length === 0 && <p className="m-auto px-2 py-6 text-center text-xs text-stone-500">{esBandeja ? "No hay pedidos sin asignar" : "Arrastrá pedidos acá"}</p>}
        </div>
      </SortableContext>
    </section>
  );
}

export function Tablero({ columnas, inicial, tarjetas }: { columnas: Columna[]; inicial: Record<string, string[]>; tarjetas: Record<string, Tarjeta> }) {
  const [cols, setCols] = useState(inicial);
  const [activo, setActivo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, empezar] = useTransition();
  const foto = useRef<Record<string, string[]>>(inicial);
  const dias = columnas.filter((c) => c.clave !== BANDEJA);

  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  const buscar = (id: string, estado = cols) => (id in estado ? id : Object.keys(estado).find((k) => estado[k].includes(id)));

  const guardar = (id: string, clave: string, ids: string[], nuevoEstado: Record<string, string[]>) => {
    setError(null);
    empezar(async () => {
      const r = await moverPedido(id, clave, ids);
      if (!r.ok) {
        setCols(foto.current);
        setError(r.error ?? "No se pudo mover el pedido.");
      } else {
        foto.current = nuevoEstado;
      }
    });
  };

  const alEmpezar = (e: DragStartEvent) => {
    foto.current = cols;
    setActivo(String(e.active.id));
  };

  const alPasarPor = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const desde = buscar(String(active.id));
    const hasta = buscar(String(over.id));
    if (!desde || !hasta || desde === hasta) return;
    setCols((prev) => {
      const origen = prev[desde].filter((i) => i !== active.id);
      const destino = prev[hasta];
      const indiceSobre = destino.indexOf(String(over.id));
      const debajo = over.rect && active.rect.current.translated ? active.rect.current.translated.top > over.rect.top + over.rect.height / 2 : false;
      const posicion = String(over.id) in prev ? destino.length : indiceSobre >= 0 ? indiceSobre + (debajo ? 1 : 0) : destino.length;
      return { ...prev, [desde]: origen, [hasta]: [...destino.slice(0, posicion), String(active.id), ...destino.slice(posicion)] };
    });
  };

  const alSoltar = (e: DragEndEvent) => {
    const { active, over } = e;
    setActivo(null);
    const id = String(active.id);
    if (!over) { setCols(foto.current); return; }
    const columna = buscar(id);
    const sobre = buscar(String(over.id));
    if (!columna || !sobre) { setCols(foto.current); return; }
    let ids = cols[columna];
    if (columna === sobre && String(over.id) !== columna) {
      const viejo = ids.indexOf(id);
      const nuevo = ids.indexOf(String(over.id));
      if (viejo !== nuevo && nuevo >= 0) ids = arrayMove(ids, viejo, nuevo);
    }
    const siguiente = { ...cols, [columna]: ids };
    setCols(siguiente);
    const antes = foto.current[columna] ?? [];
    if (antes.length === ids.length && antes.every((x, n) => x === ids[n])) return; // no cambió nada
    guardar(id, columna, ids, siguiente);
  };

  const asignar = (id: string, clave: string) => {
    const desde = buscar(id);
    if (!desde) return;
    foto.current = cols;
    const ids = [...cols[clave], id];
    const siguiente = { ...cols, [desde]: cols[desde].filter((x) => x !== id), [clave]: ids };
    setCols(siguiente);
    guardar(id, clave, ids, siguiente);
  };

  return (
    <div className="space-y-3">
      {error && <p className="rounded-lg border border-red-600 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:hidden" aria-label="Ir a un día">
        {columnas.map((c) => (
          <button
            key={c.clave}
            type="button"
            onClick={() => document.getElementById(`col-${c.clave}`)?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" })}
            className={`flex shrink-0 flex-col items-center rounded-lg border px-3 py-2 text-sm font-medium ${c.hoy ? "border-stone-800 bg-white" : "border-stone-300 bg-white"}`}
          >
            <span>{c.clave === BANDEJA ? "Sin asignar" : c.corta}</span>
            <span className="text-xs tabular-nums text-stone-500">{(cols[c.clave] ?? []).length}</span>
          </button>
        ))}
      </nav>
      <DndContext sensors={sensores} collisionDetection={closestCorners} onDragStart={alEmpezar} onDragOver={alPasarPor} onDragEnd={alSoltar} onDragCancel={() => { setActivo(null); setCols(foto.current); }}>
        <div className="-mx-4 flex snap-x items-start gap-3 overflow-x-auto px-4 pb-4">
          {columnas.map((c) => (
            <ColumnaVisual key={c.clave} c={c} ids={cols[c.clave] ?? []} tarjetas={tarjetas} columnas={dias} alAsignar={asignar} />
          ))}
        </div>
        <DragOverlay>
          {activo ? (
            <div className="rotate-1 rounded-lg border border-amber-600 bg-white p-3 shadow-lg">
              <ContenidoTarjeta t={tarjetas[activo]} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
