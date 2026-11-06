"use client";

import { DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRef, useState, useTransition } from "react";
import { alternarTarea, borrarHechas, borrarTarea, crearTarea, ordenarTareas } from "./actions";

// Una tarea: casillero para tildar (si puede) y, para el gerente, una ✕ para borrarla.
export function FilaTarea({ id, titulo, hecha, puedeTildar, puedeBorrar }: { id: string; titulo: string; hecha: boolean; puedeTildar: boolean; puedeBorrar: boolean }) {
  const [pendiente, empezar] = useTransition();
  const [error, setError] = useState("");
  return (
    <li className="group flex items-start gap-3 py-1.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={hecha}
        aria-label={hecha ? `Destildar: ${titulo}` : `Marcar como hecha: ${titulo}`}
        disabled={!puedeTildar || pendiente}
        onClick={() => empezar(async () => { const r = await alternarTarea(id); setError(r.error ?? ""); })}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[13px] leading-none ${hecha ? "border-verde-700 bg-verde-700 text-white" : "border-stone-400 bg-white"} ${puedeTildar ? "cursor-pointer hover:border-stone-700" : "cursor-default"} disabled:opacity-60`}
      >{hecha ? "✓" : ""}</button>
      <span className={`min-w-0 flex-1 text-[14px] leading-snug ${hecha ? "text-stone-400 line-through" : "text-stone-900"}`}>{titulo}{error && <span className="ml-2 text-[12px] text-rojo-700 no-underline">{error}</span>}</span>
      {puedeBorrar && (
        <button type="button" aria-label="Borrar tarea" title="Borrar tarea" disabled={pendiente} onClick={() => window.confirm(`¿Borrar la tarea "${titulo}"?`) && empezar(async () => { await borrarTarea(id); })} className="shrink-0 px-1 text-[13px] text-stone-300 hover:text-rojo-700">✕</button>
      )}
    </li>
  );
}

// Campo para sumar una tarea (lo ven todos). Enter la guarda y queda listo para la siguiente.
export function NuevaTarea({ asignadaId }: { asignadaId: string }) {
  const [pendiente, empezar] = useTransition();
  const [error, setError] = useState("");
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      action={(fd) => empezar(async () => { const r = await crearTarea(asignadaId, fd); setError(r.error ?? ""); if (!r.error) ref.current?.reset(); })}
      className="mt-3 flex items-center gap-2 border-t border-stone-200 pt-3"
    >
      <input name="titulo" placeholder="+ Agregar una tarea…" aria-label="Nueva tarea" maxLength={200} autoComplete="off" disabled={pendiente} className="h-9 min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-3 text-[13px] placeholder:text-stone-400 focus:border-verde-700 focus:outline-none" />
      <button type="submit" disabled={pendiente} className="h-9 rounded-md border border-stone-300 bg-white px-3 text-[12px] font-semibold text-stone-700 hover:border-stone-600 disabled:opacity-50">Agregar</button>
      {error && <span className="text-[12px] text-rojo-700">{error}</span>}
    </form>
  );
}

export function BorrarHechas({ asignadaId, cuantas }: { asignadaId: string; cuantas: number }) {
  const [pendiente, empezar] = useTransition();
  return (
    <button type="button" disabled={pendiente} onClick={() => window.confirm(cuantas === 1 ? "¿Borrar la tarea ya hecha?" : `¿Borrar las ${cuantas} tareas ya hechas?`) && empezar(async () => { await borrarHechas(asignadaId); })} className="text-[12px] text-stone-400 underline-offset-2 hover:text-stone-700 hover:underline">
      {cuantas === 1 ? "Borrar la hecha" : `Borrar las ${cuantas} hechas`}
    </button>
  );
}

type DatosTarea = { id: string; titulo: string; hecha: boolean; borrable?: boolean }; // borrable: la cargó quien mira (puede borrarla aunque no sea gerente)

// Una fila que se puede arrastrar (solo las pendientes, solo el gerente): el asa ⋮⋮ de la izquierda.
function FilaOrdenable({ t, puedeTildar, puedeBorrar }: { t: DatosTarea; puedeTildar: boolean; puedeBorrar: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: t.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`relative bg-white ${isDragging ? "z-10 opacity-90 outline outline-2 outline-stone-400" : ""}`}>
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        title="Arrastrá para cambiar la prioridad"
        aria-label={`Arrastrar "${t.titulo}" para cambiar la prioridad`}
        className="absolute -left-5 top-1.5 h-6 w-5 cursor-grab touch-none select-none rounded text-base leading-none text-stone-400 hover:bg-crema-100 hover:text-stone-700 active:cursor-grabbing"
      >⋮⋮</button>
      <ul><FilaTarea id={t.id} titulo={t.titulo} hecha={t.hecha} puedeTildar={puedeTildar} puedeBorrar={puedeBorrar} /></ul>
    </div>
  );
}

// Lista de tareas de una persona. Las pendientes van arriba en orden de prioridad (el gerente las acomoda arrastrando); las hechas quedan abajo, tachadas.
export function ListaTareas({ asignadaId, tareas, puedeTildar, puedeBorrar, puedeOrdenar }: { asignadaId: string; tareas: DatosTarea[]; puedeTildar: boolean; puedeBorrar: boolean; puedeOrdenar: boolean }) {
  const [pendientes, setPendientes] = useState(() => tareas.filter((t) => !t.hecha));
  const [error, setError] = useState("");
  const hechas = tareas.filter((t) => t.hecha);
  const sensores = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }));

  const alSoltar = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const de = pendientes.findIndex((t) => t.id === active.id);
    const a = pendientes.findIndex((t) => t.id === over.id);
    if (de < 0 || a < 0) return;
    const antes = pendientes;
    const nueva = arrayMove(pendientes, de, a);
    setPendientes(nueva);
    setError("");
    const r = await ordenarTareas(asignadaId, nueva.map((t) => t.id));
    if (r.error) { setError(r.error); setPendientes(antes); }
  };

  return (
    <div className={puedeOrdenar ? "pl-5" : ""}>
      {puedeOrdenar && pendientes.length > 1 ? (
        <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={alSoltar}>
          <SortableContext items={pendientes.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <div className="divide-y divide-stone-100">
              {pendientes.map((t) => <FilaOrdenable key={t.id} t={t} puedeTildar={puedeTildar} puedeBorrar={puedeBorrar || !!t.borrable} />)}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <ul className="divide-y divide-stone-100">{pendientes.map((t) => <FilaTarea key={t.id} id={t.id} titulo={t.titulo} hecha={t.hecha} puedeTildar={puedeTildar} puedeBorrar={puedeBorrar || !!t.borrable} />)}</ul>
      )}
      {hechas.length > 0 && <ul className={`divide-y divide-stone-100 ${pendientes.length ? "border-t border-stone-100" : ""}`}>{hechas.map((t) => <FilaTarea key={t.id} id={t.id} titulo={t.titulo} hecha puedeTildar={puedeTildar} puedeBorrar={puedeBorrar || !!t.borrable} />)}</ul>}
      {error && <p className="py-1 text-[12px] text-rojo-700" role="alert">{error}</p>}
    </div>
  );
}
