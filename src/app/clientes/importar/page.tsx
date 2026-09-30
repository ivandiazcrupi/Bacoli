import { Cabecera } from "@/components/Cabecera";
import Link from "next/link";
import { db } from "@/lib/db";
import { exigirOficina } from "@/lib/session";
import { Importador } from "./Importador";

export default async function ImportarClientes() {
  const usuario = await exigirOficina();
  const zonas = await db.zona.findMany({ orderBy: { orden: "asc" } });

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        <Link href="/clientes" className="text-sm text-stone-600">← Clientes</Link>
        <h1 className="text-2xl font-bold">Importar clientes desde la planilla</h1>
        <p className="text-sm text-stone-600">
          Primero se muestra una vista previa. No se carga nada hasta que confirmes. Los clientes que ya existen (mismo nombre) no se modifican.
        </p>
        <Importador zonas={zonas.map((z) => z.nombre)} />
      </main>
    </>
  );
}
