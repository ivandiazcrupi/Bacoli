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

export default async function Inicio() {
  const usuario = await exigirUsuario();
  const oficina = esPersonalDeOficina(usuario.rol);

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto flex min-h-[calc(100vh-9rem)] w-full max-w-5xl flex-col items-center justify-center gap-10 px-4 py-10">
        <h1 className="text-center font-serif text-3xl font-medium sm:text-5xl">{saludar(usuario.nombre)}</h1>

        {oficina ? (
          <>
            <div className="grid w-full max-w-3xl gap-3 sm:grid-cols-2">
              <Link href="/pedidos/nuevo" className="rounded-2xl bg-verde-700 px-6 py-5 text-center text-lg font-bold uppercase tracking-wide text-white shadow-sm hover:bg-verde-800">
                Cargar pedido
              </Link>
              <Link href="/clientes/nuevo" className="rounded-2xl bg-verde-700 px-6 py-5 text-center text-lg font-bold uppercase tracking-wide text-white shadow-sm hover:bg-verde-800">
                Cargar cliente
              </Link>
            </div>
          </>
        ) : (
          <p className="text-stone-600">Tu ruta del día va a aparecer acá.</p>
        )}
      </main>
    </>
  );
}
