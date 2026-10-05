import Link from "next/link";
import { inicioSemana, semanaDeTrabajo } from "@/lib/fechas";

type Pestana = "pedidos" | "semana" | "ruta" | "vehiculos";

// Las vistas de Pedidos: lo cargado que espera día, el resumen de la SEMANA, la HOJA DE RUTA (donde se organizan las vueltas) y los vehículos.
// Se va y se vuelve con un toque. "Hoja de ruta" abre el día indicado (sin día elegido, la semana de hoy; los lunes, la que viene).
export function PestanasPedidos({ activa, fechaRuta }: { activa: Pestana; fechaRuta?: string }) {
  const base = "rounded-t-lg border-x border-t px-6 py-3 text-sm font-bold uppercase tracking-wide";
  const on = "border-stone-300 border-b-white bg-white text-stone-900 -mb-px";
  const off = "border-transparent text-stone-500 hover:text-stone-900";
  const inicio = fechaRuta ? inicioSemana(fechaRuta) : semanaDeTrabajo(); // sin día elegido: la semana de hoy (los lunes, la que viene)
  const items: { id: Pestana; texto: string; href: string }[] = [
    { id: "pedidos", texto: "Pedidos", href: "/pedidos" },
    { id: "semana", texto: "Semana", href: `/pedidos/semana?semana=${inicio}` },
    { id: "ruta", texto: "Hoja de ruta", href: `/pedidos/dia?semana=${inicio}` }, // siempre en blanco: hay que tocar el día
    { id: "vehiculos", texto: "Vehículos", href: "/pedidos/vehiculos" },
  ];
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-stone-300" aria-label="Pedidos">
      {items.map((i) => <Link key={i.id} href={i.href} className={`whitespace-nowrap ${base} ${activa === i.id ? on : off}`}>{i.texto}</Link>)}
    </nav>
  );
}
