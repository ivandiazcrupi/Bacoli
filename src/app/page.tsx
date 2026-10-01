import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { esPersonalDeOficina } from "@/lib/roles";
import { exigirUsuario } from "@/lib/session";

// Mensajes de bienvenida: uno al azar cada vez que se entra, según la hora de Argentina.
const SALUDOS = {
  manana: ["Buenos días, equipo. ¿Cómo va?", "Buen día, {n}. ¿Arrancamos?", "Buenos días. Hoy hay pizzas para repartir.", "Buen día, equipo. ¿Qué cargamos primero?"],
  tarde: ["Buenas tardes, equipo. ¿Cómo va?", "Buenas tardes, {n}. ¿Qué hacemos?", "Buenas tardes. ¿Cargamos algo?", "Buena tarde, chicos. ¿Cómo viene el día?"],
  noche: ["Buenas noches, equipo. ¿Cómo va?", "Buenas noches, {n}. ¿Dejamos algo cargado para mañana?", "Buenas noches. Último repaso del día.", "Buenas noches, chicos. ¿Cómo fue el día?"],
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
  const oficina = esPersonalDeOficina(usuario.rol);

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto flex min-h-[calc(100vh-9rem)] w-full max-w-4xl flex-col justify-center px-4 py-8">
        <section className="overflow-hidden rounded-lg border border-stone-400 bg-white">
          <div className="border-b-4 border-verde-700 bg-verde-800 px-6 py-8 sm:px-10 sm:py-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-crema-200">{fechaHoy()}</p>
            <h1 className="mt-2 text-2xl font-bold leading-tight text-white sm:text-4xl">{saludar(usuario.nombre)}</h1>
          </div>

          {oficina ? (
            <div className="space-y-4 p-6 sm:p-10">
              <div className="grid gap-3 sm:grid-cols-2">
                <Link href="/pedidos/nuevo" className="rounded-lg bg-verde-700 px-6 py-6 text-center text-lg font-bold uppercase tracking-wide text-white hover:bg-verde-800">
                  Cargar pedido
                </Link>
                <Link href="/clientes/nuevo" className="rounded-lg bg-verde-700 px-6 py-6 text-center text-lg font-bold uppercase tracking-wide text-white hover:bg-verde-800">
                  Cargar cliente
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Link href="/pedidos" className="rounded-lg border border-stone-400 px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide text-verde-800 hover:bg-crema-100">Ver pedidos</Link>
                <Link href="/pedidos/semana" className="rounded-lg border border-stone-400 px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide text-verde-800 hover:bg-crema-100">Semana</Link>
                <Link href="/clientes" className="rounded-lg border border-stone-400 px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide text-verde-800 hover:bg-crema-100">Ver clientes</Link>
              </div>
            </div>
          ) : (
            <p className="p-6 text-stone-600 sm:p-10">Tu ruta del día va a aparecer acá.</p>
          )}
        </section>
      </main>
    </>
  );
}
