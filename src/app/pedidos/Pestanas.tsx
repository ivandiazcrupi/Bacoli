import Link from "next/link";

// Las dos vistas de Pedidos: los pedidos cargados (lista) y la hoja de ruta (cada día de la semana). Se va y se vuelve con un toque.
export function PestanasPedidos({ activa }: { activa: "cargados" | "ruta" }) {
  const base = "rounded-t-lg border-x border-t px-6 py-3 text-sm font-bold uppercase tracking-wide";
  const on = "border-stone-300 border-b-white bg-white text-verde-800 -mb-px";
  const off = "border-transparent text-stone-500 hover:text-verde-800";
  return (
    <nav className="flex gap-1 border-b border-stone-300" aria-label="Pedidos">
      <Link href="/pedidos" className={`${base} ${activa === "cargados" ? on : off}`}>Pedidos cargados</Link>
      <Link href="/pedidos/ruta" className={`${base} ${activa === "ruta" ? on : off}`}>Hoja de ruta</Link>
    </nav>
  );
}
