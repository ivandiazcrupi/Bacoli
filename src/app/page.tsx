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
        ) : (
          <p className="text-stone-600">Tu ruta del día va a aparecer acá.</p>
        )}
      </main>
    </>
  );
}
