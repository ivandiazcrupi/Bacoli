import Link from "next/link";

type Pestana = "facturas" | "remitos" | "clientes";

// Las tres vistas de CUENTA: facturas, remitos y la cuenta de cada cliente.
export function EncabezadoCuenta({ activa }: { activa: Pestana }) {
  const base = "rounded-t-lg border-x border-t px-6 py-3 text-sm font-bold uppercase tracking-wide";
  const on = "border-stone-300 border-b-white bg-white text-verde-800 -mb-px";
  const off = "border-transparent text-stone-500 hover:text-verde-800";
  const items: { id: Pestana; texto: string; href: string }[] = [
    { id: "facturas", texto: "Facturas", href: "/cuentas" },
    { id: "remitos", texto: "Remitos", href: "/cuentas/remitos" },
    { id: "clientes", texto: "Clientes", href: "/cuentas/clientes" },
  ];
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Cuenta</h1>
      <nav className="flex gap-1 overflow-x-auto border-b border-stone-300" aria-label="Cuenta">
        {items.map((i) => <Link key={i.id} href={i.href} className={`whitespace-nowrap ${base} ${activa === i.id ? on : off}`}>{i.texto}</Link>)}
      </nav>
    </>
  );
}
