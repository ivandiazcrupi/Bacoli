"use client";

import { DndContext, MouseSensor, TouchSensor, closestCenter, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createContext, useContext, useRef, useState, useTransition, type ReactNode } from "react";
import { alternarTarea, borrarHechas, borrarTarea, crearTarea, editarTarea, moverTarea, ordenarTareas } from "./actions";

// Una tarea: casillero para tildar (si puede) y, para el gerente, una ✕ para borrarla.
export function FilaTarea({ id, titulo, hecha, puedeTildar, puedeBorrar }: { id: string; titulo: string; hecha: boolean; puedeTildar: boolean; puedeBorrar: boolean }) {
  const [pendiente, empezar] = useTransition();
  const [error, setError] = useState("");
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(titulo);
  const puedeEditar = puedeBorrar || puedeTildar; // quien la cargó, a quien se le asignó o el gerente (lo vuelve a exigir el servidor)
  const cancelado = useRef(false);
  const guardar = () => {
    if (cancelado.current) { cancelado.current = false; return; }
    const nuevo = texto.trim();
    if (nuevo === titulo) { setEditando(false); return; }
    empezar(async () => { const r = await editarTarea(id, nuevo); setError(r.error ?? ""); if (!r.error) setEditando(false); });
  };
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
      {editando ? (
        <span className="min-w-0 flex-1">
          <input
            autoFocus value={texto} maxLength={200} disabled={pendiente} aria-label="Editar tarea"
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); guardar(); } if (e.key === "Escape") { cancelado.current = true; setTexto(titulo); setError(""); setEditando(false); } }}
            onBlur={guardar}
            className="h-8 w-full rounded-md border border-stone-400 bg-white px-2 text-[14px] focus:border-verde-700 focus:outline-none"
          />
          {error && <span className="text-[12px] text-rojo-700">{error}</span>}
        </span>
      ) : (
        <span className={`min-w-0 flex-1 text-[14px] leading-snug ${hecha ? "text-stone-400 line-through" : "text-stone-900"}`}>{titulo}{error && <span className="ml-2 text-[12px] text-rojo-700 no-underline">{error}</span>}</span>
      )}
      {puedeEditar && !editando && (
        <button type="button" aria-label="Editar tarea" title="Editar tarea" disabled={pendiente} onClick={() => { cancelado.current = false; setTexto(titulo); setError(""); setEditando(true); }} className="shrink-0 px-1 text-[13px] text-stone-300 hover:text-stone-700">✎</button>
      )}
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

type DatosTarea = { id: string; titulo: string; hecha: boolean; borrable?: boolean; movible?: boolean }; // borrable: la cargó quien mira; movible: puede arrastrarla (gerente, quien la cargó o a quien se le asignó)

// Todas las listas comparten UN solo arrastre: así una tarea se puede pasar de una persona a otra soltándola sobre su lista.
type Pendientes = Record<string, DatosTarea[]>;
const Contexto = createContext<Pendientes | null>(null);

