import Link from "next/link";

type Pestana = "pedidos" | "semana" | "vehiculos";

// Las vistas de Pedidos: lo cargado que espera día, la semana (los días y sus hojas de ruta) y los vehículos. Se va y se vuelve con un toque.
export function PestanasPedidos({ activa }: { activa: Pestana }) {
  const base = "rounded-t-lg border-x border-t px-6 py-3 text-sm font-bold uppercase tracking-wide";
  const on = "border-stone-300 border-b-white bg-white text-verde-800 -mb-px";
  const off = "border-transparent text-stone-500 hover:text-verde-800";
  const items: { id: Pestana; texto: string; href: string }[] = [
    { id: "pedidos", texto: "Pedidos", href: "/pedidos" },
    { id: "semana", texto: "Semana y hoja de ruta", href: "/pedidos/semana" },
    { id: "vehiculos", texto: "Vehículos", href: "/pedidos/vehiculos" },
  ];
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-stone-300" aria-label="Pedidos">
      {items.map((i) => <Link key={i.id} href={i.href} className={`whitespace-nowrap ${base} ${activa === i.id ? on : off}`}>{i.texto}</Link>)}
    </nav>
  );
}
