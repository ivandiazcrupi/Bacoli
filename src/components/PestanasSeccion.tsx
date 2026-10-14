import Link from "next/link";

// Las solapas de una sección (Pedidos, Cuenta corriente, Comercial, Vendedor): todas iguales, para que el sistema se vea armonioso.
export function PestanasSeccion<K extends string>({ items, activa, etiqueta }: { items: { id: K; texto: string; href: string }[]; activa: K; etiqueta: string }) {
  const base = "rounded-t-lg border-x border-t px-6 py-3 text-sm font-bold uppercase tracking-wide";
  const on = "border-stone-300 border-b-white bg-white text-stone-900 -mb-px";
  const off = "border-transparent text-stone-500 hover:text-stone-900";
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-stone-300" aria-label={etiqueta}>
      {items.map((i) => <Link key={i.id} href={i.href} aria-current={activa === i.id ? "page" : undefined} className={`whitespace-nowrap ${base} ${activa === i.id ? on : off}`}>{i.texto}</Link>)}
    </nav>
  );
}
