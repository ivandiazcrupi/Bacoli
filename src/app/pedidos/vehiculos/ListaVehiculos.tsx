"use client";

import { DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ordenarVehiculos } from "../ruta/actions";
import { FilaVehiculo, type DatosVehiculo } from "./FilaVehiculo";

function FilaArrastrable({ vehiculo }: { vehiculo: DatosVehiculo }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: vehiculo.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`relative bg-white ${isDragging ? "z-10 opacity-80 outline outline-2 outline-stone-500" : ""}`}>
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        title="Arrastrá para cambiar el orden"
        aria-label={`Arrastrar ${vehiculo.nombre} para cambiar el orden`}
        className="absolute left-1 top-1/2 z-10 h-8 w-5 -translate-y-1/2 cursor-grab touch-none select-none rounded text-base leading-none text-stone-500 hover:bg-crema-100 active:cursor-grabbing"
      >
        ⋮⋮
      </button>
      <FilaVehiculo vehiculo={vehiculo} verCosto />
    </div>
  );
}

// Los vehículos se acomodan a mano arrastrándolos con el asa ⋮⋮ de la izquierda; el orden queda guardado y es el mismo con que se ofrecen al armar el día.
export function ListaVehiculos({ vehiculos }: { vehiculos: DatosVehiculo[] }) {
  const router = useRouter();
  const [lista, setLista] = useState(vehiculos);
  const [error, setError] = useState("");
  const sensores = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }));

  const alSoltar = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const de = lista.findIndex((v) => v.id === active.id);
    const a = lista.findIndex((v) => v.id === over.id);
    if (de < 0 || a < 0) return;
    const nueva = arrayMove(lista, de, a);
    setLista(nueva);
    setError("");
    const r = await ordenarVehiculos(nueva.map((v) => v.id));
    if (!r.ok) { setError(r.error ?? "No se pudo guardar el orden."); setLista(lista); }
    router.refresh();
  };

  return (
    <>
      <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={alSoltar}>
        <SortableContext items={lista.map((v) => v.id)} strategy={verticalListSortingStrategy}>
          {lista.map((v) => <FilaArrastrable key={v.id} vehiculo={v} />)}
        </SortableContext>
      </DndContext>
      {error && <p className="border-t border-stone-300 px-5 py-2 text-sm font-semibold text-rojo-700" role="alert">{error}</p>}
    </>
  );
}
