"use client";

import { DndContext, MouseSensor, TouchSensor, closestCenter, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createContext, useContext, useRef, useState, useTransition, type ReactNode } from "react";
import { alternarTarea, borrarHechas, borrarTarea, crearTarea, editarTarea, moverTarea, ordenarTareas } from "./actions";

// Todos los de oficina pueden hacer todo con cualquier tarea: tildarla, editarla, borrarla, ordenarla y pasarla a otra persona.
// Los íconos de editar y borrar aparecen al pasar el mouse (en el celular se ven siempre).
const ICONO = "shrink-0 rounded px-1.5 py-0.5 text-[13px] text-stone-400 transition hover:bg-stone-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100";

export function FilaTarea({ id, titulo, hecha, sangria = false }: { id: string; titulo: string; hecha: boolean; sangria?: boolean }) {
  const [pendiente, empezar] = useTransition();
  const [error, setError] = useState("");
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(titulo);
  const cancelado = useRef(false);
  const guardar = () => {
    if (cancelado.current) { cancelado.current = false; return; }
    const nuevo = texto.trim();
    if (nuevo === titulo) { setEditando(false); return; }
    empezar(async () => { const r = await editarTarea(id, nuevo); setError(r.error ?? ""); if (!r.error) setEditando(false); });
  };
  return (
    <li className={`group flex items-center gap-3 rounded-lg py-2 pr-1 hover:bg-stone-50 ${sangria ? "pl-6" : "pl-1"}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={hecha}
        aria-label={hecha ? `Destildar: ${titulo}` : `Marcar como hecha: ${titulo}`}
        disabled={pendiente}
        onClick={() => empezar(async () => { const r = await alternarTarea(id); setError(r.error ?? ""); })}
        className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 text-[12px] font-bold leading-none transition ${hecha ? "border-verde-700 bg-verde-700 text-white" : "border-stone-300 bg-white text-transparent hover:border-verde-700 hover:text-verde-700"} disabled:opacity-60`}
      >✓</button>
      {editando ? (
        <span className="min-w-0 flex-1">
          <input
            autoFocus value={texto} maxLength={200} disabled={pendiente} aria-label="Editar tarea"
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); guardar(); } if (e.key === "Escape") { cancelado.current = true; setTexto(titulo); setError(""); setEditando(false); } }}
            onBlur={guardar}
            className="h-8 w-full rounded-md border border-stone-400 bg-white px-2 text-[14.5px] focus:border-verde-700 focus:outline-none"
          />
          {error && <span className="text-[12px] text-rojo-700">{error}</span>}
        </span>
      ) : (
        <span className={`min-w-0 flex-1 text-[14.5px] leading-snug ${hecha ? "text-stone-400 line-through" : "text-stone-900"}`}>{titulo}{error && <span className="ml-2 text-[12px] text-rojo-700 no-underline">{error}</span>}</span>
      )}
      {!editando && <button type="button" aria-label="Editar tarea" title="Editar" disabled={pendiente} onClick={() => { cancelado.current = false; setTexto(titulo); setError(""); setEditando(true); }} className={`${ICONO} hover:text-stone-800`}>✎</button>}
      <button type="button" aria-label="Borrar tarea" title="Borrar" disabled={pendiente} onClick={() => window.confirm(`¿Borrar la tarea "${titulo}"?`) && empezar(async () => { await borrarTarea(id); })} className={`${ICONO} hover:text-rojo-700`}>✕</button>
    </li>
  );
}

// Campo para sumar una tarea. Enter la guarda y queda listo para la siguiente.
export function NuevaTarea({ asignadaId }: { asignadaId: string }) {
  const [pendiente, empezar] = useTransition();
  const [error, setError] = useState("");
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      action={(fd) => empezar(async () => { const r = await crearTarea(asignadaId, fd); setError(r.error ?? ""); if (!r.error) ref.current?.reset(); })}
      className="mt-2"
    >
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-stone-300 bg-white px-3 focus-within:border-verde-700 focus-within:bg-white">
        <span aria-hidden className="text-lg leading-none text-stone-400">+</span>
        <input name="titulo" placeholder="Agregar una tarea…" aria-label="Nueva tarea" maxLength={200} autoComplete="off" disabled={pendiente} className="h-10 min-w-0 flex-1 bg-transparent text-[14px] placeholder:text-stone-400 focus:outline-none" />
        <button type="submit" disabled={pendiente} className="text-[12.5px] font-semibold text-stone-500 hover:text-verde-800 disabled:opacity-50">Agregar</button>
      </div>
      {error && <p className="mt-1 text-[12px] text-rojo-700">{error}</p>}
    </form>
  );
}