export function TableroTareas({ inicial, gerente, children }: { inicial: Pendientes; gerente: boolean; children: ReactNode }) {
  const [pendientes, setPendientes] = useState<Pendientes>(inicial);
  const [error, setError] = useState("");
  const sensores = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }));
  const duenoDe = (tareaId: string) => Object.keys(pendientes).find((p) => pendientes[p].some((t) => t.id === tareaId));

  const alSoltar = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const id = String(active.id);
    const desde = duenoDe(id);
    const overId = String(over.id);
    const hacia = overId.startsWith("persona:") ? overId.slice(8) : duenoDe(overId);
    if (!desde || !hacia || !pendientes[hacia]) return;
    const antes = pendientes;
    setError("");
    if (desde === hacia) {
      if (!gerente) return; // ordenar la lista de una persona es solo del gerente
      const a = antes[hacia].findIndex((t) => t.id === overId);
      const de = antes[hacia].findIndex((t) => t.id === id);
      if (a < 0 || de < 0) return;
      const nueva = arrayMove(antes[hacia], de, a);
      setPendientes({ ...antes, [hacia]: nueva });
      const r = await ordenarTareas(hacia, nueva.map((t) => t.id));
      if (r.error) { setError(r.error); setPendientes(antes); }
      return;
    }
    const tarea = antes[desde].find((t) => t.id === id)!;
    const destino = [...antes[hacia]];
    const pos = destino.findIndex((t) => t.id === overId);
    destino.splice(pos < 0 ? destino.length : pos, 0, tarea);
    setPendientes({ ...antes, [desde]: antes[desde].filter((t) => t.id !== id), [hacia]: destino });
    const r = await moverTarea(id, hacia, destino.map((t) => t.id));
    if (r.error) { setError(r.error); setPendientes(antes); }
  };

  return (
    <Contexto.Provider value={pendientes}>
      <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={alSoltar}>{children}</DndContext>
      {error && <p className="mt-3 text-[13px] font-semibold text-rojo-700" role="alert">{error}</p>}
    </Contexto.Provider>
  );
}

// Una fila que se puede arrastrar (solo las pendientes que la persona puede mover): el asa ⋮⋮ de la izquierda.
function FilaOrdenable({ t, puedeTildar, puedeBorrar }: { t: DatosTarea; puedeTildar: boolean; puedeBorrar: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: t.id, disabled: !t.movible });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`relative bg-white ${isDragging ? "z-10 opacity-90 outline outline-2 outline-stone-400" : ""}`}>
      {t.movible && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          title="Arrastrá para cambiar la prioridad o pasarla a otra persona"
          aria-label={`Arrastrar "${t.titulo}" para cambiar la prioridad o pasarla a otra persona`}
          className="absolute -left-5 top-1.5 h-6 w-5 cursor-grab touch-none select-none rounded text-base leading-none text-stone-400 hover:bg-crema-100 hover:text-stone-700 active:cursor-grabbing"
        >⋮⋮</button>
      )}
      <ul><FilaTarea id={t.id} titulo={t.titulo} hecha={t.hecha} puedeTildar={puedeTildar} puedeBorrar={puedeBorrar} /></ul>
    </div>
  );
}

// Lista de tareas de una persona. Las pendientes van arriba en orden de prioridad; las hechas quedan abajo, tachadas. Se puede soltar acá una tarea de otra persona.
export function ListaTareas({ asignadaId, tareas, puedeTildar, puedeBorrar }: { asignadaId: string; tareas: DatosTarea[]; puedeTildar: boolean; puedeBorrar: boolean }) {
  const compartido = useContext(Contexto);
  const pendientes = compartido?.[asignadaId] ?? tareas.filter((t) => !t.hecha);
  const hechas = tareas.filter((t) => t.hecha);
  const { setNodeRef, isOver } = useDroppable({ id: `persona:${asignadaId}` });
  const hayAsas = pendientes.some((t) => t.movible);

  return (
    <div ref={setNodeRef} className={`min-h-[44px] rounded-md transition-colors ${hayAsas ? "pl-5" : ""} ${isOver ? "bg-crema-100 outline outline-1 outline-dashed outline-stone-400" : ""}`}>
      <SortableContext items={pendientes.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="divide-y divide-stone-100">
          {pendientes.map((t) => <FilaOrdenable key={t.id} t={t} puedeTildar={puedeTildar} puedeBorrar={puedeBorrar || !!t.borrable} />)}
        </div>
      </SortableContext>
      {hechas.length > 0 && <ul className={`divide-y divide-stone-100 ${pendientes.length ? "border-t border-stone-100" : ""}`}>{hechas.map((t) => <FilaTarea key={t.id} id={t.id} titulo={t.titulo} hecha puedeTildar={puedeTildar} puedeBorrar={puedeBorrar || !!t.borrable} />)}</ul>}
    </div>
  );
}
