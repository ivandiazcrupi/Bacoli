import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { aFecha, hoy } from "@/lib/fechas";
import { NOMBRE_ROL, esPersonalDeOficina } from "@/lib/roles";
import { exigirUsuario } from "@/lib/session";

export default async function Inicio() {
  const usuario = await exigirUsuario();
  const oficina = esPersonalDeOficina(usuario.rol);

  // Avisos para que ningún pedido quede colgado: sin día asignado, o con el día ya pasado y sin marcar entregado.
  const [sinAsignar, vencidos, deHoy] = oficina
    ? await Promise.all([
        db.pedido.count({ where: { estado: "PENDIENTE", fechaEntrega: null } }),
        db.pedido.count({ where: { estado: "PENDIENTE", fechaEntrega: { lt: aFecha(hoy()) } } }),
        db.pedido.count({ where: { estado: { not: "CANCELADO" }, fechaEntrega: aFecha(hoy()) } }),
      ])
    : [0, 0, 0];

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <div>
          <h1 className="text-2xl font-bold">Hola, {usuario.nombre}</h1>
          <p className="mt-1 text-stone-600">Ingresaste como {NOMBRE_ROL[usuario.rol]}.</p>
        </div>
        {oficina && (
          <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumen">
            <Link href="/pedidos" className="rounded-lg border border-stone-200 bg-white p-4">
              <p className="text-3xl font-bold tabular-nums">{deHoy}</p>
              <p className="text-sm text-stone-600">pedidos para hoy</p>
            </Link>
            <Link href="/pedidos" className={`rounded-lg border p-4 ${sinAsignar ? "border-amber-600 bg-amber-50" : "border-stone-200 bg-white"}`}>
              <p className="text-3xl font-bold tabular-nums">{sinAsignar}</p>
              <p className="text-sm text-stone-600">sin asignar a un día</p>
            </Link>
            <Link href="/pedidos" className={`rounded-lg border p-4 ${vencidos ? "border-red-600 bg-red-50" : "border-stone-200 bg-white"}`}>
              <p className="text-3xl font-bold tabular-nums">{vencidos}</p>
              <p className="text-sm text-stone-600">vencidos sin marcar entregado</p>
            </Link>
          </section>
        )}
      </main>
    </>
  );
}
