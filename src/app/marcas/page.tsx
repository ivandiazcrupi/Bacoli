import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { exigirOficina } from "@/lib/session";
import { FormularioMarca } from "./FormularioMarca";

export default async function Marcas() {
  const usuario = await exigirOficina();
  const marcas = await db.marca.findMany({
    orderBy: { nombre: "asc" },
    include: { _count: { select: { clientes: true, precios: true } } },
  });

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <h1 className="text-2xl font-bold">Marcas</h1>
        <p className="text-sm text-stone-600">
          Una marca agrupa clientes que comparten precio, por ejemplo las franquicias de VACALIN. Cada franquicia sigue siendo un cliente
          con su CUIT, su cuenta corriente y sus sucursales.
        </p>
        {marcas.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 p-4 text-stone-600">Todavía no hay marcas.</p>
        ) : (
          <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
            {marcas.map((m) => (
              <li key={m.id}>
                <Link href={`/marcas/${m.id}`} className="block p-4">
                  <p className="font-medium">{m.nombre}</p>
                  <p className="text-sm text-stone-600">
                    {m._count.clientes} {m._count.clientes === 1 ? "cliente" : "clientes"}
                    {m._count.precios > 0 && " · con precio especial"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <FormularioMarca />
      </main>
    </>
  );
}
