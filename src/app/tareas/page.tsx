import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { puedeGestionarUsuarios } from "@/lib/roles";
import { exigirOficina } from "@/lib/session";
import { BorrarHechas, ListaTareas, NuevaTarea, TableroTareas } from "./Controles";

const primerNombre = (n: string) => n.trim().split(/\s+/)[0] || n;

// TAREAS: un checklist por persona del equipo de oficina. Todos pueden cargarle tareas a cualquiera; cada uno ve primero las suyas
// (y las tilda) y, más abajo, las de los demás para mirar cómo viene el equipo.
export default async function Tareas() {
  const yo = await exigirOficina();
  const gerente = puedeGestionarUsuarios(yo.rol);

  const personas = await db.usuario.findMany({
    where: { activo: true, rol: { in: ["DUENO", "ADMINISTRACION"] } },
    orderBy: { creadoEn: "asc" },
    select: { id: true, nombre: true, tareas: { orderBy: [{ hecha: "asc" }, { orden: "asc" }, { creadoEn: "asc" }], select: { id: true, titulo: true, hecha: true, creadaPorId: true } } },
  });
  const mias = personas.find((p) => p.id === yo.id);
  const otras = personas.filter((p) => p.id !== yo.id);

  // Lo que puede arrastrar cada uno: el gerente cualquiera; los demás las que cargaron o las que les asignaron.
  const datos = (p: (typeof personas)[number]) => p.tareas.map((t) => ({ id: t.id, titulo: t.titulo, hecha: t.hecha, borrable: t.creadaPorId === yo.id, movible: !t.hecha && (gerente || t.creadaPorId === yo.id || p.id === yo.id) }));
  const inicial = Object.fromEntries(personas.map((p) => [p.id, datos(p).filter((t) => !t.hecha)]));
  const firma = personas.map((p) => p.tareas.map((t) => `${t.id}${t.hecha ? 1 : 0}`).join()).join("|");

  const Lista = ({ p, propia }: { p: (typeof personas)[number]; propia: boolean }) => {
    const hechas = p.tareas.filter((t) => t.hecha).length;
    return (
      <>
        <ListaTareas asignadaId={p.id} tareas={datos(p)} puedeTildar={propia || gerente} puedeBorrar={gerente} />
        {p.tareas.length === 0 && <p className="py-2 text-[13px] text-stone-400">{propia ? "No tenés tareas por ahora." : "Sin tareas."}</p>}
        <NuevaTarea asignadaId={p.id} />
        {gerente && hechas > 0 && <p className="mt-2 text-right"><BorrarHechas asignadaId={p.id} cuantas={hechas} /></p>}
      </>
    );
  };
  const resumen = (p: (typeof personas)[number]) => {
    const pend = p.tareas.filter((t) => !t.hecha).length;
    return p.tareas.length === 0 ? "sin tareas" : pend === 0 ? "todo al día ✓" : `${pend} pendiente${pend === 1 ? "" : "s"} de ${p.tareas.length}`;
  };

  return (
    <>
      <Cabecera usuario={yo} />
      <main className="mx-auto w-full max-w-[1100px] space-y-8 px-4 py-6 sm:px-8">
        <h1 className="text-2xl font-bold tracking-tight">Tareas</h1>
        <TableroTareas key={firma} inicial={inicial} gerente={gerente}>

        {mias && (
          <section aria-label="Mis tareas" className="rounded-xl border border-stone-300 bg-white p-5">
            <header className="mb-2 flex items-baseline justify-between gap-3">
              <h2 className="text-[15px] font-bold">Tus tareas, {primerNombre(mias.nombre)}</h2>
              <span className="text-[12.5px] text-stone-500">{resumen(mias)}</span>
            </header>
            <Lista p={mias} propia />
          </section>
        )}

        {otras.length > 0 && (
          <section aria-label="El equipo">
            <h2 className="mb-3 text-[11.5px] font-bold uppercase tracking-[0.14em] text-stone-500">El equipo</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {otras.map((p) => (
                <article key={p.id} className="rounded-xl border border-stone-300 bg-white p-4">
                  <header className="mb-1 flex items-baseline justify-between gap-3">
                    <h3 className="text-[14px] font-bold">{p.nombre}</h3>
                    <span className="text-[12px] text-stone-500">{resumen(p)}</span>
                  </header>
                  <Lista p={p} propia={false} />
                </article>
              ))}
            </div>
          </section>
        )}

        </TableroTareas>

        <p className="text-[12px] text-stone-400">{gerente ? "Todos cargan tareas (campo “Agregar una tarea”). Vos, como gerente, podés tildar, borrar, ordenar y pasar de una persona a otra (arrastrando con ⋮⋮) cualquiera." : "Podés cargarle tareas a cualquiera y borrar las que cargaste vos. Podés pasar a otra persona (arrastrando con ⋮⋮) las que cargaste o te asignaron. Cada uno tilda las suyas."}</p>
      </main>
    </>
  );
}
