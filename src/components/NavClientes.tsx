import Link from "next/link";

const PESTANAS = [
  { id: "clientes", href: "/clientes", texto: "Clientes" },
  { id: "marcas", href: "/marcas", texto: "Marcas" },
  { id: "importar", href: "/clientes/importar", texto: "Importar" },
];

/** Pestañas de la sección Clientes: así el menú principal no crece con cada cosa nueva. */
export function NavClientes({ actual }: { actual: "clientes" | "marcas" | "importar" }) {
  return (
    <div className="flex gap-2" aria-label="Secciones de clientes">
      {PESTANAS.map((p) => (
        <Link
          key={p.id}
          href={p.href}
          aria-current={p.id === actual ? "page" : undefined}
          className={`rounded-lg border px-3 py-2 text-sm font-medium ${p.id === actual ? "border-amber-700 bg-amber-700 text-white" : "border-stone-300 bg-white"}`}
        >
          {p.texto}
        </Link>
      ))}
    </div>
  );
}
