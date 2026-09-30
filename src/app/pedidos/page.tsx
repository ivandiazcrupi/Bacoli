import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { importeVigente } from "@/lib/cuenta";
import { db } from "@/lib/db";
import { aFecha, deFecha, diaMes, esFechaValida, hoy, lunesDe, nombreDia, sumarDias } from "@/lib/fechas";
import { exigirOficina } from "@/lib/session";
import { Tablero, type Columna, type Tarjeta } from "./Tablero";

export default async function Pedidos({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const usuario = await exigirOficina();
  const { semana } = await searchParams;
  const lunes = lunesDe(semana && esFechaValida(semana) ? semana : hoy());
  const domingo = sumarDias(lunes, 6);

  const pedidos = await db.pedido.findMany({
    where: {
      estado: { not: "CANCELADO" },
      OR: [{ fechaEntrega: null }, { fechaEntrega: { gte: aFecha(lunes), lte: aFecha(domingo) } }],
    },
    include: { cliente: true, punto: { include: { zona: true } }, items: true },
    orderBy: [{ ordenDia: "asc" }, { creadoEn: "asc" }],
  });

  // Lunes a sábado; el domingo solo aparece si hay algo asignado ese día.
  const hayDomingo = pedidos.some((p) => p.fechaEntrega && deFecha(p.fechaEntrega) === domingo);
  const fechas = Array.from({ length: hayDomingo ? 7 : 6 }, (_, n) => sumarDias(lunes, n));
  const columnas: Columna[] = [
    { clave: "bandeja", titulo: "Sin asignar", subtitulo: "Pedidos sin día" },
    ...fechas.map((f) => ({ clave: f, titulo: nombreDia(f), subtitulo: diaMes(f), hoy: f === hoy(), corta: nombreDia(f).slice(0, 3) })),
  ];

  const tarjetas: Record<string, Tarjeta> = {};
  const inicial: Record<string, string[]> = Object.fromEntries(columnas.map((c) => [c.clave, []]));
  for (const p of pedidos) {
    const clave = p.fechaEntrega ? deFecha(p.fechaEntrega) : "bandeja";
    if (!(clave in inicial)) continue;
    inicial[clave].push(p.id);
    tarjetas[p.id] = {
      id: p.id,
      cliente: p.cliente.nombre,
      sucursal: [p.punto.alias, p.punto.direccion].filter(Boolean).join(" · "),
      zona: p.punto.zona.nombre,
      estado: p.estado as Tarjeta["estado"],
      items: p.items.map((i) => ({ nombre: i.nombre, cantidad: p.estado === "ENTREGADO" ? (i.cantidadEntregada ?? i.cantidad) : i.cantidad, unidad: i.unidad })),
      total: importeVigente(p.items, Number(p.ivaPct), p.estado === "NO_ENTREGADO" ? "PENDIENTE" : p.estado),
      conFactura: p.conFactura,
    };
  }

  const esta = lunesDe(hoy());
  const semanaTexto = `${diaMes(lunes)} al ${diaMes(domingo)}`;

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Pedidos</h1>
          <Link href="/pedidos/nuevo" className="rounded-lg bg-amber-700 px-4 py-3 text-sm font-semibold text-white">+ Nuevo pedido</Link>
        </div>
        <nav className="flex items-center gap-2 text-sm" aria-label="Semana">
          <Link href={`/pedidos?semana=${sumarDias(lunes, -7)}`} className="rounded-lg border border-stone-300 bg-white px-3 py-2" aria-label="Semana anterior">←</Link>
          <span className="min-w-36 text-center font-medium">Semana {semanaTexto}</span>
          <Link href={`/pedidos?semana=${sumarDias(lunes, 7)}`} className="rounded-lg border border-stone-300 bg-white px-3 py-2" aria-label="Semana siguiente">→</Link>
          {lunes !== esta && <Link href="/pedidos" className="rounded-lg border border-stone-300 bg-white px-3 py-2">Esta semana</Link>}
        </nav>
        <p className="text-sm text-stone-600">Arrastrá cada pedido al día de entrega. Dentro de cada día, el número es el orden del reparto. En el celular, mantené apretado para arrastrar, o tocá el día debajo del pedido.</p>
        <Tablero key={`${lunes}-${pedidos.length}`} columnas={columnas} inicial={inicial} tarjetas={tarjetas} />
      </main>
    </>
  );
}
