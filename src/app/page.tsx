import Link from "next/link";
import { redirect } from "next/navigation";
import { Cabecera } from "@/components/Cabecera";
import { esPersonalDeOficina, esProduccion, esVendedor, produccionActiva } from "@/lib/roles";
import { db } from "@/lib/db";
import { exigirUsuario } from "@/lib/session";
import { FilaTarea } from "./tareas/Controles";

// Mensajes de bienvenida: uno al azar cada vez que se entra, según la hora de Argentina.
// Los "picantes" (pedido del dueño): cortos, simpáticos y con un guiño al trabajo; los de "Hola" valen a cualquier hora.
const CUALQUIER_HORA = [
  "Hola, {n}. Lindo día para cobrar lo que nos deben.",
  "Hola, {n}. Un cliente sin pagar es una pizza regalada.",
  "Hola, {n}. Hoy hay pedidos para cargar y plata para cobrar.",
];
const SALUDOS = {
  manana: ["Buenos días, equipo. ¿Cómo va?", "Buen día, {n}. ¿Arrancamos?", "Buenos días. Hoy hay pizzas para repartir.", "Buen día, equipo. ¿Qué cargamos primero?",
    "Buen día, {n}. Hoy venimos a facturar, y con ganas.", "Buen día, {n}. Que no se te escape ni un pedido hoy.", ...CUALQUIER_HORA],
  tarde: ["Buenas tardes, equipo. ¿Cómo va?", "Buenas tardes, {n}. ¿Qué hacemos?", "Buenas tardes. ¿Cargamos algo?", "Buena tarde, chicos. ¿Cómo viene el día?",
    "Buenas tardes, {n}. ¿Marcaste esas entregas o las dejamos para el año que viene?", "Buenas tardes, {n}. Ese cliente que no pide hace un mes está esperando tu llamado.", "Buenas tardes, {n}. Hora de cobrar: las facturas no se pagan solas.", ...CUALQUIER_HORA],
  noche: ["Buenas noches, equipo. ¿Cómo va?", "Buenas noches, {n}. ¿Dejamos algo cargado para mañana?", "Buenas noches. Último repaso del día.", "Buenas noches, chicos. ¿Cómo fue el día?",
    "Buenas noches, {n}. Lo que no se cobra hoy, se cobra mañana. Pero se cobra.", "Buenas noches, {n}. Cerrá el día con todo marcado y dormí tranquilo.", ...CUALQUIER_HORA],
};

function saludar(nombre: string) {
  const hora = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", hour12: false }).format(new Date())) % 24;
  const lista = hora < 12 ? SALUDOS.manana : hora < 20 ? SALUDOS.tarde : SALUDOS.noche;
  return lista[Math.floor(Math.random() * lista.length)].replace("{n}", nombre.split(" ")[0]);
}

function fechaHoy() {
  const t = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", weekday: "long", day: "numeric", month: "long" }).format(new Date());
  return t;
}

export default async function Inicio() {
  const usuario = await exigirUsuario();
  if (produccionActiva() && esProduccion(usuario.rol)) redirect("/produccion");
  const oficina = esPersonalDeOficina(usuario.rol);
  // Tus tareas (solo oficina): pendientes primero; si no tenés ninguna cargada, no se muestra nada.
  const tareas = oficina ? await db.tarea.findMany({ where: { asignadaId: usuario.id }, orderBy: [{ hecha: "asc" }, { creadoEn: "asc" }], select: { id: true, titulo: true, hecha: true } }) : [];
  const pendientes = tareas.filter((t) => !t.hecha).length;
  const visibles = tareas.slice(0, 7);

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto flex min-h-[calc(100vh-9rem)] w-full max-w-3xl flex-col items-center justify-center gap-6 px-4 py-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">{fechaHoy()}</p>
        <h1 className="text-2xl font-bold leading-tight text-stone-900 sm:text-4xl">{saludar(usuario.nombre)}</h1>

        {oficina ? (
          <div className="mt-2 grid w-full gap-3 sm:grid-cols-2">
            <Link href="/pedidos/nuevo" className="rounded-lg bg-verde-700 px-6 py-6 text-center text-lg font-bold uppercase tracking-wide text-white hover:bg-verde-800">
              Cargar pedido
            </Link>
            <Link href="/clientes/nuevo" className="rounded-lg bg-verde-700 px-6 py-6 text-center text-lg font-bold uppercase tracking-wide text-white hover:bg-verde-800">
              Cargar cliente
            </Link>
          </div>
        ) : esVendedor(usuario.rol) ? (
          <div className="mt-2 grid w-full gap-3 sm:grid-cols-2">
            <Link href="/vendedor/nuevo" className="rounded-lg bg-verde-700 px-6 py-6 text-center text-lg font-bold uppercase tracking-wide text-white hover:bg-verde-800">Cargar pedido</Link>
            <Link href="/vendedor/clientes/nuevo" className="rounded-lg bg-verde-700 px-6 py-6 text-center text-lg font-bold uppercase tracking-wide text-white hover:bg-verde-800">Cargar cliente</Link>
          </div>
        ) : (
          <p className="text-stone-600">Tu ruta del día va a aparecer acá.</p>
        )}

        {tareas.length > 0 && (
          <section aria-label="Tus tareas" className="mt-2 w-full max-w-xl rounded-xl border border-stone-300 bg-white px-5 py-4 text-left">
            <header className="mb-1 flex items-baseline justify-between gap-3">
              <h2 className="text-[13px] font-bold uppercase tracking-[0.12em] text-stone-600">Tus tareas</h2>
              <span className="text-[12.5px] text-stone-500">{pendientes === 0 ? "todo al día ✓" : `${pendientes} pendiente${pendientes === 1 ? "" : "s"}`}</span>
            </header>
            <ul className="divide-y divide-stone-100">
              {visibles.map((t) => <FilaTarea key={t.id} id={t.id} titulo={t.titulo} hecha={t.hecha} puedeTildar puedeBorrar={false} />)}
            </ul>
            <p className="mt-2 text-right"><Link href="/tareas" className="text-[12.5px] font-semibold text-stone-600 underline-offset-2 hover:underline">{tareas.length > visibles.length ? `Ver las ${tareas.length} y las del equipo ›` : "Ver las del equipo ›"}</Link></p>
          </section>
        )}
      </main>
    </>
  );
}
