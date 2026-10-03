import type { EstadoPedido } from "@prisma/client";
import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { aFecha, deFecha, diaMes, esFechaValida, hoy, lunesDe, nombreDia, sumarDias } from "@/lib/fechas";
import { exigirOficina } from "@/lib/session";
import { Bandeja } from "./Bandeja";
import { TraerPedidosWeb } from "./TraerPedidosWeb";
import { aFilaBandeja, incluirPedido } from "./filas";
import { CONTENEDOR_PEDIDOS, EncabezadoPedidos } from "./Encabezado";

// PEDIDOS: todo lo cargado que espera día (como la hoja PEDIDOS de la planilla). Mayoristas y minoristas de la web van en dos listas.
export default async function Pedidos({ searchParams }: { searchParams: Promise<{ lista?: string; semana?: string }> }) {
  const usuario = await exigirOficina();
  const { lista, semana } = await searchParams;
  const esWeb = lista === "web";
  const lunes = lunesDe(semana && esFechaValida(semana) ? semana : hoy());
  const domingo = sumarDias(lunes, 6);
  const esta = lunesDe(hoy());

  // Esperan día: los pendientes sin fecha y los que volvieron como "no entregado" (se reactivan al asignarles día).
  const esperando = { estado: { in: ["PENDIENTE", "NO_ENTREGADO"] as EstadoPedido[] }, fechaEntrega: null };
  const [pedidos, cuentaMayoristas, cuentaWeb, cerrados] = await Promise.all([
    db.pedido.findMany({ where: { ...esperando, origen: esWeb ? "WEB" : "MAYORISTA" }, include: incluirPedido, orderBy: [{ creadoEn: "asc" }] }),
    db.pedido.count({ where: { ...esperando, origen: "MAYORISTA" } }),
    db.pedido.count({ where: { ...esperando, origen: "WEB" } }),
    db.diaCerrado.findMany({ where: { fecha: { gte: aFecha(lunes), lte: aFecha(domingo) } } }),
  ]);
  const cerradosSet = new Set(cerrados.map((d) => deFecha(d.fecha)));
  const dias = Array.from({ length: 6 }, (_, n) => sumarDias(lunes, n)).map((f) => ({ fecha: f, letra: nombreDia(f).charAt(0), numero: Number(f.slice(8)), nombre: nombreDia(f), hoy: f === hoy(), cerrado: cerradosSet.has(f) || f < hoy() }));

  // El último intento de entrega que falló de cada pedido: "No se entregó el 1/10 · motivo".
  const intentos = await db.intentoEntrega.findMany({ where: { pedidoId: { in: pedidos.map((p) => p.id) } }, orderBy: { creadoEn: "desc" } });
  const avisosIntento = new Map<string, string>();
  for (const i of intentos) if (!avisosIntento.has(i.pedidoId)) avisosIntento.set(i.pedidoId, `No se entregó el ${diaMes(deFecha(i.fecha))} · ${i.motivo}`);

  const enlace = (extra: Record<string, string>) => {
    const v: Record<string, string> = { ...(esWeb ? { lista: "web" } : {}), ...(semana ? { semana } : {}), ...extra };
    const q = new URLSearchParams(Object.entries(v).filter(([, x]) => x));
    return `/pedidos${q.size ? `?${q}` : ""}`;
  };
  const pastilla = "rounded-full px-5 py-2 text-sm font-semibold transition";

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <EncabezadoPedidos activa="pedidos" />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Link href={enlace({ lista: "" })} className={`${pastilla} ${!esWeb ? "bg-verde-700 text-white shadow-sm" : "border border-stone-400 bg-white text-stone-700 hover:border-verde-700"}`}>Mayoristas <span className={!esWeb ? "text-verde-100" : "text-stone-500"}>{cuentaMayoristas}</span></Link>
            <Link href={enlace({ lista: "web" })} className={`${pastilla} ${esWeb ? "bg-verde-700 text-white shadow-sm" : "border border-stone-400 bg-white text-stone-700 hover:border-verde-700"}`}>Minoristas (web) <span className={esWeb ? "text-verde-100" : "text-stone-500"}>{cuentaWeb}</span></Link>
          </div>
          <nav className="flex flex-wrap items-center gap-3 text-sm" aria-label="Semana en la que se asigna">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-600">Asignar a</span>
            <Link href={enlace({ semana: sumarDias(lunes, -7) })} className="rounded-md border border-stone-400 bg-white px-3 py-2 shadow-sm hover:border-verde-700" aria-label="Semana anterior">←</Link>
            <span className="min-w-36 rounded-md bg-verde-800 px-4 py-2 text-center text-sm font-bold uppercase tracking-wide text-white">Semana {diaMes(lunes)}</span>
            <Link href={enlace({ semana: sumarDias(lunes, 7) })} className="rounded-md border border-stone-400 bg-white px-3 py-2 shadow-sm hover:border-verde-700" aria-label="Semana siguiente">→</Link>
            {lunes !== esta && <Link href={enlace({ semana: "" })} className="rounded-md border border-stone-400 bg-white px-3 py-2 shadow-sm hover:border-verde-700">Esta semana</Link>}
          </nav>
        </div>

        {esWeb && <TraerPedidosWeb />}

        {esWeb && pedidos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-400 p-8 text-center text-stone-600">Todavía no hay pedidos de la tienda online esperando día. Entran solos cada 15 minutos, o tocá “Traer pedidos ahora”.</p>
        ) : (
          <Bandeja key={`${lunes}-${esWeb}`} filas={pedidos.map((p) => aFilaBandeja(p, avisosIntento.get(p.id) ?? ""))} dias={dias} />
        )}
      </main>
    </>
  );
}
