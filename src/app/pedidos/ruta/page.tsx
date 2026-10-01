import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { aFecha, deFecha, diaMes, esFechaValida, hoy, lunesDe, nombreDia, sumarDias } from "@/lib/fechas";
import { exigirOficina } from "@/lib/session";
import { aFila, aFilaBandeja, clientesConDeuda, incluirPedido } from "../filas";
import { PaginaPedidos, type Dia } from "../PaginaPedidos";
import { PestanasPedidos } from "../Pestanas";

// Hoja de ruta: arriba los pedidos sin asignar (una fila cada uno) y abajo los días de la semana, que se abren al tocarlos.
export default async function HojaDeRuta({ searchParams }: { searchParams: Promise<{ semana?: string; abrir?: string }> }) {
  const usuario = await exigirOficina();
  const { semana, abrir } = await searchParams;
  const lunes = lunesDe(semana && esFechaValida(semana) ? semana : hoy());
  const domingo = sumarDias(lunes, 6);

  const [sinAsignar, delaSemana, cerrados] = await Promise.all([
    db.pedido.findMany({ where: { estado: "PENDIENTE", fechaEntrega: null }, include: incluirPedido, orderBy: [{ ordenDia: "asc" }, { creadoEn: "asc" }] }),
    db.pedido.findMany({
      where: { estado: { not: "CANCELADO" }, fechaEntrega: { gte: aFecha(lunes), lte: aFecha(domingo) } },
      include: incluirPedido,
      orderBy: [{ ordenDia: "asc" }, { creadoEn: "asc" }],
    }),
    db.diaCerrado.findMany({ where: { fecha: { gte: aFecha(lunes), lte: aFecha(domingo) } } }),
  ]);
  const debe = await clientesConDeuda(delaSemana.map((p) => p.clienteId));
  const cerradosSet = new Set(cerrados.map((d) => deFecha(d.fecha)));

  // Lunes a sábado; el domingo solo aparece si hay algo asignado ese día.
  const hayDomingo = delaSemana.some((p) => p.fechaEntrega && deFecha(p.fechaEntrega) === domingo);
  const fechas = Array.from({ length: hayDomingo ? 7 : 6 }, (_, n) => sumarDias(lunes, n));
  const dias: Dia[] = fechas.map((f) => {
    const pedidos = delaSemana.filter((p) => p.fechaEntrega && deFecha(p.fechaEntrega) === f);
    return {
      fecha: f,
      titulo: nombreDia(f),
      subtitulo: diaMes(f),
      corta: nombreDia(f).slice(0, 3),
      hoy: f === hoy(),
      cerrado: cerradosSet.has(f),
      filas: pedidos.map((p) => aFila(p, debe)),
      monto: pedidos.reduce((s, p) => s + aFila(p, debe).monto, 0),
    };
  });

  // Los días arrancan cerrados (así quedan a mano para arrastrar); se abre solo el pedido con ?abrir=AAAA-MM-DD.
  const abiertosIniciales = abrir && fechas.includes(abrir) ? [abrir] : [];
  const esta = lunesDe(hoy());

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto max-w-[1900px] space-y-5 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Hoja de ruta</h1>
          <Link href="/pedidos/nuevo" className="rounded-lg bg-verde-700 px-4 py-3 text-sm font-semibold text-white">+ Nuevo pedido</Link>
        </div>
        <PestanasPedidos activa="ruta" />
        <nav className="flex flex-wrap items-center gap-2 text-sm" aria-label="Semana">
          <Link href={`/pedidos/ruta?semana=${sumarDias(lunes, -7)}`} className="rounded-lg border border-stone-300 bg-white px-3 py-2" aria-label="Semana anterior">←</Link>
          <span className="min-w-36 text-center font-medium">Semana {diaMes(lunes)} al {diaMes(domingo)}</span>
          <Link href={`/pedidos/ruta?semana=${sumarDias(lunes, 7)}`} className="rounded-lg border border-stone-300 bg-white px-3 py-2" aria-label="Semana siguiente">→</Link>
          {lunes !== esta && <Link href="/pedidos/ruta" className="rounded-lg border border-stone-300 bg-white px-3 py-2">Esta semana</Link>}
        </nav>
        <PaginaPedidos key={lunes} bandeja={sinAsignar.map(aFilaBandeja)} dias={dias} esDueno={usuario.rol === "DUENO"} abiertosIniciales={abiertosIniciales} />
      </main>
    </>
  );
}
