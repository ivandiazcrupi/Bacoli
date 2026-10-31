import Link from "next/link";
import { redirect } from "next/navigation";
import { Cabecera } from "@/components/Cabecera";
import { esPersonalDeOficina, esProduccion, esVendedor } from "@/lib/roles";
import { exigirUsuario } from "@/lib/session";

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
  if (esProduccion(usuario.rol)) redirect("/produccion");
  const oficina = esPersonalDeOficina(usuario.rol);

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
      </main>
    </>
  );
}
