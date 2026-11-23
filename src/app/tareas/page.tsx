import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { exigirOficina } from "@/lib/session";
import { GENERALES } from "@/lib/tareas";
import { CargaRapida, ListaTareas, NuevaTarea, TableroTareas } from "./Controles";

const primerNombre = (n: string) => n.trim().split(/\s+/)[0] || n;

// TAREAS: una lista por persona del equipo de oficina. Todos pueden cargar, tildar, editar, borrar, ordenar y pasar tareas de una persona a otra.
export default async function Tareas() {
  const yo = await exigirOficina();

  const personas = await db.usuario.findMany({
    where: { activo: true, rol: { in: ["DUENO", "ADMINISTRACION"] } },
    orderBy: { creadoEn: "asc" },
    select: { id: true, nombre: true, tareas: { orderBy: [{ hecha: "asc" }, { orden: "asc" }, { creadoEn: "asc" }], select: { id: true, titulo: true, hecha: true } } },
  });
  const generales = await db.tarea.findMany({ where: { asignadaId: null }, orderBy: [{ hecha: "asc" }, { orden: "asc" }, { creadoEn: "asc" }], select: { id: true, titulo: true, hecha: true } });
  const mias = personas.find((p) => p.id === yo.id);
  const otras = personas.filter((p) => p.id !== yo.id);

  const inicial: Record<string, { id: string; titulo: string; hecha: boolean }[]> = { [GENERALES]: generales.filter((t) => !t.hecha), ...Object.fromEntries(personas.map((p) => [p.id, p.tareas.filter((t) => !t.hecha)])) };
  const firma = [generales, ...personas.map((p) => p.tareas)].map((l) => l.map((t) => `${t.id}${t.hecha ? 1 : 0}`).join()).join("|");
  const pendientesEquipo = personas.reduce((n, p) => n + p.tareas.filter((t) => !t.hecha).length, 0) + generales.filter((t) => !t.hecha).length;
  const sinDueno = generales.filter((t) => !t.hecha).length;

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

  const TarjetaGenerales = () => {
    return (
      <section aria-label="Tareas generales" className="rounded-2xl border border-dashed border-stone-400 bg-white p-5">
        <header className="mb-3 flex items-center gap-3">
          <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fdf8e3] text-[15px] font-bold text-[#8a6a05]">G</span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[16px] font-bold leading-tight">Generales</h2>
            <p className="text-[12.5px] text-stone-500">{sinDueno === 0 ? "Nada sin dueño ✓" : `${sinDueno} sin dueño · tocá “Me la quedo” o arrastrala a alguien`}</p>
          </div>
        </header>
        <ListaTareas asignadaId={GENERALES} tareas={generales} generales vacio="Acá caen las tareas que todavía no son de nadie." />
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
            <CargaRapida personas={personas.map((p) => ({ id: p.id, nombre: p.nombre }))} miId={yo.id} />
            <TarjetaGenerales />
            {mias && <Tarjeta p={mias} propia />}
            {otras.length > 0 && <div className="grid items-start gap-5 md:grid-cols-2">{otras.map((p) => <Tarjeta key={p.id} p={p} propia={false} />)}</div>}
          </div>
        </TableroTareas>
        <p className="text-[12px] text-stone-400">Todos pueden cargar, tildar, editar y borrar tareas. Lo que no tiene dueño queda en Generales. Arrastrá con ⋮⋮ para cambiar la prioridad o pasar una tarea a otra persona (o a Generales).</p>
      </main>
    </>
  );
}
