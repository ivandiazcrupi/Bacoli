import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { puedeGestionarUsuarios } from "@/lib/roles";
import { exigirOficina } from "@/lib/session";
import { BorrarHechas, ListaTareas, NuevaTarea } from "./Controles";

const primerNombre = (n: string) => n.trim().split(/\s+/)[0] || n;

// TAREAS: un checklist por persona del equipo de oficina. El gerente carga las tareas de cada uno; cada uno ve primero las suyas
// (y las tilda) y, más abajo, las de los demás para mirar cómo viene el equipo.
export default async function Tareas() {
  const yo = await exigirOficina();
  const gerente = puedeGestionarUsuarios(yo.rol);

  const personas = await db.usuario.findMany({
    where: { activo: true, rol: { in: ["DUENO", "ADMINISTRACION"] } },
    orderBy: { creadoEn: "asc" },
    select: { id: true, nombre: true, tareas: { orderBy: [{ hecha: "asc" }, { orden: "asc" }, { creadoEn: "asc" }], select: { id: true, titulo: true, hecha: true } } },
  });
  const mias = personas.find((p) => p.id === yo.id);
  const otras = personas.filter((p) => p.id !== yo.id);

  const Lista = ({ p, propia }: { p: (typeof personas)[number]; propia: boolean }) => {
    const hechas = p.tareas.filter((t) => t.hecha).length;
    return (
      <>
        <ListaTareas key={p.tareas.map((t) => `${t.id}${t.hecha ? 1 : 0}`).join()} asignadaId={p.id} tareas={p.tareas} puedeTildar={propia || gerente} puedeBorrar={gerente} puedeOrdenar={gerente} />
        {p.tareas.length === 0 && <p className="py-2 text-[13px] text-stone-400">{propia ? "No tenés tareas por ahora." : "Sin tareas."}</p>}
        {gerente && <NuevaTarea asignadaId={p.id} />}
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

        {gerente && <p className="text-[12px] text-stone-400">Vos sos gerente: cargás las tareas de cada persona (campo “Agregar una tarea”) y podés tildar o borrar cualquiera. Cada uno tilda las suyas.</p>}
      </main>
    </>
  );
}