export function BorrarHechas({ asignadaId, cuantas }: { asignadaId: string; cuantas: number }) {
  const [pendiente, empezar] = useTransition();
  return (
    <button type="button" disabled={pendiente} onClick={() => window.confirm(cuantas === 1 ? "¿Borrar la tarea ya hecha?" : `¿Borrar las ${cuantas} tareas ya hechas?`) && empezar(async () => { await borrarHechas(asignadaId); })} className="text-[12px] text-stone-400 underline-offset-2 hover:text-rojo-700 hover:underline">
      {cuantas === 1 ? "Borrar la hecha" : `Borrar las ${cuantas} hechas`}
    </button>
  );
}

type DatosTarea = { id: string; titulo: string; hecha: boolean };

// Todas las listas comparten UN solo arrastre: así una tarea se puede pasar de una persona a otra soltándola sobre su lista, o acomodar por prioridad.
type Pendientes = Record<string, DatosTarea[]>;
const Contexto = createContext<Pendientes | null>(null);

export function TableroTareas({ inicial, children }: { inicial: Pendientes; children: ReactNode }) {
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

// Una fila pendiente que se puede arrastrar: el asa ⋮⋮ de la izquierda (aparece al pasar el mouse).
function FilaOrdenable({ t }: { t: DatosTarea }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: t.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`group/fila relative rounded-lg bg-white ${isDragging ? "z-10 opacity-90 outline outline-2 outline-stone-400" : ""}`}>
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        title="Arrastrá para cambiar la prioridad o pasarla a otra persona"
        aria-label={`Arrastrar "${t.titulo}" para cambiar la prioridad o pasarla a otra persona`}
        className="absolute left-0 top-1/2 z-10 h-6 w-5 -translate-y-1/2 cursor-grab touch-none select-none rounded text-[15px] leading-none text-stone-300 hover:bg-stone-100 hover:text-stone-700 active:cursor-grabbing sm:opacity-0 sm:group-hover/fila:opacity-100 sm:focus-visible:opacity-100"
      >⋮⋮</button>
      <ul><FilaTarea id={t.id} titulo={t.titulo} hecha={false} sangria /></ul>
    </div>
  );
}

// Lista de tareas de una persona: las pendientes arriba (en orden de prioridad) y las hechas recogidas abajo en "Hechas (N)".
export function ListaTareas({ asignadaId, tareas, vacio }: { asignadaId: string; tareas: DatosTarea[]; vacio: string }) {
  const compartido = useContext(Contexto);
  const pendientes = compartido?.[asignadaId] ?? tareas.filter((t) => !t.hecha);
  const hechas = tareas.filter((t) => t.hecha);
  const { setNodeRef, isOver } = useDroppable({ id: `persona:${asignadaId}` });

  return (
    <div ref={setNodeRef} className={`min-h-[44px] rounded-lg transition-colors ${isOver ? "bg-stone-100 outline outline-1 outline-dashed outline-stone-400" : ""}`}>
      <SortableContext items={pendientes.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div>{pendientes.map((t) => <FilaOrdenable key={t.id} t={t} />)}</div>
      </SortableContext>
      {pendientes.length === 0 && hechas.length === 0 && <p className="px-1 py-2 text-[13.5px] text-stone-400">{vacio}</p>}
      {pendientes.length === 0 && hechas.length > 0 && <p className="px-1 py-2 text-[13.5px] font-medium text-verde-800">Todo al día ✓</p>}
      {hechas.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer select-none px-1 py-1 text-[12.5px] font-semibold text-stone-500 hover:text-stone-800">Hechas ({hechas.length})</summary>
          <ul>{hechas.map((t) => <FilaTarea key={t.id} id={t.id} titulo={t.titulo} hecha sangria />)}</ul>
          <p className="px-1 pt-1 text-right"><BorrarHechas asignadaId={asignadaId} cuantas={hechas.length} /></p>
        </details>
      )}
    </div>
  );
}
