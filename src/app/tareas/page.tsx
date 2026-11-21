import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { exigirOficina } from "@/lib/session";
import { ListaTareas, NuevaTarea, TableroTareas } from "./Controles";

const primerNombre = (n: string) => n.trim().split(/\s+/)[0] || n;

// TAREAS: una lista por persona del equipo de oficina. Todos pueden cargar, tildar, editar, borrar, ordenar y pasar tareas de una persona a otra.
export default async function Tareas() {
  const yo = await exigirOficina();

  const personas = await db.usuario.findMany({
    where: { activo: true, rol: { in: ["DUENO", "ADMINISTRACION"] } },
    orderBy: { creadoEn: "asc" },
    select: { id: true, nombre: true, tareas: { orderBy: [{ hecha: "asc" }, { orden: "asc" }, { creadoEn: "asc" }], select: { id: true, titulo: true, hecha: true } } },
  });
  const mias = personas.find((p) => p.id === yo.id);
  const otras = personas.filter((p) => p.id !== yo.id);

  const inicial = Object.fromEntries(personas.map((p) => [p.id, p.tareas.filter((t) => !t.hecha)]));
  const firma = personas.map((p) => p.tareas.map((t) => `${t.id}${t.hecha ? 1 : 0}`).join()).join("|");
  const pendientesEquipo = personas.reduce((n, p) => n + p.tareas.filter((t) => !t.hecha).length, 0);

  const Tarjeta = ({ p, propia }: { p: (typeof personas)[number]; propia: boolean }) => {
    const hechas = p.tareas.filter((t) => t.hecha).length;
    const total = p.tareas.length;
    const pct = total === 0 ? 0 : Math.round((hechas / total) * 100);
    return (
      <section aria-label={propia ? "Mis tareas" : `Tareas de ${p.nombre}`} className="rounded-2xl border border-stone-300 bg-white p-5">
        <header className="mb-3 flex items-center gap-3">
          <span aria-hidden className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[15px] font-bold ${propia ? "bg-stone-800 text-white" : "bg-stone-200 text-stone-700"}`}>{primerNombre(p.nombre).charAt(0).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[16px] font-bold leading-tight">{propia ? `Tus tareas, ${primerNombre(p.nombre)}` : p.nombre}</h2>
            <p className="text-[12.5px] text-stone-500">{total === 0 ? "Sin tareas" : `${hechas} de ${total} hechas`}</p>
          </div>
        </header>
        {total > 0 && <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-stone-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-verde-700 transition-all" style={{ width: `${pct}%` }} /></div>}
        <ListaTareas asignadaId={p.id} tareas={p.tareas} vacio={propia ? "No tenés tareas por ahora." : "Sin tareas por ahora."} />
        <NuevaTarea asignadaId={p.id} />
      </section>
    );
  };

  return (
    <>
      <Cabecera usuario={yo} />
      <main className="mx-auto w-full max-w-[1100px] space-y-6 px-4 py-6 sm:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
          <h1 className="text-2xl font-bold tracking-tight">Tareas</h1>
          <p className="text-[13.5px] text-stone-500">{pendientesEquipo === 0 ? "Todo al día en el equipo ✓" : `${pendientesEquipo} pendiente${pendientesEquipo === 1 ? "" : "s"} en el equipo`}</p>
        </div>
        <TableroTareas key={firma} inicial={inicial}>
          <div className="space-y-5">
            {mias && <Tarjeta p={mias} propia />}
            {otras.length > 0 && <div className="grid items-start gap-5 md:grid-cols-2">{otras.map((p) => <Tarjeta key={p.id} p={p} propia={false} />)}</div>}
          </div>
        </TableroTareas>
        <p className="text-[12px] text-stone-400">Todos pueden cargar, tildar, editar y borrar tareas. Arrastrá con ⋮⋮ para cambiar la prioridad o pasar una tarea a otra persona.</p>
      </main>
    </>
  );
}
